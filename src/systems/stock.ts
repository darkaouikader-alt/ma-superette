// Stock : lots (FIFO par date de péremption), rayons, entrepôt.
import { BALANCE } from '../data/constants';
import { levelDef } from '../data/levels';
import { PRODUCT_BY_ID } from '../data/products';
import type { Batch, GameState, Product, Storage } from '../state/types';
import { dayFactor } from './demand';
import { expectedDemand, up, weekdayOf } from './economy';
import { isSellable, sellableProducts } from './progression';

export const slotCapacity = (p: Product) => Math.max(1, Math.floor(BALANCE.SLOT_VOLUME / p.size));

export function totalQty(state: GameState, pid: string): number {
  return (state.stock[pid] ?? []).reduce((s, b) => s + b.qty, 0);
}

export function shelfQty(state: GameState, pid: string): number {
  let q = 0;
  for (const s of state.slots) if (s.productId === pid) q += s.qty;
  return q;
}

export function shelfCapacityFor(state: GameState, pid: string): number {
  const p = PRODUCT_BY_ID[pid];
  return p ? state.slots.filter((s) => s.productId === pid).length * slotCapacity(p) : 0;
}

export const warehouseQty = (state: GameState, pid: string) => Math.max(0, totalQty(state, pid) - shelfQty(state, pid));

export function warehouseUsed(state: GameState): number {
  let v = 0;
  for (const pid of Object.keys(state.stock)) v += warehouseQty(state, pid) * (PRODUCT_BY_ID[pid]?.size ?? 1);
  return v;
}

export function warehouseCapacity(state: GameState): number {
  return levelDef(state.level).warehouse + up(state, 'warehouse') * BALANCE.WAREHOUSE_UPGRADE_VOLUME + up(state, 'logistics') * BALANCE.LOGISTICS_VOLUME;
}

export function slotCount(state: GameState): number {
  return levelDef(state.level).slots + up(state, 'shelves') * BALANCE.SHELF_UPGRADE_SLOTS;
}

/** Ajoute les emplacements manquants après un niveau ou une amélioration. */
export function syncSlots(state: GameState): void {
  const n = slotCount(state);
  while (state.slots.length < n) state.slots.push({ productId: null, qty: 0 });
}

export function coldCapacity(state: GameState, storage: Storage): number {
  if (storage === 'ambient') return Infinity;
  return up(state, storage) * BALANCE.COLD_SLOTS_PER_LEVEL;
}

export function coldUsed(state: GameState, storage: Storage, exceptSlot = -1): number {
  return state.slots.filter((s, i) => i !== exceptSlot && s.productId && PRODUCT_BY_ID[s.productId]?.storage === storage).length;
}

/** Ajoute un lot ; `arrivalDay` sert à calculer la date limite de vente. */
export function addStock(state: GameState, pid: string, qty: number, unitCost: number, arrivalDay: number): void {
  if (qty <= 0) return;
  const p = PRODUCT_BY_ID[pid];
  const exp = p?.shelfLife ? arrivalDay + p.shelfLife - 1 : null;
  const batches = (state.stock[pid] ??= []);
  const same = batches.find((b) => b.exp === exp && Math.abs(b.cost - unitCost) < 0.001);
  if (same) same.qty += qty;
  else batches.push({ qty, exp, cost: unitCost });
  batches.sort((a, b) => (a.exp ?? Infinity) - (b.exp ?? Infinity));
}

/** Retire des unités (les plus anciennes d'abord). Retourne le coût d'achat des unités retirées. */
export function removeUnits(state: GameState, pid: string, qty: number): number {
  const batches = state.stock[pid] ?? [];
  let cost = 0;
  let left = qty;
  while (left > 0 && batches.length) {
    const b = batches[0];
    const take = Math.min(b.qty, left);
    b.qty -= take;
    left -= take;
    cost += take * b.cost;
    if (b.qty <= 0) batches.shift();
  }
  return cost;
}

/** Vend une unité depuis le rayon. Retourne le coût d'achat, ou null si le rayon est vide. */
export function sellFromShelf(state: GameState, pid: string): number | null {
  const slot = state.slots.find((s) => s.productId === pid && s.qty > 0);
  if (!slot) return null;
  slot.qty -= 1;
  return removeUnits(state, pid, 1);
}

/** Le rayon ne peut pas contenir plus que le stock réel. */
export function clampSlots(state: GameState, pid: string): void {
  let excess = shelfQty(state, pid) - totalQty(state, pid);
  for (let i = state.slots.length - 1; i >= 0 && excess > 0; i--) {
    const s = state.slots[i];
    if (s.productId !== pid) continue;
    const d = Math.min(s.qty, excess);
    s.qty -= d;
    excess -= d;
  }
}

export interface Expired { productId: string; qty: number; value: number }

/** Jette les lots dont la date limite est atteinte à la fin du jour `day`. */
export function expireStock(state: GameState, day: number): Expired[] {
  const out: Expired[] = [];
  for (const pid of Object.keys(state.stock)) {
    const batches = state.stock[pid];
    const dead = batches.filter((b) => b.exp !== null && b.exp <= day);
    if (!dead.length) continue;
    state.stock[pid] = batches.filter((b) => !(b.exp !== null && b.exp <= day));
    const qty = dead.reduce((s, b) => s + b.qty, 0);
    const value = dead.reduce((s, b) => s + b.qty * b.cost, 0);
    if (qty > 0) out.push({ productId: pid, qty, value: Math.round(value * 100) / 100 });
    clampSlots(state, pid);
  }
  return out;
}

/** Unités qui périment au plus tard le jour `day`. */
export function expiringBy(state: GameState, pid: string, day: number): number {
  return (state.stock[pid] ?? []).filter((b) => b.exp !== null && b.exp <= day).reduce((s, b) => s + b.qty, 0);
}

// ── Rayons ───────────────────────────────────────────────────

export function canAssign(state: GameState, slotIndex: number, pid: string): string | null {
  const p = PRODUCT_BY_ID[pid];
  if (!p || !isSellable(p, state)) return 'Produit indisponible.';
  if (p.storage !== 'ambient' && coldUsed(state, p.storage, slotIndex) >= coldCapacity(state, p.storage)) {
    return p.storage === 'fridge' ? 'Plus de place réfrigérée : achète un réfrigérateur.' : 'Plus de place surgelée : achète un congélateur.';
  }
  return null;
}

export function assignSlot(state: GameState, slotIndex: number, pid: string | null): string | null {
  const slot = state.slots[slotIndex];
  if (!slot) return 'Emplacement inconnu.';
  if (pid) {
    const err = canAssign(state, slotIndex, pid);
    if (err) return err;
  }
  slot.productId = pid;
  slot.qty = 0;
  if (pid) fillSlot(state, slotIndex);
  return null;
}

export function setSlotQty(state: GameState, slotIndex: number, qty: number): void {
  const slot = state.slots[slotIndex];
  const p = slot?.productId ? PRODUCT_BY_ID[slot.productId] : null;
  if (!slot || !p) return;
  const max = Math.min(slotCapacity(p), slot.qty + warehouseQty(state, p.id));
  slot.qty = Math.max(0, Math.min(max, Math.round(qty)));
}

export function fillSlot(state: GameState, slotIndex: number): number {
  const slot = state.slots[slotIndex];
  const p = slot?.productId ? PRODUCT_BY_ID[slot.productId] : null;
  if (!slot || !p) return 0;
  const add = Math.max(0, Math.min(slotCapacity(p) - slot.qty, warehouseQty(state, p.id)));
  slot.qty += add;
  return add;
}

export function fillAll(state: GameState): number {
  let n = 0;
  for (let i = 0; i < state.slots.length; i++) n += fillSlot(state, i);
  return n;
}

/** Produits « à l'assortiment » : au moins un emplacement de rayon. */
export function assortment(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const s of state.slots) if (s.productId) set.add(s.productId);
  return set;
}

/**
 * Agencement automatique : répartit tous les emplacements entre les produits en stock
 * (ou en commande), essentiels d'abord, puis selon la demande attendue.
 */
export function autoArrange(state: GameState): void {
  const current = assortment(state);
  // Avec un employé de rayon, les rayons sont regarnis en journée : moins de facing nécessaire.
  const refills = up(state, 'stocker') > 0 ? 2 : 1;
  const cands = sellableProducts(state)
    .filter((p) => totalQty(state, p.id) > 0 || current.has(p.id))
    .map((p) => ({ p, need: Math.max(1, Math.ceil((expectedDemand(state, p) * 1.25 * p.size) / BALANCE.SLOT_VOLUME / refills)), got: 0, score: expectedDemand(state, p) * (p.essential ? 3 : 1) }))
    .sort((a, b) => b.score - a.score);
  const cold: Record<Storage, number> = { ambient: Infinity, fridge: coldCapacity(state, 'fridge'), freezer: coldCapacity(state, 'freezer') };
  const plan: string[] = [];
  const total = state.slots.length;
  // 1er passage : un emplacement par produit ; passages suivants : selon le besoin.
  for (let pass = 0; pass < 6 && plan.length < total; pass++) {
    let added = false;
    for (const c of cands) {
      if (plan.length >= total) break;
      if (c.got >= c.need || cold[c.p.storage] <= 0) continue;
      if (pass > 0 && totalQty(state, c.p.id) <= c.got * slotCapacity(c.p)) continue;
      plan.push(c.p.id);
      c.got++;
      cold[c.p.storage]--;
      added = true;
    }
    if (!added) break;
  }
  // Emplacements restants : facings supplémentaires pour les produits dont le stock déborde.
  for (let guard = 0; guard < 4 && plan.length < total; guard++) {
    for (const c of cands) {
      if (plan.length >= total) break;
      if (cold[c.p.storage] <= 0 || totalQty(state, c.p.id) <= c.got * slotCapacity(c.p)) continue;
      plan.push(c.p.id);
      c.got++;
      cold[c.p.storage]--;
    }
  }
  // Regroupe les emplacements par catégorie pour un rayon lisible.
  const order = new Map(cands.map((c, i) => [c.p.id, i]));
  plan.sort((a, b) => PRODUCT_BY_ID[a].cat.localeCompare(PRODUCT_BY_ID[b].cat) || order.get(a)! - order.get(b)!);
  state.slots.forEach((s, i) => {
    s.productId = plan[i] ?? null;
    s.qty = 0;
  });
  fillAll(state);
}

// ── Estimations ──────────────────────────────────────────────

export function avgOf(arr: number[] | undefined, n: number): number | null {
  if (!arr || !arr.length) return null;
  const a = arr.slice(-n);
  return a.reduce((s, v) => s + v, 0) / a.length;
}

/** Ventes moyennes récentes (demande réelle, ruptures comprises) ; à défaut, demande théorique. */
export function avgDailyDemand(state: GameState, p: Product): number {
  const dh = state.demandHistory[p.id];
  const theo = expectedDemand(state, p);
  if (!dh || !dh.length) return theo;
  // Ramène chaque jour d'historique à un « jour moyen » (corrige l'effet week-end).
  const n = Math.min(3, dh.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += dh[dh.length - 1 - i] / dayFactor(p, weekdayOf(state.day - 1 - i));
  return (s / n) * 0.7 + theo * 0.3;
}

/** Prévision de ventes sur `nDays` jours à partir de `fromDay` (tient compte des jours de la semaine). */
export function forecastDemand(state: GameState, p: Product, fromDay: number, nDays: number): number {
  const base = avgDailyDemand(state, p);
  let s = 0;
  for (let d = 0; d < nDays; d++) s += base * dayFactor(p, weekdayOf(fromDay + d));
  return s;
}

/** « Stock pour X jours » d'après les ventes récentes. */
export function daysOfStock(state: GameState, p: Product): number {
  const avg = avgDailyDemand(state, p);
  return avg > 0.05 ? totalQty(state, p.id) / avg : Infinity;
}

export function stockValue(batches: Batch[] | undefined): number {
  return (batches ?? []).reduce((s, b) => s + b.qty * b.cost, 0);
}
