import { describe, expect, it, vi } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { SUPPLIER_BY_ID } from '../src/data/suppliers';
import { WHEEL_PRIZES } from '../src/data/wheel';
import { createNewGame } from '../src/state/store';
import { potentialCustomers } from '../src/systems/economy';
import { effectiveDelay, unitCost } from '../src/systems/suppliers';
import { runDay, startNextDay } from '../src/systems/simulation';
import { boostValue, canSpin, spinCooldown, spinWheel } from '../src/systems/wheel';

const H = 3600_000;
/** Tirage forcé sur le lot `id` (le hasard choisit la bonne part de la roue). */
const pick = (id: string) => () => {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let before = 0;
  for (const p of WHEEL_PRIZES) { if (p.id === id) return (before + p.weight / 2) / total; before += p.weight; }
  throw new Error(id);
};

describe('roue de la fortune', () => {
  it('un tour par heure (temps réel)', () => {
    const s = createNewGame(1);
    const t0 = 1_800_000_000_000;
    expect(canSpin(s, t0)).toBe(true);
    expect(typeof spinWheel(s, t0, pick('cash'))).toBe('object');
    expect(spinWheel(s, t0 + 10 * 60_000)).toMatch(/pas encore prête/);
    expect(spinCooldown(s, t0 + 10 * 60_000)).toBe(50 * 60_000);
    expect(canSpin(s, t0 + H)).toBe(true);
    // horloge reculée : jamais plus d'une heure d'attente
    expect(spinCooldown(s, t0 - 5 * H)).toBe(H);
  });

  it('cagnotte versée tout de suite, plus grosse au jackpot et aux niveaux élevés', () => {
    const s = createNewGame(1);
    const cash = s.cash;
    const r = spinWheel(s, 1e12, pick('cash')) as { cash: number };
    expect(s.cash).toBeCloseTo(cash + r.cash);
    const big = createNewGame(1); big.level = 10;
    expect((spinWheel(big, 1e12, pick('jackpot')) as { cash: number }).cash).toBeGreaterThan(r.cash * 10);
  });

  it('les bonus temporaires agissent sur le jeu, puis s’arrêtent après leurs journées de jeu', () => {
    const s = createNewGame(1);
    const now = Date.now();
    const clients = potentialCustomers(s);
    const cost = unitCost(PRODUCT_BY_ID.pates, SUPPLIER_BY_ID.dupont, s);
    spinWheel(s, now, pick('traffic')); // 2 journées : aujourd'hui et demain
    expect(potentialCustomers(s)).toBeCloseTo(clients * 1.15, 0);
    s.wheel!.lastSpin = 0;
    spinWheel(s, now, pick('supplier')); // 1 journée : aujourd'hui seulement
    expect(unitCost(PRODUCT_BY_ID.pates, SUPPLIER_BY_ID.dupont, s)).toBeCloseTo(cost * 0.9, 1);
    s.wheel!.lastSpin = 0;
    spinWheel(s, now, pick('express'));
    expect(effectiveDelay(SUPPLIER_BY_ID.discount, s)).toBe(2);
    s.day += 1;
    expect(boostValue(s, 'traffic')).toBe(0.15);
    expect(boostValue(s, 'supplier')).toBe(0);
    s.day += 1;
    expect(boostValue(s, 'traffic')).toBe(0);
  });

  it('le temps réel ne fait pas avancer les bonus : seules les journées jouées comptent', () => {
    const s = createNewGame(1);
    const t0 = 1_800_000_000_000;
    spinWheel(s, t0, pick('traffic'));
    vi.useFakeTimers();
    // Une semaine plus tard sans jouer : le bonus est toujours là.
    vi.setSystemTime(t0 + 7 * 24 * H);
    expect(boostValue(s, 'traffic')).toBe(0.15);
    vi.useRealTimers();
  });

  it('un bonus de 3 journées couvre exactement 3 journées jouées', () => {
    const s = createNewGame(1);
    spinWheel(s, 1e12, pick('rep'));
    const day = s.day;
    const play = () => { runDay(s); startNextDay(s); };
    play(); play();
    expect(boostValue(s, 'rep')).toBe(1); // 3e journée : encore active
    play();
    expect(s.day).toBe(day + 3);
    expect(boostValue(s, 'rep')).toBe(0);
  });

  it('gagner deux fois le même bonus additionne les journées', () => {
    const s = createNewGame(1);
    const t0 = 1_800_000_000_000;
    spinWheel(s, t0, pick('xp')); // 2 journées
    spinWheel(s, t0 + H, pick('xp')); // encore 2, ajoutées à la fin du premier
    expect(s.wheel!.boosts).toHaveLength(1);
    expect(s.wheel!.boosts[0].untilDay).toBe(s.day + 3);
  });

  it('les anciens bonus en heures réelles (anciennes sauvegardes) sont ignorés', () => {
    const s = createNewGame(1);
    s.wheel = { lastSpin: 0, boosts: [{ kind: 'traffic', value: 0.15, until: Date.now() + 9e9 } as never] };
    expect(boostValue(s, 'traffic')).toBe(0);
    spinWheel(s, 1e12, pick('cash'));
    expect(s.wheel.boosts).toHaveLength(0);
  });
});
