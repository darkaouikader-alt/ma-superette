// Roue de la fortune : tirage, bonus temporaires (en temps réel) et leurs effets.
import { WHEEL_COOLDOWN_MS, WHEEL_PRIZES, type BoostKind, type WheelPrize } from '../data/wheel';
import type { GameState } from '../state/types';

export interface WheelState { lastSpin: number; boosts: { kind: BoostKind; value: number; until: number }[] }

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

/** Valeur d'un bonus actif (0 s'il n'est pas actif). */
export function boostValue(state: GameState, kind: BoostKind, now = Date.now()): number {
  return state.wheel?.boosts.find((b) => b.kind === kind && b.until > now)?.value ?? 0;
}

export function activeBoosts(state: GameState, now = Date.now()): WheelState['boosts'] {
  return (state.wheel?.boosts ?? []).filter((b) => b.until > now);
}

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
  w.boosts = w.boosts.filter((b) => b.until > now);
  let cash = 0;
  if (prize.cash) {
    cash = prize.cash(state.level);
    state.cash = Math.round((state.cash + cash) * 100) / 100;
  }
  if (prize.boost) {
    const existing = w.boosts.find((b) => b.kind === prize.boost!.kind);
    const add = prize.boost.hours * 3600_000;
    // Déjà actif : la durée s'ajoute.
    if (existing) existing.until += add;
    else w.boosts.push({ kind: prize.boost.kind, value: prize.boost.value, until: now + add });
  }
  return { index, prize, cash };
}
