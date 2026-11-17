// Économie évolutive : le marché grandit avec le temps et l'enseigne avec son niveau.
//   - croissance du marché : le quartier se développe à chaque semaine jouée (plus de clients,
//     succursales plus rentables), dans la limite de MARKET_GROWTH_MAX ;
//   - panier moyen : plus le magasin est grand, plus chaque client achète ;
//   - centrale d'achat : remise sur tous les prix fournisseurs selon le niveau (économies d'échelle).
// Les valeurs sont dans data/constants.ts et data/levels.ts.
import { BALANCE } from '../data/constants';
import { levelDef } from '../data/levels';
import type { GameState } from '../state/types';

/** Multiplicateur de croissance du marché (1 = départ). Dépend des journées jouées, pas du temps réel. */
export function marketGrowth(state: Pick<GameState, 'day'>): number {
  const weeks = Math.max(0, Math.floor((state.day - 1) / 7));
  return 1 + Math.min(BALANCE.MARKET_GROWTH_MAX, weeks * BALANCE.MARKET_GROWTH_PER_WEEK);
}

/** Panier moyen : multiplicateur des achats par client. */
export const basketFactor = (state: Pick<GameState, 'level'>) => levelDef(state.level).basket;

/** Remise de la centrale d'achat (0 à 1). */
export const buyingDiscount = (state: Pick<GameState, 'level'>) => levelDef(state.level).buying;

export interface EconomySummary { growthPct: number; basket: number; buyingPct: number; maxGrowth: boolean }

export function economySummary(state: GameState): EconomySummary {
  const g = marketGrowth(state) - 1;
  return {
    growthPct: Math.round(g * 1000) / 10,
    basket: basketFactor(state),
    buyingPct: Math.round(buyingDiscount(state) * 100),
    maxGrowth: g >= BALANCE.MARKET_GROWTH_MAX,
  };
}
