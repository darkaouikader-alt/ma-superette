import { describe, expect, it } from 'vitest';
import { SHOPS } from '../src/data/shops';
import { createNewGame } from '../src/state/store';
import { dailyCharges, potentialCustomers, trafficMultiplier } from '../src/systems/economy';
import { runDay, startNextDay } from '../src/systems/simulation';
import {
  activeShop, buyShop, delegateBlock, delegateShop, forEachShop, shopCount, switchShop, takeBackShop,
} from '../src/systems/shops';
import { totalQty } from '../src/systems/stock';
import { parseSave } from '../src/state/save';

const rich = () => { const s = createNewGame(1); s.level = 8; s.cash = 1_000_000; return s; };

describe('magasins gérés', () => {
  it('acheter un magasin : niveau et trésorerie requis', () => {
    const s = createNewGame(1);
    s.cash = 100_000;
    expect(buyShop(s, SHOPS[0].id)).toMatch(/Niveau/);
    s.level = SHOPS[0].minLevel;
    expect(buyShop(s, SHOPS[0].id)).toBeNull();
    expect(s.cash).toBe(100_000 - SHOPS[0].cost);
    expect(shopCount(s)).toBe(2);
    expect(buyShop(s, SHOPS[0].id)).toMatch(/déjà/);
  });

  it('chaque magasin a ses rayons, son stock et ses prix ; la caisse est commune', () => {
    const s = rich();
    buyShop(s, 'tilleuls');
    const mainStock = totalQty(s, 'pates');
    expect(mainStock).toBeGreaterThan(0);
    s.prices.pates = 9;
    switchShop(s, 1);
    expect(activeShop(s).id).toBe('tilleuls');
    expect(totalQty(s, 'pates')).toBe(0); // nouveau magasin : vide
    expect(s.prices.pates).not.toBe(9);
    expect(s.slots.length).toBeGreaterThan(0);
    const cash = s.cash;
    switchShop(s, 0);
    expect(totalQty(s, 'pates')).toBe(mainStock);
    expect(s.prices.pates).toBe(9);
    expect(s.cash).toBe(cash);
  });

  it('un gérant seulement à partir de 2 magasins, et jamais tous les magasins', () => {
    const s = rich();
    expect(delegateBlock(s, 0)).toMatch(/au moins 2/);
    buyShop(s, 'tilleuls');
    expect(delegateShop(s, 1, 'junior')).toBeNull();
    expect(delegateBlock(s, 0)).toMatch(/au moins un/);
    expect(delegateShop(s, 0, 'expert')).toMatch(/au moins un/);
    // Changer de gérant reste possible.
    expect(delegateShop(s, 1, 'expert')).toBeNull();
    takeBackShop(s, 1);
    expect(delegateBlock(s, 0)).toBeNull();
  });

  it('le gérant fait tourner son magasin tout seul : commandes, rayons, ventes', () => {
    const s = rich();
    buyShop(s, 'tilleuls');
    delegateShop(s, 1, 'expert');
    let revenue = 0;
    for (let d = 0; d < 6; d++) {
      runDay(s);
      startNextDay(s);
      revenue += s.shops!.list[1].last?.revenue ?? 0;
    }
    expect(revenue).toBeGreaterThan(0);
    expect(activeShop(s).id).toBe('main'); // on revient toujours au magasin affiché
  });

  it('le grade du gérant : rendement et salaire', () => {
    const s = rich();
    buyShop(s, 'tilleuls');
    switchShop(s, 1);
    const t = trafficMultiplier(s), c = dailyCharges(s).salaries;
    delegateShop(s, 1, 'junior');
    expect(trafficMultiplier(s)).toBeCloseTo(t * 0.82);
    expect(dailyCharges(s).salaries).toBeGreaterThan(c);
    delegateShop(s, 1, 'expert');
    expect(trafficMultiplier(s)).toBeCloseTo(t);
    expect(potentialCustomers(s)).toBeGreaterThan(0);
  });

  it('la journée compte tous les magasins dans le bénéfice et l’XP', () => {
    const a = rich(), b = rich();
    buyShop(b, 'tilleuls');
    delegateShop(b, 1, 'expert');
    b.cash = a.cash;
    for (let d = 0; d < 3; d++) { runDay(a); startNextDay(a); runDay(b); startNextDay(b); }
    const { report } = runDay(b);
    expect(report.shops).toHaveLength(1);
    expect(b.xp).toBeGreaterThan(a.xp);
  });

  it('sauvegarde et rechargement : chaque magasin garde ses propres données', () => {
    const s = rich();
    s.upgrades.buyer = 1;
    s.buyer = { enabled: true, coverDays: 3, reserve: 500 };
    buyShop(s, 'tilleuls');
    const loaded = parseSave(createNewGame(2), JSON.stringify(s))!;
    switchShop(loaded, 1);
    expect(loaded.buyer).toBeUndefined();
    expect(loaded.upgrades.buyer).toBeUndefined();
    switchShop(loaded, 0);
    expect(loaded.buyer?.enabled).toBe(true);
  });

  it('bilan : résultat de chaque magasin séparé, total de l’enseigne cohérent', () => {
    const s = rich();
    buyShop(s, 'tilleuls');
    delegateShop(s, 1, 'expert');
    runDay(s); startNextDay(s);
    const { report: r } = runDay(s);
    expect(r.shopId).toBe('main');
    expect(r.shops?.map((o) => o.id)).toEqual(['tilleuls']);
    const others = r.shops!.reduce((t, o) => t + o.profit, 0);
    expect(r.profit).toBeCloseTo(r.shopProfit! + others + (r.branchIncome ?? 0) - r.interest, 1);
    expect(r.shops![0].repAfter).toBeTypeOf('number');
  });

  it('forEachShop revient au magasin affiché même en cas d’erreur', () => {
    const s = rich();
    buyShop(s, 'tilleuls');
    switchShop(s, 1);
    expect(() => forEachShop(s, () => { throw new Error('x'); })).toThrow();
    expect(activeShop(s).id).toBe('tilleuls');
  });
});
