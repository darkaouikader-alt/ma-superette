import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/constants';
import { LEVELS } from '../src/data/levels';
import { PRODUCT_BY_ID } from '../src/data/products';
import { SUPPLIER_BY_ID } from '../src/data/suppliers';
import { BRANCHES } from '../src/data/branches';
import { createNewGame } from '../src/state/store';
import { branchIncomeOf } from '../src/systems/branches';
import { expectedDemand, potentialCustomers, trafficMultiplier } from '../src/systems/economy';
import { basketFactor, buyingDiscount, marketGrowth } from '../src/systems/market';
import { refillTimes, stockerRefills } from '../src/systems/stock';
import { unitCost } from '../src/systems/suppliers';

describe('économie évolutive', () => {
  it('le marché grandit à chaque semaine jouée, jusqu’à un plafond', () => {
    expect(marketGrowth({ day: 1 })).toBe(1);
    expect(marketGrowth({ day: 7 })).toBe(1);
    expect(marketGrowth({ day: 8 })).toBeCloseTo(1 + BALANCE.MARKET_GROWTH_PER_WEEK);
    expect(marketGrowth({ day: 5000 })).toBeCloseTo(1 + BALANCE.MARKET_GROWTH_MAX);
    const s = createNewGame(1);
    const before = trafficMultiplier(s);
    s.day = 7 * 20 + 1; // 20 semaines jouées
    expect(trafficMultiplier(s)).toBeCloseTo(before * (1 + 20 * BALANCE.MARKET_GROWTH_PER_WEEK));
  });

  it('les succursales profitent aussi de la croissance', () => {
    const s = createNewGame(1);
    const base = branchIncomeOf(BRANCHES[0], s);
    s.day = 7 * 30 + 1;
    expect(branchIncomeOf(BRANCHES[0], s)).toBeCloseTo(base * marketGrowth(s), 0);
  });

  it('panier moyen : un grand magasin vend plus par client, sans plus de monde en caisse', () => {
    const s = createNewGame(1);
    s.level = 7; // panier ×1
    const p = PRODUCT_BY_ID.pates;
    const d7 = expectedDemand(s, p), c7 = potentialCustomers(s);
    expect(basketFactor(s)).toBe(1);
    // Même affluence, panier ×2 au niveau 20 : la demande double, les clients non.
    const traffic20 = LEVELS[19].traffic / LEVELS[6].traffic;
    s.level = 20;
    expect(potentialCustomers(s)).toBeCloseTo(c7 * traffic20, 0);
    expect(expectedDemand(s, p)).toBeCloseTo(d7 * traffic20 * basketFactor(s), 1);
  });

  it('centrale d’achat : les prix fournisseurs baissent avec le niveau', () => {
    const s = createNewGame(1);
    const p = PRODUCT_BY_ID.pates, sup = SUPPLIER_BY_ID.dupont;
    const c1 = unitCost(p, sup, s);
    expect(buyingDiscount(s)).toBe(0);
    s.level = 20;
    expect(buyingDiscount(s)).toBeGreaterThan(0.1);
    expect(unitCost(p, sup, s)).toBeCloseTo(c1 * (1 - buyingDiscount(s)), 1);
  });

  it('progression sans retour en arrière : chaque niveau apporte plus que le précédent', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = LEVELS[i - 1], b = LEVELS[i];
      expect(b.xp).toBeGreaterThan(a.xp);
      expect(b.slots).toBeGreaterThan(a.slots);
      expect(b.warehouse).toBeGreaterThan(a.warehouse);
      expect(b.traffic).toBeGreaterThan(a.traffic);
      expect(b.basket).toBeGreaterThanOrEqual(a.basket);
      expect(b.buying).toBeGreaterThanOrEqual(a.buying);
    }
  });

  it('équipe de rayon : plus d’employés, plus de regarnissages', () => {
    const s = createNewGame(1);
    expect(stockerRefills(s)).toBe(0);
    s.upgrades.stocker = 1;
    expect(refillTimes(s)).toEqual(BALANCE.STOCKER_REFILLS);
    s.upgrades.stocker = 4;
    const t = refillTimes(s);
    expect(t.length).toBe(BALANCE.STOCKER_REFILL_COUNT[4]);
    expect(t.every((x, i) => x > 0 && x < 1 && (i === 0 || x > t[i - 1]))).toBe(true);
  });
});
