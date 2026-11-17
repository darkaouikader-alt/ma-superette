// Promotions produits et campagnes publicitaires (actions du joueur).
import { BALANCE } from '../data/constants';
import { CAMPAIGN_BY_ID } from '../data/campaigns';
import { PRODUCT_BY_ID } from '../data/products';
import type { GameState } from '../state/types';
import { activeCampaigns, activePromos, round2 } from './economy';
import { isSellable } from './progression';

export const promoSlots = (state: GameState) => BALANCE.PROMO_SLOTS_BASE + Math.floor(state.level / 2);

/** Lance une promo de `pct` % pendant `days` jours à partir d'aujourd'hui. Retourne une erreur ou null. */
export function startPromo(state: GameState, pid: string, pct: number, days: number): string | null {
  const p = PRODUCT_BY_ID[pid];
  if (!p || !isSellable(p, state)) return 'Produit indisponible.';
  if (state.phase !== 'morning') return 'Les promos se préparent le matin.';
  if (!BALANCE.PROMO_PCTS.includes(pct) || !BALANCE.PROMO_DAYS.includes(days)) return 'Promotion invalide.';
  state.promos ??= [];
  const existing = activePromos(state).find((x) => x.productId === pid);
  if (!existing && activePromos(state).length >= promoSlots(state)) return `Maximum ${promoSlots(state)} promos en même temps à ton niveau.`;
  state.promos = state.promos.filter((x) => x.productId !== pid);
  state.promos.push({ productId: pid, pct, startDay: state.day, endDay: state.day + days - 1 });
  if (!existing) state.totals.promosLaunched = (state.totals.promosLaunched ?? 0) + 1;
  return null;
}

export function stopPromo(state: GameState, pid: string): void {
  state.promos = (state.promos ?? []).filter((x) => x.productId !== pid);
}

export function launchCampaign(state: GameState, id: string): string | null {
  const def = CAMPAIGN_BY_ID[id];
  if (!def) return 'Campagne inconnue.';
  if (state.level < def.minLevel) return `Niveau ${def.minLevel} requis.`;
  if (activeCampaigns(state).some((c) => c.id === id)) return 'Cette campagne est déjà en cours.';
  const cost = def.cost(state.level);
  if (state.cash < cost) return 'Trésorerie insuffisante.';
  state.cash = round2(state.cash - cost);
  state.campaigns ??= [];
  state.campaigns.push({ id, endDay: state.day + def.days - 1 });
  state.totals.campaignsLaunched = (state.totals.campaignsLaunched ?? 0) + 1;
  return null;
}

/** Retire les promos et campagnes terminées ; retourne les messages pour les infos du matin. */
export function expirePromotions(state: GameState): string[] {
  const news: string[] = [];
  for (const p of state.promos ?? []) {
    if (p.endDay === state.day - 1 && PRODUCT_BY_ID[p.productId]) news.push(`🏷️ Fin de la promo sur ${PRODUCT_BY_ID[p.productId].name}.`);
  }
  for (const c of state.campaigns ?? []) {
    if (c.endDay === state.day - 1 && CAMPAIGN_BY_ID[c.id]) news.push(`📣 Fin de la campagne « ${CAMPAIGN_BY_ID[c.id].name} ».`);
  }
  state.promos = (state.promos ?? []).filter((p) => p.endDay >= state.day);
  state.campaigns = (state.campaigns ?? []).filter((c) => c.endDay >= state.day);
  return news;
}
