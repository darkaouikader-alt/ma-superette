import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/state/store';
import { runDay, startNextDay } from '../src/systems/simulation';
import { addStock, expireStock, expiringBy, removeUnits, shelfQty, totalQty } from '../src/systems/stock';
import { autoReorder, placeOrders, setCartLots } from '../src/systems/suppliers';

function emptyGame() {
  const s = createNewGame(42);
  s.stock = {};
  s.slots.forEach((x) => { x.productId = null; x.qty = 0; });
  return s;
}

describe('péremption', () => {
  it('calcule la date limite à partir du jour de livraison et de la durée de vie', () => {
    const s = emptyGame();
    addStock(s, 'baguette', 10, 0.85, 3); // durée de vie 2 jours → vendable jours 3 et 4
    expect(s.stock.baguette[0].exp).toBe(4);
    addStock(s, 'pates', 10, 0.92, 3);
    expect(s.stock.pates[0].exp).toBeNull();
  });
  it('jette les lots périmés en fin de journée et les compte comme perte', () => {
    const s = emptyGame();
    addStock(s, 'baguette', 10, 0.85, 1); // exp = jour 2
    addStock(s, 'baguette', 6, 0.85, 2);  // exp = jour 3
    expect(expireStock(s, 1)).toEqual([]);
    expect(expiringBy(s, 'baguette', 2)).toBe(10);
    const lost = expireStock(s, 2);
    expect(lost).toEqual([{ productId: 'baguette', qty: 10, value: 8.5 }]);
    expect(totalQty(s, 'baguette')).toBe(6);
  });
  it('ne périme jamais les produits non périssables', () => {
    const s = emptyGame();
    addStock(s, 'riz', 20, 1.45, 1);
    expect(expireStock(s, 500)).toEqual([]);
    expect(totalQty(s, 'riz')).toBe(20);
  });
  it('vend les lots les plus anciens en premier (FIFO)', () => {
    const s = emptyGame();
    addStock(s, 'baguette', 5, 0.8, 2);
    addStock(s, 'baguette', 5, 1.0, 1);
    expect(removeUnits(s, 'baguette', 6)).toBeCloseTo(5 * 1.0 + 1 * 0.8);
    expect(s.stock.baguette).toEqual([{ qty: 4, exp: 3, cost: 0.8 }]);
  });
  it('retire aussi du rayon les unités périmées', () => {
    const s = emptyGame();
    addStock(s, 'baguette', 10, 0.85, 1);
    s.slots[0] = { productId: 'baguette', qty: 10 };
    expireStock(s, 2);
    expect(shelfQty(s, 'baguette')).toBe(0);
  });
  it('une journée complète jette les invendus périmés et les inscrit au bilan', () => {
    const s = emptyGame();
    addStock(s, 'baguette', 500, 0.85, 0); // exp = jour 1, bien plus que la demande
    s.slots[0] = { productId: 'baguette', qty: 40 };
    const { report } = runDay(s);
    expect(report.expired[0].productId).toBe('baguette');
    expect(report.waste).toBeGreaterThan(300);
    expect(totalQty(s, 'baguette')).toBe(0);
    expect(report.profit).toBeLessThan(0);
  });
});

describe('commandes', () => {
  it('livre après le délai du fournisseur et débite la trésorerie', () => {
    const s = createNewGame(7);
    const before = totalQty(s, 'pates');
    setCartLots(s, 'discount', 'pates', 1); // 12 unités, 3 jours
    const cash = s.cash;
    expect(placeOrders(s)).toBeNull();
    expect(s.cash).toBeLessThan(cash);
    expect(s.orders[0].arrivalDay).toBe(4);
    runDay(s); startNextDay(s);
    expect(s.orders.length).toBe(1);
    const afterDay1 = totalQty(s, 'pates');
    runDay(s); startNextDay(s);
    runDay(s); startNextDay(s);
    expect(s.day).toBe(4);
    expect(s.orders.length).toBe(0);
    expect(totalQty(s, 'pates')).toBeGreaterThanOrEqual(12);
    expect(before).toBeGreaterThanOrEqual(afterDay1);
  });
  it('applique la remise de volume et refuse une commande trop chère', () => {
    const s = createNewGame(7);
    setCartLots(s, 'dupont', 'pates', 5);
    placeOrders(s);
    expect(s.orders[0].lines[0].unitCost).toBeCloseTo(0.92 * 0.95, 2);
    s.cash = 5;
    setCartLots(s, 'dupont', 'riz', 10);
    expect(placeOrders(s)).toMatch(/Trésorerie/);
  });
  it('le réassort automatique remplit le panier avec les essentiels', () => {
    const s = createNewGame(7);
    expect(autoReorder(s, 'essentials')).toBeGreaterThan(3);
    expect(s.cart.every((c) => c.lots > 0)).toBe(true);
  });
});
