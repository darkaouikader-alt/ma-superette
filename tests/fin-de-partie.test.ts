import { describe, expect, it } from 'vitest';
import { BRANCHES } from '../src/data/branches';
import { MAX_LEVEL } from '../src/data/levels';
import { UPGRADE_BY_ID } from '../src/data/upgrades';
import { createNewGame } from '../src/state/store';
import { branchRepFactor, buyBranch, dailyBranchIncome } from '../src/systems/branches';
import { checkoutCapacity } from '../src/systems/economy';
import { addXp, buyUpgrade, levelForXp } from '../src/systems/progression';
import { runDay } from '../src/systems/simulation';
import { warehouseCapacity } from '../src/systems/stock';

describe('fin de partie étendue', () => {
  it('20 niveaux, de la petite épicerie à l’empire mondial', () => {
    expect(MAX_LEVEL).toBe(20);
    expect(levelForXp(3_000_000)).toBe(14);
    expect(levelForXp(100_000_000)).toBe(20);
    const s = createNewGame(1);
    addXp(s, 100_000_000);
    expect(s.level).toBe(20);
    expect(s.slots.length).toBeGreaterThanOrEqual(300);
  });

  it('améliorations prolongées : caisses jusqu’à 7 500 clients, entrepôt logistique', () => {
    const s = createNewGame(1);
    s.level = 20; s.cash = 100_000_000;
    while (buyUpgrade(s, 'cashier') === null);
    expect(checkoutCapacity(s)).toBe(7500);
    const before = warehouseCapacity(s);
    expect(buyUpgrade(s, 'logistics')).toBeNull();
    expect(warehouseCapacity(s)).toBe(before + 15000);
    expect(UPGRADE_BY_ID.shelves.costs.length).toBe(20);
  });

  it('succursales : niveau et trésorerie requis, revenu versé chaque soir selon la réputation', () => {
    const s = createNewGame(1);
    s.cash = 100_000;
    expect(buyBranch(s, 'gare')).toMatch(/Niveau 8/);
    s.level = 8;
    expect(buyBranch(s, 'gare')).toBeNull();
    expect(s.cash).toBe(100_000 - BRANCHES[0].cost);
    expect(buyBranch(s, 'gare')).toMatch(/déjà/);
    s.reputation = 100;
    expect(dailyBranchIncome(s)).toBeCloseTo(BRANCHES[0].income * branchRepFactor(100));
    expect(branchRepFactor(0)).toBeLessThan(branchRepFactor(100));
    const cash = s.cash;
    const { report } = runDay(s);
    expect(report.branchIncome).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThan(cash - 1000); // le revenu de la succursale compense les charges
  });
});
