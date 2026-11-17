// Badges et alertes produit : rupture, rupture proche, péremption, rayon à remplir.
import type { GameState, Product } from '../state/types';
import { expectedEssentials, sellableProducts } from '../systems/progression';
import { assortment, daysOfStock, expiringBy, shelfCapacityFor, shelfQty, totalQty, warehouseQty } from '../systems/stock';
import { inTransit } from '../systems/suppliers';
import { badge, num1 } from './dom';

export interface Alert { p: Product; kind: 'rupture' | 'low' | 'expToday' | 'expTomorrow' | 'refill'; text: string; tone: 'red' | 'orange' | 'blue' }

export function productAlerts(state: GameState, p: Product, expected = true): Alert[] {
  const out: Alert[] = [];
  const total = totalQty(state, p.id);
  const days = daysOfStock(state, p);
  const transit = inTransit(state, p.id);
  if (total === 0 && expected) out.push({ p, kind: 'rupture', tone: 'red', text: transit > 0 ? 'Rupture (livraison en route)' : 'Rupture' });
  else if (total > 0 && days < 1.2 && transit === 0) out.push({ p, kind: 'low', tone: 'orange', text: `Stock pour ${num1(days)} j` });
  const today = expiringBy(state, p.id, state.day);
  const tomorrow = expiringBy(state, p.id, state.day + 1) - today;
  if (today > 0) out.push({ p, kind: 'expToday', tone: 'red', text: `${today} périment ce soir` });
  if (tomorrow > 0) out.push({ p, kind: 'expTomorrow', tone: 'orange', text: `${tomorrow} périment demain` });
  const cap = shelfCapacityFor(state, p.id);
  if (cap > 0 && shelfQty(state, p.id) < cap * 0.5 && warehouseQty(state, p.id) > 0) out.push({ p, kind: 'refill', tone: 'blue', text: 'Rayon à remplir' });
  return out;
}

/** Produits « suivis » : essentiels attendus, assortiment en rayon, ou en stock. */
export function trackedProducts(state: GameState): Product[] {
  const inRayon = assortment(state);
  const ess = new Set(expectedEssentials(state));
  return sellableProducts(state).filter((p) => ess.has(p) || inRayon.has(p.id) || totalQty(state, p.id) > 0);
}

export function collectAlerts(state: GameState): Alert[] {
  const order = { rupture: 0, expToday: 1, low: 2, refill: 3, expTomorrow: 4 };
  return trackedProducts(state).flatMap((p) => productAlerts(state, p)).sort((a, b) => order[a.kind] - order[b.kind]);
}

export function productBadges(state: GameState, p: Product): string {
  const b: string[] = [];
  if (p.essential) b.push(badge('Essentiel', 'blue'));
  for (const a of productAlerts(state, p)) {
    if (a.kind === 'rupture') b.push(badge('Rupture', 'red'));
    else if (a.kind === 'low') b.push(badge(a.text, 'orange'));
    else if (a.kind === 'expToday') b.push(badge('Périme ce soir', 'red'));
    else if (a.kind === 'expTomorrow') b.push(badge('Périme demain', 'orange'));
  }
  return b.join(' ');
}
