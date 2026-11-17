// Roue de la fortune : tirage, bonus temporaires (en journées de jeu) et leurs effets.
// Seul le délai entre deux tours est en temps réel.
import { WHEEL_COOLDOWN_MS, WHEEL_PRIZES, type BoostKind, type WheelPrize } from '../data/wheel';
import type { GameState } from '../state/types';

export interface WheelState { lastSpin: number; boosts: { kind: BoostKind; value: number; untilDay: number }[] }

export function wheelState(state: GameState): WheelState {
  state.wheel ??= { lastSpin: 0, boosts: [] };
  return state.wheel;
}

/** Temps restant avant le prochain tour (ms). Une horloge reculée ne bloque jamais plus d'une heure. */
export function spinCooldown(state: GameState, now = Date.now()): number {
  const last = state.wheel?.lastSpin ?? 0;
  return Math.max(0, Math.min(WHEEL_COOLDOWN_MS, last + WHEEL_COOLDOWN_MS - now));
}

export const canSpin = (state: GameState, now = Date.now()) => spinCooldown(state, now) === 0;

/**
 * Bonus actifs pour la journée en cours : actif du jour du tirage jusqu'au jour `untilDay` inclus.
 * (Les bonus des anciennes sauvegardes, en heures réelles, n'ont pas de `untilDay` : ignorés.)
 */
export function activeBoosts(state: GameState): WheelState['boosts'] {
  return (state.wheel?.boosts ?? []).filter((b) => typeof b.untilDay === 'number' && b.untilDay >= state.day);
}

/** Valeur d'un bonus actif (0 s'il n'est pas actif). */
export function boostValue(state: GameState, kind: BoostKind): number {
  return activeBoosts(state).find((b) => b.kind === kind)?.value ?? 0;
}

/** Nombre de journées restantes d'un bonus, la journée en cours comprise. */
export const boostDaysLeft = (state: GameState, b: { untilDay: number }) => b.untilDay - state.day + 1;

export interface SpinResult { index: number; prize: WheelPrize; cash: number }

/** Fait tourner la roue. `random` permet des tests déterministes. */
export function spinWheel(state: GameState, now = Date.now(), random = Math.random): SpinResult | string {
  if (!canSpin(state, now)) return 'La roue n’est pas encore prête.';
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = random() * total;
  let index = 0;
  for (; index < WHEEL_PRIZES.length - 1; index++) { r -= WHEEL_PRIZES[index].weight; if (r < 0) break; }
  const prize = WHEEL_PRIZES[index];
  const w = wheelState(state);
  w.lastSpin = now;
  w.boosts = activeBoosts(state);
  let cash = 0;
  if (prize.cash) {
    cash = prize.cash(state.level);
    state.cash = Math.round((state.cash + cash) * 100) / 100;
  }
  if (prize.boost) {
    const existing = w.boosts.find((b) => b.kind === prize.boost!.kind);
    // Déjà actif : les journées s'ajoutent à la fin du bonus en cours.
    if (existing) existing.untilDay += prize.boost.days;
    else w.boosts.push({ kind: prize.boost.kind, value: prize.boost.value, untilDay: state.day + prize.boost.days - 1 });
  }
  return { index, prize, cash };
}
