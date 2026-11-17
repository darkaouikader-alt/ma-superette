// Fournisseurs : tarifs, délais, panier, commandes, livraisons, réassort automatique.
import { BALANCE } from '../data/constants';
import { PRODUCT_BY_ID } from '../data/products';
import { SUPPLIERS, SUPPLIER_BY_ID, type SupplierDef } from '../data/suppliers';
import type { GameState, Order, Product } from '../state/types';
import { round2, up } from './economy';
import { eventModifiers } from './events';
import { expectedEssentials, sellableProducts } from './progression';
import { addStock, assortment, expiringBy, forecastDemand, totalQty, warehouseCapacity } from './stock';

export const suppliersFor = (p: Product): SupplierDef[] => SUPPLIERS.filter((s) => s.categories.includes(p.cat));

export function effectiveDelay(sup: SupplierDef, state: GameState): number {
  if (up(state, 'express') > 0) return Math.max(1, sup.delay - 1);
  return sup.delay + eventModifiers(state).deliveryDelay;
}

export function unitCost(p: Product, sup: SupplierDef, state: GameState): number {
  return round2(p.cost * sup.priceFactor * eventModifiers(state).supplierCost);
}

export interface LinePrice { qty: number; unit: number; discountPct: number; total: number }

export function linePrice(p: Product, sup: SupplierDef, lots: number, state: GameState): LinePrice {
  const qty = lots * sup.lotSize;
  const discountPct = lots >= sup.discountLots ? sup.discountPct : 0;
  const unit = round2(unitCost(p, sup, state) * (1 - discountPct));
  return { qty, unit, discountPct, total: round2(unit * qty) };
}

export function inTransit(state: GameState, pid: string): number {
  let q = 0;
  for (const o of state.orders) for (const l of o.lines) if (l.productId === pid) q += l.qty;
  return q;
}

export function cartLots(state: GameState, supplierId: string, pid: string): number {
  return state.cart.find((c) => c.supplierId === supplierId && c.productId === pid)?.lots ?? 0;
}

export function setCartLots(state: GameState, supplierId: string, pid: string, lots: number): void {
  const n = Math.max(0, Math.min(99, Math.round(lots)));
  const i = state.cart.findIndex((c) => c.supplierId === supplierId && c.productId === pid);
  if (n === 0) { if (i >= 0) state.cart.splice(i, 1); return; }
  if (i >= 0) state.cart[i].lots = n;
  else state.cart.push({ supplierId, productId: pid, lots: n });
}

/** Volume total stockable : entrepôt + rayons. */
export function storageCapacity(state: GameState): number {
  return warehouseCapacity(state) + state.slots.length * BALANCE.SLOT_VOLUME;
}

/** Volume déjà engagé : stock présent + commandes en route. */
export function storageCommitted(state: GameState): number {
  let v = 0;
  for (const pid of Object.keys(state.stock)) v += totalQty(state, pid) * (PRODUCT_BY_ID[pid]?.size ?? 1);
  for (const o of state.orders) for (const l of o.lines) v += l.qty * (PRODUCT_BY_ID[l.productId]?.size ?? 1);
  return v;
}

export interface CartView {
  lines: { sup: SupplierDef; p: Product; lots: number; price: LinePrice }[];
  total: number; volume: number; overCapacity: boolean; overCash: boolean;
}

export function cartView(state: GameState): CartView {
  const lines = state.cart
    .map((c) => ({ sup: SUPPLIER_BY_ID[c.supplierId], p: PRODUCT_BY_ID[c.productId], lots: c.lots }))
    .filter((l) => l.sup && l.p)
    .map((l) => ({ ...l, price: linePrice(l.p, l.sup, l.lots, state) }));
  const total = round2(lines.reduce((s, l) => s + l.price.total, 0));
  const volume = lines.reduce((s, l) => s + l.price.qty * l.p.size, 0);
  return {
    lines, total, volume,
    overCapacity: storageCommitted(state) + volume > storageCapacity(state),
    overCash: total > state.cash + 0.001,
  };
}

/** Valide le panier : une commande par fournisseur. Retourne un message d'erreur ou null. */
export function placeOrders(state: GameState): string | null {
  const cart = cartView(state);
  if (!cart.lines.length) return 'Le panier est vide.';
  if (cart.overCash) return 'Trésorerie insuffisante pour cette commande.';
  if (cart.overCapacity) return 'Pas assez de place en stock : réduis la commande ou agrandis l’entrepôt.';
  const bySup = new Map<string, Order>();
  for (const l of cart.lines) {
    let o = bySup.get(l.sup.id);
    if (!o) {
      o = { id: state.nextOrderId++, supplierId: l.sup.id, lines: [], orderedDay: state.day, arrivalDay: state.day + effectiveDelay(l.sup, state), total: 0 };
      bySup.set(l.sup.id, o);
    }
    o.lines.push({ productId: l.p.id, qty: l.price.qty, unitCost: l.price.unit });
    o.total = round2(o.total + l.price.total);
  }
  for (const o of bySup.values()) state.orders.push(o);
  state.cash = round2(state.cash - cart.total);
  state.totals.ordersPlaced += bySup.size;
  state.cart = [];
  return null;
}

/** Réceptionne les commandes arrivées. */
export function receiveDeliveries(state: GameState): Order[] {
  const arrived = state.orders.filter((o) => o.arrivalDay <= state.day);
  state.orders = state.orders.filter((o) => o.arrivalDay > state.day);
  for (const o of arrived) for (const l of o.lines) addStock(state, l.productId, l.qty, l.unitCost, state.day);
  return arrived;
}

/** Fournisseur le plus rapide (puis le moins cher) pour un produit. */
export function fastestSupplier(p: Product, state: GameState): SupplierDef | null {
  const list = suppliersFor(p);
  if (!list.length) return null;
  return list.slice().sort((a, b) => effectiveDelay(a, state) - effectiveDelay(b, state) || a.priceFactor - b.priceFactor)[0];
}

/** Quantité à commander pour couvrir les prochains jours (ventes moyennes récentes). */
export function reorderQty(state: GameState, p: Product, sup: SupplierDef, coverScale = 1): number {
  const delay = effectiveDelay(sup, state);
  const arrival = state.day + delay;
  // Produits très frais : on ne couvre que ce qui peut être vendu avant péremption.
  const cover = Math.max(1, Math.min(BALANCE.REORDER_COVER_DAYS, (p.shelfLife ?? 99) - 1));
  const want = forecastDemand(state, p, arrival, cover) * BALANCE.REORDER_SAFETY * coverScale;
  // Les unités qui périment avant l'arrivée ne comptent pas (elles sont vendues en premier).
  const dying = expiringBy(state, p.id, arrival - 1);
  const soldBefore = Math.max(0, forecastDemand(state, p, state.day, delay) - dying);
  const atArrival = Math.max(0, totalQty(state, p.id) - dying + inTransit(state, p.id) - soldBefore);
  return Math.max(0, want - atArrival);
}

/**
 * Remplit le panier selon les ventes moyennes. Respecte la trésorerie et la place disponible.
 * Retourne le nombre de produits ajoutés.
 */
export function autoReorder(state: GameState, scope: 'essentials' | 'all', supplierId?: string): number {
  const inRayon = assortment(state);
  const only = supplierId ? SUPPLIER_BY_ID[supplierId] : null;
  /** Fournisseur utilisé : celui choisi par le joueur, sinon le plus rapide. */
  const supFor = (p: Product) => (only ? (only.categories.includes(p.cat) ? only : null) : fastestSupplier(p, state));
  const inCart = new Set(state.cart.map((c) => c.productId));
  let list = scope === 'essentials'
    ? expectedEssentials(state).concat(sellableProducts(state).filter((p) => p.essential)).filter((p, i, a) => a.indexOf(p) === i)
    : sellableProducts(state).filter((p) => p.essential || inRayon.has(p.id));
  // Un produit déjà dans le panier (chez n'importe quel fournisseur) n'est pas recommandé deux fois.
  list = list.filter((p) => supFor(p) && !inCart.has(p.id));
  list.sort((a, b) => Number(b.essential) - Number(a.essential));
  let added = 0;
  let budget = state.cash - cartView(state).total;
  let room = storageCapacity(state) - storageCommitted(state) - cartView(state).volume;
  // Si le budget est trop juste, on réduit la couverture pour servir tous les produits.
  const costAt = (scale: number) => list.reduce((s, p) => {
    const sup = supFor(p);
    if (!sup || cartLots(state, sup.id, p.id) > 0) return s;
    const q = reorderQty(state, p, sup, scale);
    return q < 0.5 ? s : s + linePrice(p, sup, Math.ceil(q / sup.lotSize), state).total;
  }, 0);
  let scale = 1;
  while (scale > 0.45 && costAt(scale) > budget) scale -= 0.1;
  for (const p of list) {
    const sup = supFor(p);
    if (!sup || cartLots(state, sup.id, p.id) > 0) continue;
    const qty = reorderQty(state, p, sup, scale);
    if (qty < 0.5) continue;
    let lots = Math.ceil(qty / sup.lotSize);
    while (lots > 0) {
      const price = linePrice(p, sup, lots, state);
      if (price.total <= budget && price.qty * p.size <= room) {
        setCartLots(state, sup.id, p.id, lots);
        budget -= price.total;
        room -= price.qty * p.size;
        added++;
        break;
      }
      lots--;
    }
  }
  return added;
}
