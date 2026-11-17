// Achats rapides (ruptures, stock faible) et acheteur automatique.
import { BALANCE } from '../data/constants';
import { SUPPLIER_BY_ID, type SupplierDef } from '../data/suppliers';
import type { BuyerReport, GameState, Product } from '../state/types';
import { round2, up } from './economy';
import { expectedEssentials, sellableProducts } from './progression';
import { assortment, avgDailyDemand, totalQty } from './stock';
import {
  cartLots, cartView, daysUntilEmpty, effectiveDelay, fastestSupplier, inTransit, linePrice, placeOrders, reorderQty, setCartLots,
  storageCapacity, storageCommitted, suppliersFor,
} from './suppliers';

/** Produits que les clients attendent : en rayon, ou essentiels déjà exigés. */
function expectedProducts(state: GameState): Product[] {
  const inRayon = assortment(state);
  const ess = new Set(expectedEssentials(state));
  return sellableProducts(state).filter((p) => inRayon.has(p.id) || ess.has(p));
}

/** En rupture (plus aucune unité) et rien en route. */
export function ruptureProducts(state: GameState): Product[] {
  return expectedProducts(state).filter((p) => totalQty(state, p.id) === 0 && inTransit(state, p.id) === 0);
}

/** Bientôt en rupture (moins de ~1 jour de ventes) et rien en route. */
export function lowStockProducts(state: GameState): Product[] {
  return expectedProducts(state).filter((p) => {
    const q = totalQty(state, p.id);
    return q > 0 && inTransit(state, p.id) === 0 && q / Math.max(0.05, avgDailyDemand(state, p)) < BALANCE.LOW_STOCK_DAYS;
  });
}

/**
 * Ajoute ces produits au panier chez le fournisseur le plus rapide (urgence),
 * pour couvrir les prochains jours, dans la limite de la trésorerie et de la place.
 */
export function addUrgentToCart(state: GameState, products: Product[]): { added: number; skipped: number } {
  let budget = state.cash - cartView(state).total;
  let room = storageCapacity(state) - storageCommitted(state) - cartView(state).volume;
  let added = 0, skipped = 0;
  const list = products.slice().sort((a, b) => Number(b.essential) - Number(a.essential));
  for (const p of list) {
    const sup = fastestSupplier(p, state);
    if (!sup || state.cart.some((c) => c.productId === p.id)) continue;
    let lots = Math.max(1, Math.ceil(reorderQty(state, p, sup) / sup.lotSize));
    while (lots > 0 && (linePrice(p, sup, lots, state).total > budget || lots * sup.lotSize * p.size > room)) lots--;
    if (!lots) { skipped++; continue; }
    const price = linePrice(p, sup, lots, state);
    setCartLots(state, sup.id, p.id, lots);
    budget -= price.total;
    room -= price.qty * p.size;
    added++;
  }
  return { added, skipped };
}

// ── Acheteur automatique ────────────────────────────────────

export const hasBuyer = (state: GameState) => up(state, 'buyer') > 0;

export function buyerSettings(state: GameState): NonNullable<GameState['buyer']> {
  state.buyer ??= { enabled: true, coverDays: 2, reserve: 500 };
  return state.buyer;
}

interface Choice { sup: SupplierDef; lots: number; total: number; unit: number; runOut: number }

/**
 * Meilleur fournisseur pour un produit : le moins cher parmi ceux qui livrent avant
 * que le stock soit épuisé ; à défaut (urgence), le plus rapide.
 */
export function bestChoice(state: GameState, p: Product, coverScale: number): Choice | null {
  const sups = suppliersFor(p);
  if (!sups.length) return null;
  // Fournisseurs qui livrent avant la rupture (livraisons en cours prises à leur date)
  const runOut = daysUntilEmpty(state, p);
  const onTime = sups.filter((s) => effectiveDelay(s, state) <= runOut);
  const pool = onTime.length ? onTime : [fastestSupplier(p, state)!];
  // Produits frais : jamais plus que ce qui se vend avant la date de péremption.
  if (p.shelfLife) {
    const base = Math.max(1, Math.min(BALANCE.REORDER_COVER_DAYS, p.shelfLife - 1));
    coverScale = Math.min(coverScale, Math.max(1, (p.shelfLife - 1) / base));
  }
  let best: Choice | null = null;
  for (const sup of pool) {
    const qty = reorderQty(state, p, sup, coverScale);
    if (qty < 0.5) continue;
    const lots = Math.ceil(qty / sup.lotSize);
    const price = linePrice(p, sup, lots, state);
    if (!best || price.unit < best.unit) best = { sup, lots, total: price.total, unit: price.unit, runOut };
  }
  // Juste à temps : si une commande demain arrivera encore avant la rupture, on attend
  // (la trésorerie n'est pas bloquée inutilement dans du stock).
  if (best && runOut > effectiveDelay(best.sup, state) + 1) return null;
  return best;
}

/** Commandes passées chaque matin par l'acheteur. Retourne le compte rendu. */
export function runBuyer(state: GameState): BuyerReport | null {
  if (!hasBuyer(state)) return null;
  const cfg = buyerSettings(state);
  if (!cfg.enabled) return null;
  const userCart = state.cart;
  let budget = state.cash - cfg.reserve - cartView(state).total;
  const wanted = expectedProducts(state).filter((p) => !userCart.some((c) => c.productId === p.id)); // le joueur s'en occupe déjà
  let room = storageCapacity(state) - storageCommitted(state) - cartView(state).volume;
  // Budget ou place serrés : on réduit les quantités pour pouvoir servir TOUS les produits.
  let coverScale = cfg.coverDays / BALANCE.REORDER_COVER_DAYS;
  const needAt = (scale: number) => wanted.reduce((t, p) => {
    const c = bestChoice(state, p, scale);
    return c ? { cost: t.cost + c.total, volume: t.volume + c.lots * c.sup.lotSize * p.size } : t;
  }, { cost: 0, volume: 0 });
  for (let n = needAt(coverScale); coverScale > 0.5 && (n.cost > budget || n.volume > room); n = needAt(coverScale)) {
    coverScale = Math.max(0.5, coverScale - 0.25);
  }
  // Les plus urgents d'abord, puis les essentiels.
  const list = wanted
    .map((p) => ({ p, c: bestChoice(state, p, coverScale) }))
    .filter((x) => x.c)
    .sort((a, b) => a.c!.runOut - b.c!.runOut || Number(b.p.essential) - Number(a.p.essential));
  state.cart = [];
  let saved = 0, skipped = 0, total = 0;
  for (const { p, c: choice } of list) {
    const c = choice!;
    let lots = c.lots;
    while (lots > 0 && (linePrice(p, c.sup, lots, state).total > budget || lots * c.sup.lotSize * p.size > room)) lots--;
    if (!lots) { skipped++; continue; }
    const price = linePrice(p, c.sup, lots, state);
    setCartLots(state, c.sup.id, p.id, lots);
    budget -= price.total;
    room -= price.qty * p.size;
    total += price.total;
    // Économie par rapport à une commande au plus rapide, même quantité
    const fast = fastestSupplier(p, state);
    if (fast && fast.id !== c.sup.id) saved += Math.max(0, linePrice(p, fast, Math.ceil(price.qty / fast.lotSize), state).unit * price.qty - price.total);
  }
  const products = state.cart.length;
  if (products) placeOrders(state);
  state.cart = userCart;
  const report: BuyerReport = { day: state.day, products, total: round2(total), saved: round2(saved), skipped };
  cfg.last = report;
  return report;
}

export const supplierName = (id: string) => SUPPLIER_BY_ID[id]?.name ?? id;
export { cartLots };
