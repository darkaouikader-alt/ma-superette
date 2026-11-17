// Progression : XP, niveaux, déblocages, améliorations, licences, objectifs.
import { CATEGORIES, CATEGORY_BY_ID } from '../data/categories';
import { BALANCE, FINAL_GOAL } from '../data/constants';
import { LEVELS, MAX_LEVEL, levelDef } from '../data/levels';
import { OBJECTIVES, OBJECTIVE_BY_ID, type ObjectiveDef } from '../data/objectives';
import { PRODUCTS, PRODUCT_BY_ID } from '../data/products';
import { UPGRADE_BY_ID } from '../data/upgrades';
import type { CategoryId, DayReport, GameState, ObjectiveDone, Product } from '../state/types';
import { round2, up } from './economy';
import { makeRng, shuffle } from './rng';
import { assortment, syncSlots } from './stock';

// ── Déblocages ───────────────────────────────────────────────

export function isUnlocked(p: Product, state: GameState): boolean {
  return p.level <= state.level && (!p.unlockBy || state.unlockedSpecial.includes(p.id));
}

/** Raison pour laquelle un produit débloqué n'est pas encore vendable (ou null). */
export function lockReason(p: Product, state: GameState): string | null {
  if (p.level > state.level) return `Niveau ${p.level} requis`;
  if (p.unlockBy && !state.unlockedSpecial.includes(p.id)) return `Objectif : ${OBJECTIVE_BY_ID[p.unlockBy]?.label(0) ?? 'spécial'}`;
  const cat = CATEGORY_BY_ID[p.cat];
  if (cat.licence && !state.licences.includes(p.cat)) return `Licence « ${cat.name} » requise`;
  if (p.storage === 'fridge' && up(state, 'fridge') < 1) return 'Réfrigérateur requis';
  if (p.storage === 'freezer' && up(state, 'freezer') < 1) return 'Congélateur requis';
  return null;
}

export const isSellable = (p: Product, state: GameState) => lockReason(p, state) === null;
export const sellableProducts = (state: GameState) => PRODUCTS.filter((p) => isSellable(p, state));

/** Mémorise le jour où chaque produit devient vendable (pour le délai de grâce). */
export function refreshSellable(state: GameState): void {
  // Débloqué pendant le bilan du soir : disponible à partir du lendemain matin.
  const day = state.phase === 'report' ? state.day + 1 : state.day;
  for (const p of PRODUCTS) {
    if (state.sellableSince[p.id] === undefined && isSellable(p, state)) state.sellableSince[p.id] = day;
  }
}

/** Produit devenu disponible récemment (hors produits du départ) : affiché « Nouveau » pendant quelques jours. */
export function isNewProduct(p: Product, state: GameState): boolean {
  const since = state.sellableSince[p.id];
  return since !== undefined && since > 1 && state.day >= since && state.day - since < BALANCE.NEW_PRODUCT_DAYS && isSellable(p, state);
}

/** Libellé du badge « Nouveau » (jours restants en info-bulle). */
export function newBadgeTitle(p: Product, state: GameState): string {
  const left = BALANCE.NEW_PRODUCT_DAYS - (state.day - (state.sellableSince[p.id] ?? state.day));
  return `Disponible depuis le jour ${state.sellableSince[p.id]} · encore ${left} jour${left > 1 ? 's' : ''} en nouveauté`;
}

/** Essentiels que les clients s'attendent à trouver aujourd'hui. */
export function expectedEssentials(state: GameState): Product[] {
  return sellableProducts(state).filter((p) => {
    if (!p.essential) return false;
    const since = state.sellableSince[p.id] ?? state.day;
    const known = (state.stock[p.id]?.length ?? 0) > 0 || (state.demandHistory[p.id]?.length ?? 0) > 0;
    return known || state.day >= since + BALANCE.ESSENTIAL_GRACE_DAYS;
  });
}

// ── XP et niveaux ────────────────────────────────────────────

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (const l of LEVELS) if (xp >= l.xp) lvl = l.level;
  return lvl;
}

export function xpProgress(state: GameState): { current: number; needed: number; pct: number; max: boolean } {
  if (state.level >= MAX_LEVEL) return { current: state.xp, needed: state.xp, pct: 100, max: true };
  const lo = levelDef(state.level).xp;
  const hi = levelDef(state.level + 1).xp;
  return { current: state.xp - lo, needed: hi - lo, pct: Math.min(100, ((state.xp - lo) / (hi - lo)) * 100), max: false };
}

/** Ajoute de l'XP ; retourne les niveaux gagnés (et les met en file pour la célébration). */
export function addXp(state: GameState, amount: number): number[] {
  state.xp = Math.round(state.xp + Math.max(0, amount));
  const gained: number[] = [];
  const target = levelForXp(state.xp);
  while (state.level < target) {
    state.level++;
    gained.push(state.level);
    state.pendingLevelUps.push(state.level);
  }
  if (gained.length) {
    syncSlots(state);
    refreshSellable(state);
  }
  return gained;
}

export interface LevelNews {
  level: number; name: string;
  products: Product[]; categories: CategoryId[];
  slots: number; warehouse: number; trafficPct: number;
}

export function levelNews(level: number): LevelNews {
  const def = levelDef(level);
  const prev = levelDef(level - 1);
  const products = PRODUCTS.filter((p) => p.level === level && !p.unlockBy);
  const before = new Set(PRODUCTS.filter((p) => p.level < level).map((p) => p.cat));
  const categories = CATEGORIES.map((c) => c.id).filter((c) => !before.has(c) && products.some((p) => p.cat === c));
  return {
    level, name: def.name, products, categories,
    slots: def.slots - prev.slots, warehouse: def.warehouse - prev.warehouse,
    trafficPct: Math.round((def.traffic / prev.traffic - 1) * 100),
  };
}

// ── Améliorations et licences ────────────────────────────────

export function upgradeCost(state: GameState, id: string): number | null {
  const def = UPGRADE_BY_ID[id];
  return def?.costs[up(state, id)] ?? null;
}

export function buyUpgrade(state: GameState, id: string): string | null {
  const def = UPGRADE_BY_ID[id];
  const cost = upgradeCost(state, id);
  if (!def || cost === null) return 'Amélioration au maximum.';
  if (state.level < def.minLevel) return `Niveau ${def.minLevel} requis.`;
  if (state.cash < cost) return 'Trésorerie insuffisante.';
  state.cash = round2(state.cash - cost);
  state.upgrades[id] = up(state, id) + 1;
  if (id === 'sign') state.reputation = Math.min(100, state.reputation + BALANCE.REP_SIGN_INSTANT);
  if (id === 'deco') state.reputation = Math.min(100, state.reputation + BALANCE.REP_DECO_INSTANT);
  syncSlots(state);
  refreshSellable(state);
  return null;
}

/** Niveau minimal d'une catégorie = niveau de son premier produit. */
export const categoryLevel = (cat: CategoryId) => Math.min(...PRODUCTS.filter((p) => p.cat === cat).map((p) => p.level));

export function buyLicence(state: GameState, cat: CategoryId): string | null {
  const def = CATEGORY_BY_ID[cat];
  if (!def.licence || state.licences.includes(cat)) return 'Licence déjà acquise.';
  if (state.level < categoryLevel(cat)) return `Niveau ${categoryLevel(cat)} requis.`;
  if (state.cash < def.licence) return 'Trésorerie insuffisante.';
  state.cash = round2(state.cash - def.licence);
  state.licences.push(cat);
  refreshSellable(state);
  return null;
}

// ── Objectifs ────────────────────────────────────────────────

export const weekOf = (day: number) => Math.floor((day - 1) / 7);

export function metricValue(metric: string, state: GameState, report?: DayReport | null): number {
  const [kind, arg] = metric.split(':');
  const week = state.history.filter((h) => weekOf(h.day) === state.objectives.weekly.week);
  switch (kind) {
    case 'profit': return report?.profit ?? 0;
    case 'revenue': return report?.revenue ?? 0;
    case 'served': return report?.customersServed ?? 0;
    case 'noEssStockout': return report ? (report.essentialStockouts.length === 0 ? 1 : 0) : 0;
    case 'noWaste': return report ? (report.expired.length === 0 ? 1 : 0) : 0;
    case 'fewDisappointed': {
      if (!report) return 0;
      const bad = report.disappointedStock + report.disappointedPrice + report.queueLost;
      return bad / Math.max(1, report.customersPotential) < 0.1 ? 1 : 0;
    }
    case 'weekRevenue': return week.reduce((s, h) => s + h.revenue, 0);
    case 'weekProfit': return week.reduce((s, h) => s + h.profit, 0);
    case 'weekServed': return week.reduce((s, h) => s + h.customersServed, 0);
    case 'essStreak': return state.objectives.essentialStreak;
    case 'ordersPlaced': return state.totals.ordersPlaced;
    case 'bestProfit': return state.totals.bestProfit;
    case 'upgrade': return up(state, arg);
    case 'reputation': return state.reputation;
    case 'employees': return (up(state, 'cashier') > 0 ? 1 : 0) + (up(state, 'stocker') > 0 ? 1 : 0);
    case 'licence': return state.licences.includes(arg as CategoryId) ? 1 : 0;
    case 'assortment': return assortment(state).size;
    case 'cash': return state.cash;
    case 'level': return state.level;
    case 'branches': return (state.branches ?? []).length;
    case 'totalCustomers': return state.totals.customers;
    case 'final': {
      const a = Math.min(1, state.level / FINAL_GOAL.level);
      const b = Math.min(1, Math.max(0, state.cash) / FINAL_GOAL.cash);
      return a >= 1 && b >= 1 ? 1 : Math.min(0.99, (a + b) / 2);
    }
    default: return 0;
  }
}

export interface ObjectiveView {
  def: ObjectiveDef; label: string; target: number; value: number; pct: number; done: boolean;
  cash: number; xp: number; unlock?: Product;
}

export function objectiveView(def: ObjectiveDef, state: GameState, done: boolean, report?: DayReport | null): ObjectiveView {
  const target = def.target(state.level);
  const value = metricValue(def.metric, state, report);
  return {
    def, target, value, done,
    label: def.label(target),
    pct: done ? 100 : Math.max(0, Math.min(100, (value / target) * 100)),
    cash: def.reward.cash?.(state.level) ?? 0,
    xp: def.reward.xp?.(state.level) ?? 0,
    unlock: def.reward.unlock ? PRODUCT_BY_ID[def.reward.unlock] : undefined,
  };
}

/** Tire les objectifs du jour / de la semaine si nécessaire. */
export function ensureObjectives(state: GameState): void {
  const o = state.objectives;
  if (o.daily.day !== state.day) {
    const pool = OBJECTIVES.filter((d) => d.scope === 'daily' && (d.minLevel ?? 1) <= state.level);
    o.daily = { day: state.day, ids: shuffle(pool, makeRng(state.seed + state.day * 101)).slice(0, 2).map((d) => d.id), done: [] };
  }
  const week = weekOf(state.day);
  if (o.weekly.week !== week || !o.weekly.ids.length) {
    const pool = OBJECTIVES.filter((d) => d.scope === 'weekly' && (d.minLevel ?? 1) <= state.level);
    o.weekly = { week, ids: shuffle(pool, makeRng(state.seed + week * 5003)).slice(0, 2).map((d) => d.id), done: [] };
  }
}

export function objectivesPanel(state: GameState, report?: DayReport | null) {
  const o = state.objectives;
  const view = (id: string, done: boolean) => objectiveView(OBJECTIVE_BY_ID[id], state, done, report);
  return {
    daily: o.daily.ids.filter((id) => OBJECTIVE_BY_ID[id]).map((id) => view(id, o.daily.done.includes(id))),
    weekly: o.weekly.ids.filter((id) => OBJECTIVE_BY_ID[id]).map((id) => view(id, o.weekly.done.includes(id))),
    long: OBJECTIVES.filter((d) => d.scope === 'long' && !o.longDone.includes(d.id) && (d.minLevel ?? 1) <= state.level)
      .map((d) => objectiveView(d, state, false)),
  };
}

function grant(state: GameState, v: ObjectiveView): ObjectiveDone {
  state.cash = round2(state.cash + v.cash);
  if (v.unlock && !state.unlockedSpecial.includes(v.unlock.id)) state.unlockedSpecial.push(v.unlock.id);
  if (v.def.final) state.finalDone = true;
  addXp(state, v.xp);
  refreshSellable(state);
  return { id: v.def.id, label: v.label, cash: v.cash, xp: v.xp, unlock: v.unlock?.id };
}

/** Vérifie les objectifs à long terme (appelé après chaque action du joueur). */
export function checkLongObjectives(state: GameState): ObjectiveDone[] {
  const out: ObjectiveDone[] = [];
  for (const v of objectivesPanel(state).long) {
    if (v.value >= v.target) {
      state.objectives.longDone.push(v.def.id);
      out.push(grant(state, v));
    }
  }
  return out;
}

/** Évalue tous les objectifs en fin de journée. */
export function evaluateObjectives(state: GameState, report: DayReport): ObjectiveDone[] {
  const out: ObjectiveDone[] = [];
  const panel = objectivesPanel(state, report);
  for (const v of panel.daily) {
    if (!v.done && v.value >= v.target) { state.objectives.daily.done.push(v.def.id); out.push(grant(state, v)); }
  }
  for (const v of panel.weekly) {
    if (!v.done && v.value >= v.target) { state.objectives.weekly.done.push(v.def.id); out.push(grant(state, v)); }
  }
  out.push(...checkLongObjectives(state));
  return out;
}
