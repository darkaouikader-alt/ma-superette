// Formule de demande (pure, testée) :
//   demande = base × poids_essentiel × facteur_prix × facteur_réputation
//             × facteur_jour × événements × promo × panier moyen × affluence × aléa(±10 %)
// (le prix utilisé est le prix promo s'il y en a un)
import { BALANCE } from '../data/constants';
import type { EventDef } from '../data/events';
import type { Product } from '../state/types';

export interface DemandContext {
  reputation: number;
  /** 0 = lundi … 6 = dimanche ; −1 = jour « moyen » (facteur 1). */
  weekday: number;
  /** Multiplicateur d'affluence (niveau du magasin, publicité, météo, événements, image prix). */
  traffic: number;
  events: EventDef[];
  /** Multiplicateur du prix du marché (promo concurrente). */
  marketMult: number;
  /** Produits en promotion (id → % de réduction) : bonus de visibilité. */
  promos?: Record<string, number>;
  /** Panier moyen (taille du magasin) : multiplie les achats sans ajouter de clients en caisse. */
  basket?: number;
}

export interface DemandBreakdown {
  base: number;
  essentialWeight: number;
  priceFactor: number;
  repFactor: number;
  dayFactor: number;
  eventFactor: number;
  traffic: number;
  noise: number;
  market: number;
  /** Demande au prix du marché (facteur_prix = 1). */
  /** Bonus de visibilité d'un produit en promotion. */
  promoFactor: number;
  basket: number;
  neutral: number;
  total: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** facteur_prix = (prix_marché / prix_joueur) ^ élasticité, borné entre 0 et 2. */
export function priceFactor(market: number, price: number, elasticity: number): number {
  if (price <= 0) return BALANCE.PRICE_FACTOR_MAX;
  const ratio = price / market;
  let f = Math.pow(market / price, elasticity);
  // Prix abusif : au-delà de ABUSE_RATIO_START × marché, les clients renoncent progressivement.
  if (ratio > BALANCE.ABUSE_RATIO_START) {
    const span = BALANCE.ABUSE_RATIO_END - BALANCE.ABUSE_RATIO_START;
    f *= clamp(1 - (ratio - BALANCE.ABUSE_RATIO_START) / span, 0, 1);
  }
  return clamp(f, BALANCE.PRICE_FACTOR_MIN, BALANCE.PRICE_FACTOR_MAX);
}

export function reputationFactor(reputation: number): number {
  const r = clamp(reputation, 0, 100) / 100;
  return BALANCE.REP_FACTOR_AT_0 + (BALANCE.REP_FACTOR_AT_100 - BALANCE.REP_FACTOR_AT_0) * r;
}

export function weekdayFactor(weekday: number): number {
  return weekday < 0 ? 1 : BALANCE.WEEKDAY_FACTORS[weekday % 7];
}

/** Facteur jour = jour de la semaine × variation de catégorie × variation d'étiquette. */
export function dayFactor(product: Product, weekday: number): number {
  if (weekday < 0) return 1;
  const wd = weekday % 7;
  let f = BALANCE.WEEKDAY_FACTORS[wd];
  f *= BALANCE.CATEGORY_WEEKDAY[product.cat]?.[wd] ?? 1;
  let tag = 1;
  for (const t of product.tags) tag = Math.max(tag, BALANCE.TAG_WEEKDAY[t]?.[wd] ?? 1);
  return f * tag;
}

export function eventDemandFactor(product: Product, events: EventDef[]): number {
  let f = 1;
  for (const e of events) {
    const d = e.demand;
    if (!d) continue;
    let m = d.all ?? 1;
    m *= d.cats?.[product.cat] ?? 1;
    // Une seule étiquette compte par événement : la plus marquante.
    let best = 1;
    for (const t of product.tags) {
      const v = d.tags?.[t];
      if (v !== undefined && Math.abs(v - 1) > Math.abs(best - 1)) best = v;
    }
    f *= m * best;
  }
  return f;
}

export function computeDemand(product: Product, price: number, ctx: DemandContext, noise = 1): DemandBreakdown {
  const market = product.market * ctx.marketMult;
  const b: DemandBreakdown = {
    base: product.base * BALANCE.DEMAND_SCALE,
    essentialWeight: product.essential ? BALANCE.ESSENTIAL_WEIGHT : 1,
    priceFactor: priceFactor(market, price, product.elasticity),
    repFactor: reputationFactor(ctx.reputation),
    dayFactor: dayFactor(product, ctx.weekday),
    eventFactor: eventDemandFactor(product, ctx.events),
    traffic: ctx.traffic,
    noise,
    market,
    promoFactor: ctx.promos?.[product.id] ? 1 + BALANCE.PROMO_VISIBILITY : 1,
    basket: ctx.basket ?? 1,
    neutral: 0,
    total: 0,
  };
  b.neutral = b.base * b.essentialWeight * b.repFactor * b.dayFactor * b.eventFactor * b.promoFactor * b.basket * b.traffic * b.noise;
  b.total = b.neutral * b.priceFactor;
  return b;
}
