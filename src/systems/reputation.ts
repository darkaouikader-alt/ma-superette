// Réputation : calcul de l'évolution quotidienne (pur, détaillé pour le bilan).
import { BALANCE } from '../data/constants';
import type { RepDetail } from '../state/types';

export interface ReputationInput {
  reputation: number;
  /** Unités d'essentiels demandées (au prix accepté) et réellement vendues. */
  essentialWanted: number;
  essentialSold: number;
  /** Ratio moyen prix / marché, pondéré par la demande (essentiels ×2). */
  priceRatio: number;
  wasteValue: number;
  revenue: number;
  /** Part des emplacements vides à l'ouverture. */
  emptyFraction: number;
  /** Part des clients repartis à cause de la file d'attente. */
  queueFraction: number;
  /** Part des articles non essentiels introuvables. */
  missingFraction: number;
  decoLevel: number;
  /** Bonus ponctuels (campagnes, promos sur les essentiels). */
  bonus?: RepDetail[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

export function curve(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return points[points.length - 1][1];
}

export function computeReputation(input: ReputationInput): { details: RepDetail[]; delta: number; after: number } {
  const B = BALANCE;
  const details: RepDetail[] = [];
  const add = (label: string, delta: number) => {
    if (Math.abs(delta) >= 0.05) details.push({ label, delta: Math.round(delta * 10) / 10 });
  };

  const service = input.essentialWanted > 0 ? input.essentialSold / input.essentialWanted : 1;
  // 100 % → +2,5 ; 90 % → 0 ; ≤ 50 % → −4
  const ess = service >= 0.9 ? lerp(0, B.REP_ESS_FULL, (service - 0.9) / 0.1) : lerp(B.REP_ESS_WORST, 0, (service - 0.5) / 0.4);
  add(service >= 0.9 ? 'Essentiels disponibles' : 'Ruptures sur les essentiels', ess);

  const price = curve(B.REP_PRICE_CURVE, input.priceRatio);
  add(price >= 0 ? 'Prix corrects' : input.priceRatio > 1.3 ? 'Prix abusifs' : 'Prix élevés', price);

  if (input.wasteValue <= 0) add('Aucun produit périmé', B.REP_NO_WASTE);
  else add('Produits périmés jetés', Math.max(B.REP_WASTE_MAX, -(input.wasteValue / Math.max(20, input.revenue)) * 10));

  if (input.emptyFraction > B.REP_EMPTY_TOLERANCE) {
    add('Rayons vides', Math.max(B.REP_EMPTY_MAX, -(input.emptyFraction - B.REP_EMPTY_TOLERANCE) * 4));
  }
  if (input.queueFraction > 0) add('File d’attente trop longue', Math.max(B.REP_QUEUE_MAX, -input.queueFraction * 6));
  if (input.missingFraction > 0.1) add('Produits introuvables', Math.max(B.REP_MISSING_NONESS_MAX, -(input.missingFraction - 0.1) * 2));
  if (input.decoLevel > 0) add('Décoration soignée', input.decoLevel * B.REP_DECO_DAILY);
  for (const b of input.bonus ?? []) add(b.label, b.delta);

  let delta = details.reduce((s, d) => s + d.delta, 0);
  if (delta > 0) delta *= Math.max(0.1, 1 - input.reputation / B.REP_DAMPING);
  const after = Math.round(Math.min(100, Math.max(0, input.reputation + delta)) * 10) / 10;
  return { details, delta: Math.round((after - input.reputation) * 10) / 10, after };
}
