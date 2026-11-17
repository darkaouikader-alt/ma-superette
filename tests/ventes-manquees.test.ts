import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { createNewGame } from '../src/state/store';
import { runDay } from '../src/systems/simulation';
import { removeUnits, totalQty } from '../src/systems/stock';

describe('ventes manquées dans le bilan', () => {
  it('une rupture est comptée en « rupture », avec le chiffre d’affaires perdu', () => {
    const s = createNewGame(3);
    removeUnits(s, 'baguette', totalQty(s, 'baguette'));
    s.slots.forEach((x) => { if (x.productId === 'baguette') x.qty = 0; });
    const { report } = runDay(s);
    const l = report.lostSales!;
    expect(l.stock).toBeGreaterThan(10);
    expect(l.top[0].productId).toBe('baguette');
    expect(l.top[0].value).toBeCloseTo(l.top[0].units * s.prices.baguette, 1);
    expect(report.stockouts).toContain('baguette');
  });

  it('des prix abusifs sont comptés en « prix trop élevé »', () => {
    const s = createNewGame(3);
    for (const id of ['chips', 'chocolat', 'cola']) s.prices[id] = PRODUCT_BY_ID[id].market * 1.45;
    const l = runDay(s).report.lostSales!;
    expect(l.price).toBeGreaterThan(0);
  });

  it('un magasin bien approvisionné ne manque presque aucune vente', () => {
    const s = createNewGame(3);
    const l = runDay(s).report.lostSales!;
    expect(l.stock + l.price + l.queue).toBeLessThan(15);
    expect(l.value).toBeGreaterThanOrEqual(0);
  });
});
