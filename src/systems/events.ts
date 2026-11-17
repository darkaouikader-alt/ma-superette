import { BALANCE } from '../data/constants';
import { EVENTS, EVENT_BY_ID, WEATHERS, type EventDef } from '../data/events';
import type { GameState, Product } from '../state/types';
import { makeRng, weightedPick, type Rng } from './rng';

export function activeEvents(state: GameState, day = state.day): EventDef[] {
  return state.events.filter((e) => e.startDay <= day && day <= e.endDay).map((e) => EVENT_BY_ID[e.id]).filter(Boolean);
}

export function upcomingEvents(state: GameState): { def: EventDef; inDays: number }[] {
  return state.events
    .filter((e) => e.startDay > state.day)
    .map((e) => ({ def: EVENT_BY_ID[e.id], inDays: e.startDay - state.day }))
    .filter((e) => e.def);
}

export interface EventModifiers { traffic: number; market: number; deliveryDelay: number; supplierCost: number }

export function eventModifiers(state: GameState, day = state.day): EventModifiers {
  const m: EventModifiers = { traffic: 1, market: 1, deliveryDelay: 0, supplierCost: 1 };
  for (const e of activeEvents(state, day)) {
    m.traffic *= e.traffic ?? 1;
    m.market *= e.market ?? 1;
    m.deliveryDelay += e.deliveryDelay ?? 0;
    m.supplierCost *= e.supplierCost ?? 1;
  }
  return m;
}

/** Prix du marché du jour (peut baisser pendant une promo concurrente). */
export function marketPrice(product: Product, state: GameState, day = state.day): number {
  return Math.round(product.market * eventModifiers(state, day).market * 100) / 100;
}

export interface Weather { icon: string; label: string; traffic: number }

export function weatherFor(state: GameState, day = state.day): Weather {
  const forced = activeEvents(state, day).find((e) => e.weather);
  if (forced) return { icon: forced.weather!, label: forced.name, traffic: 1 };
  const rng = makeRng(state.seed * 31 + day * 977);
  const w = weightedPick(WEATHERS, (x) => x[3], rng);
  return { icon: w[0], label: w[1], traffic: w[2] };
}

/** Tirage du matin : planifie éventuellement un nouvel événement. Retourne les annonces. */
export function rollEvents(state: GameState, rng: Rng): string[] {
  const news: string[] = [];
  state.events = state.events.filter((e) => e.endDay >= state.day);
  for (const e of state.events) {
    const def = EVENT_BY_ID[e.id];
    if (def && e.startDay === state.day) news.push(`${def.emoji} ${def.name} : ${def.desc}`);
  }
  if (state.day < BALANCE.EVENT_FIRST_DAY) return news;
  const busy = state.events.some((e) => e.endDay >= state.day);
  if (busy || rng() > BALANCE.EVENT_DAILY_CHANCE) return news;
  const pool = EVENTS.filter((e) => (e.minLevel ?? 1) <= state.level);
  const def = weightedPick(pool, (e) => e.weight, rng);
  const startDay = state.day + def.announce;
  state.events.push({ id: def.id, startDay, endDay: startDay + def.duration - 1 });
  if (def.announce === 0) news.push(`${def.emoji} ${def.name} : ${def.desc}`);
  else news.push(`📰 Annonce — ${def.emoji} ${def.name} ${def.announce === 1 ? 'demain' : `dans ${def.announce} jours`}.`);
  return news;
}
