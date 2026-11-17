import { BALANCE } from '../data/constants';
import { levelDef } from '../data/levels';
import { PRODUCT_BY_ID } from '../data/products';
import { CAMPAIGN_BY_ID } from '../data/campaigns';
import { UPGRADES } from '../data/upgrades';
import type { GameState, Product } from '../state/types';
import { computeDemand, reputationFactor, weekdayFactor, type DemandBreakdown, type DemandContext } from './demand';
import { decorTraffic } from './decor';
import { boostValue } from './wheel';
import { basketFactor, marketGrowth } from './market';
import { currentManager, managerEfficiency, managerSalary } from './shopMeta';
import { activeEvents, eventModifiers, marketPrice, weatherFor } from './events';

export const weekdayOf = (day: number) => (day - 1) % 7;
export const up = (state: GameState, id: string) => state.upgrades[id] ?? 0;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Multiplicateur d'affluence structurel (niveau + enseigne + publicité + croissance du marché + gérant). */
export function trafficMultiplier(state: GameState): number {
  return levelDef(state.level).traffic * marketGrowth(state) * managerEfficiency(state) * (1 + up(state, 'sign') * BALANCE.SIGN_TRAFFIC + up(state, 'billboard') * BALANCE.BILLBOARD_TRAFFIC);
}

// ── Promotions (lecture seule ; les actions sont dans promotions.ts) ──

/** Promotions en cours un jour donné. */
export const activePromos = (state: GameState, day = state.day) => (state.promos ?? []).filter((p) => p.startDay <= day && day <= p.endDay);

/** % de réduction en cours sur un produit (0 si aucune promo). */
export function promoPct(state: GameState, pid: string, day = state.day): number {
  return activePromos(state, day).find((p) => p.productId === pid)?.pct ?? 0;
}

/** Prix réellement payé par le client (prix promo s'il y en a un). */
export function salePrice(state: GameState, p: Product, day = state.day): number {
  const base = state.prices[p.id] ?? p.market;
  const pct = promoPct(state, p.id, day);
  return pct ? Math.max(0.05, round2(base * (1 - pct / 100))) : base;
}

export function promoMap(state: GameState, day = state.day): Record<string, number> {
  return Object.fromEntries(activePromos(state, day).map((p) => [p.productId, p.pct]));
}

/** Bonus d'affluence des promos produits (plafonné). */
export function promoTrafficBonus(state: GameState, day = state.day): number {
  return Math.min(BALANCE.PROMO_TRAFFIC_MAX, activePromos(state, day).length * BALANCE.PROMO_TRAFFIC_EACH);
}

export const activeCampaigns = (state: GameState, day = state.day) =>
  (state.campaigns ?? []).filter((c) => c.endDay >= day && CAMPAIGN_BY_ID[c.id]).map((c) => ({ ...c, def: CAMPAIGN_BY_ID[c.id] }));

/** Multiplicateur d'affluence total des promotions et campagnes. */
export function promotionTraffic(state: GameState, day = state.day): number {
  return (1 + promoTrafficBonus(state, day)) * activeCampaigns(state, day).reduce((m, c) => m * c.def.traffic, 1);
}

/** Ratio moyen prix / marché de l'assortiment en rayon (essentiels comptés double). */
export function averagePriceRatio(state: GameState): number {
  let sum = 0, weight = 0;
  const seen = new Set<string>();
  const market = eventModifiers(state).market;
  for (const s of state.slots) {
    const p = s.productId ? PRODUCT_BY_ID[s.productId] : null;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    const w = p.base * (p.essential ? 2 : 1);
    sum += (salePrice(state, p) / (p.market * market)) * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : 1;
}

/** Image prix : un magasin globalement trop cher attire moins de monde. */
export function priceImageFactor(state: GameState): number {
  const over = averagePriceRatio(state) - BALANCE.PRICE_IMAGE_START;
  return over <= 0 ? 1 : Math.max(BALANCE.PRICE_IMAGE_MIN, 1 - over * BALANCE.PRICE_IMAGE_SLOPE);
}

export function checkoutCapacity(state: GameState): number {
  const c = BALANCE.CHECKOUT_CAPACITY;
  return c[Math.min(up(state, 'cashier'), c.length - 1)];
}

/** Contexte de demande pour un jour donné. `neutralDay` = jour moyen sans météo ni événement. */
export function demandContext(state: GameState, day = state.day, neutralDay = false): DemandContext {
  if (neutralDay) {
    return { reputation: state.reputation, weekday: -1, traffic: trafficMultiplier(state) * decorTraffic(state) * (1 + boostValue(state, 'traffic')), events: [], marketMult: 1 + boostValue(state, 'price'), promos: promoMap(state, day), basket: basketFactor(state) };
  }
  const mods = eventModifiers(state, day);
  return {
    reputation: state.reputation,
    weekday: weekdayOf(day),
    traffic: trafficMultiplier(state) * mods.traffic * weatherFor(state, day).traffic * priceImageFactor(state) * promotionTraffic(state, day) * decorTraffic(state) * (1 + boostValue(state, 'traffic')),
    events: activeEvents(state, day),
    // « Clients généreux » (roue) : ils jugent les prix par rapport à un marché perçu plus haut.
    marketMult: mods.market * (1 + boostValue(state, 'price')),
    promos: promoMap(state, day),
    basket: basketFactor(state),
  };
}

export function demandFor(state: GameState, p: Product, day = state.day): DemandBreakdown {
  return computeDemand(p, salePrice(state, p, day), demandContext(state, day));
}

/** Demande attendue un jour moyen, au prix actuel. */
export function expectedDemand(state: GameState, p: Product): number {
  return computeDemand(p, salePrice(state, p), demandContext(state, state.day, true)).total;
}

export function potentialCustomers(state: GameState, day = state.day): number {
  const ctx = demandContext(state, day);
  return BALANCE.BASE_CUSTOMERS * ctx.traffic * reputationFactor(ctx.reputation) * weekdayFactor(ctx.weekday);
}

export interface Charges { rent: number; electricity: number; salaries: number; total: number }

export function dailyCharges(state: GameState): Charges {
  const rent = levelDef(state.level).rent;
  const electricity = round2(
    BALANCE.ELECTRICITY_BASE + state.slots.length * BALANCE.ELECTRICITY_PER_SLOT +
    up(state, 'fridge') * BALANCE.ELECTRICITY_PER_FRIDGE + up(state, 'freezer') * BALANCE.ELECTRICITY_PER_FREEZER,
  );
  const manager = currentManager(state);
  const salaries = UPGRADES.reduce((s, u) => s + (u.salary ?? 0) * up(state, u.id), 0) + (manager ? managerSalary(manager, state.level) : 0);
  return { rent, electricity, salaries, total: round2(rent + electricity + salaries) };
}

// ── Prix ─────────────────────────────────────────────────────

export type Verdict = 'cheap' | 'fair' | 'high' | 'abuse';
export const VERDICT_LABEL: Record<Verdict, string> = { cheap: 'Bon marché', fair: 'Correct', high: 'Cher', abuse: 'Trop cher' };

export function priceVerdict(price: number, market: number): Verdict {
  const r = price / market;
  if (r < BALANCE.VERDICT_CHEAP) return 'cheap';
  if (r <= BALANCE.VERDICT_FAIR) return 'fair';
  if (r <= BALANCE.VERDICT_HIGH) return 'high';
  return 'abuse';
}

/** Arrondi commercial au multiple de 5 centimes. */
export const roundPrice = (v: number) => Math.max(0.05, Math.round(v * 20) / 20);

/** Prix conseillé : le prix du marché du jour (jamais sous le coût + 5 %). */
export function suggestedPrice(p: Product, state: GameState): number {
  return roundPrice(Math.max(marketPrice(p, state), p.cost * 1.05));
}

/** Taux de marge sur coût, en %. */
export const markupPct = (price: number, cost: number) => (cost > 0 ? ((price - cost) / cost) * 100 : 0);

export function setPrice(state: GameState, productId: string, price: number): void {
  if (!Number.isFinite(price)) return;
  state.prices[productId] = Math.min(999, Math.max(0.05, round2(price)));
}

// ── Prêt d'urgence ───────────────────────────────────────────

export function loanOffer(state: GameState) {
  const amount = BALANCE.LOAN_BASE + BALANCE.LOAN_PER_LEVEL * (state.level - 1);
  const total = round2(amount * (1 + BALANCE.LOAN_INTEREST));
  return { amount, total, daily: round2(total / BALANCE.LOAN_DAYS), days: BALANCE.LOAN_DAYS };
}

export function canTakeLoan(state: GameState): boolean {
  if (!state.loan) return true;
  // Rallonge possible seulement si la caisse est vraiment à sec, dans la limite de LOAN_MAX_STACK prêts.
  return state.cash < BALANCE.LOAN_TRIGGER_CASH && state.loan.remaining + loanOffer(state).total <= loanOffer(state).total * BALANCE.LOAN_MAX_STACK;
}

export function takeLoan(state: GameState): boolean {
  if (!canTakeLoan(state)) return false;
  const o = loanOffer(state);
  state.cash = round2(state.cash + o.amount);
  const interestDaily = round2((o.total - o.amount) / o.days);
  state.loan = {
    remaining: round2((state.loan?.remaining ?? 0) + o.total),
    daily: round2((state.loan?.daily ?? 0) + o.daily),
    interestDaily: round2((state.loan?.interestDaily ?? 0) + interestDaily),
  };
  return true;
}

/** Remboursement quotidien. Retourne la part d'intérêts (comptée en charge). */
export function payLoan(state: GameState): number {
  if (!state.loan) return 0;
  const pay = Math.min(state.loan.daily, state.loan.remaining);
  const interest = Math.min(state.loan.interestDaily, pay);
  state.cash = round2(state.cash - pay);
  state.loan.remaining = round2(state.loan.remaining - pay);
  if (state.loan.remaining <= 0.01) state.loan = null;
  return interest;
}
