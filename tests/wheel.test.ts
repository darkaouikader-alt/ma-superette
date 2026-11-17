import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { SUPPLIER_BY_ID } from '../src/data/suppliers';
import { WHEEL_PRIZES } from '../src/data/wheel';
import { createNewGame } from '../src/state/store';
import { potentialCustomers } from '../src/systems/economy';
import { effectiveDelay, unitCost } from '../src/systems/suppliers';
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

  it('les bonus temporaires agissent sur le jeu, puis s’arrêtent à l’heure prévue', () => {
    const s = createNewGame(1);
    const now = Date.now();
    const clients = potentialCustomers(s);
    const cost = unitCost(PRODUCT_BY_ID.pates, SUPPLIER_BY_ID.dupont, s);
    spinWheel(s, now, pick('traffic'));
    expect(potentialCustomers(s)).toBeCloseTo(clients * 1.15, 0);
    s.wheel!.lastSpin = 0;
    spinWheel(s, now, pick('supplier'));
    expect(unitCost(PRODUCT_BY_ID.pates, SUPPLIER_BY_ID.dupont, s)).toBeCloseTo(cost * 0.9, 1);
    s.wheel!.lastSpin = 0;
    spinWheel(s, now, pick('express'));
    expect(effectiveDelay(SUPPLIER_BY_ID.discount, s)).toBe(2);
    expect(boostValue(s, 'traffic', now + 3 * H + 1)).toBe(0);
  });

  it('gagner deux fois le même bonus additionne les durées', () => {
    const s = createNewGame(1);
    const t0 = 1_800_000_000_000;
    spinWheel(s, t0, pick('xp')); // 2 h
    spinWheel(s, t0 + H, pick('xp')); // encore 2 h, ajoutées à la fin du premier
    expect(s.wheel!.boosts).toHaveLength(1);
    expect(s.wheel!.boosts[0].until).toBe(t0 + 4 * H);
  });
});
