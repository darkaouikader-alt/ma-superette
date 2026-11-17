import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { createNewGame } from '../src/state/store';
import type { GameState } from '../src/state/types';
import { addUrgentToCart, bestChoice, buyerSettings, ruptureProducts, runBuyer } from '../src/systems/buyer';
import { addStock, removeUnits, totalQty } from '../src/systems/stock';
import { daysUntilEmpty, inTransit } from '../src/systems/suppliers';

/** Partie de niveau 5 avec le responsable des achats et de la trésorerie. */
function richGame(): GameState {
  const s = createNewGame(11);
  s.level = 5;
  s.upgrades.buyer = 1;
  s.cash = 5000;
  return s;
}

describe('achats rapides', () => {
  it('liste les produits en rupture et les met au panier', () => {
    const s = createNewGame(2);
    removeUnits(s, 'pates', totalQty(s, 'pates'));
    removeUnits(s, 'riz', totalQty(s, 'riz'));
    const rupt = ruptureProducts(s).map((p) => p.id);
    expect(rupt).toEqual(expect.arrayContaining(['pates', 'riz']));
    const r = addUrgentToCart(s, ruptureProducts(s));
    expect(r.added).toBe(rupt.length);
    expect(s.cart.map((c) => c.productId)).toEqual(expect.arrayContaining(['pates', 'riz']));
  });
  it('ne dépasse pas la trésorerie', () => {
    const s = createNewGame(2);
    for (const p of ['pates', 'riz', 'eau', 'pq']) removeUnits(s, p, totalQty(s, p));
    s.cash = 15;
    const r = addUrgentToCart(s, ruptureProducts(s));
    expect(r.skipped).toBeGreaterThan(0);
  });
});

describe('responsable des achats', () => {
  it('ne fait rien tant qu’il n’est pas embauché, ni quand il est en pause', () => {
    const s = createNewGame(3);
    expect(runBuyer(s)).toBeNull();
    const r = richGame();
    buyerSettings(r).enabled = false;
    expect(runBuyer(r)).toBeNull();
  });

  it('attend tant que ce n’est pas nécessaire, puis prend le moins cher qui livre à temps', () => {
    const s = richGame();
    addStock(s, 'pates', 300, 0.9, s.day); // stock pour de nombreux jours
    expect(bestChoice(s, PRODUCT_BY_ID.pates, 1.5)).toBeNull(); // pas encore besoin de commander
    // On vide le stock jusqu'à ce qu'il ne tienne plus que 3 jours : dernier moment pour Cash Éco (3 jours de délai)
    while (daysUntilEmpty(s, PRODUCT_BY_ID.pates) > 3) removeUnits(s, 'pates', 1);
    const c = bestChoice(s, PRODUCT_BY_ID.pates, 1.5)!;
    expect(c.sup.id).toBe('discount'); // Cash Éco : −12 %, livré juste à temps
  });

  it('prend le plus rapide en cas de rupture', () => {
    const s = richGame();
    removeUnits(s, 'pates', totalQty(s, 'pates'));
    const c = bestChoice(s, PRODUCT_BY_ID.pates, 1.5)!;
    expect(c.sup.id).toBe('dupont'); // livre demain
  });

  it('commande ce qui manque, garde la réserve en caisse, et s’arrête quand tout est couvert', () => {
    const s = richGame();
    buyerSettings(s).reserve = 4000;
    const r = runBuyer(s)!;
    expect(r.products).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThanOrEqual(4000);
    expect(inTransit(s, 'pates')).toBeGreaterThan(0);
    // 2e passage : il peut précommander la suite chez des fournisseurs moins chers…
    runBuyer(s);
    const lines = s.orders.flatMap((o) => o.lines.map((l) => `${l.productId}@${o.supplierId}`));
    expect(new Set(lines).size).toBe(lines.length); // jamais deux fois le même produit chez le même fournisseur
    // … puis tout est couvert : il ne commande plus rien.
    expect(runBuyer(s)!.products).toBe(0);
  });

  it('ne commande jamais plus de pain que ce qui se vend avant péremption', () => {
    const s = richGame();
    buyerSettings(s).coverDays = 5;
    removeUnits(s, 'baguette', totalQty(s, 'baguette'));
    const c = bestChoice(s, PRODUCT_BY_ID.baguette, 5 / 2)!;
    const perDay = 50; // ordre de grandeur des ventes de baguettes au niveau 5
    expect(c.lots * c.sup.lotSize).toBeLessThan(perDay * 2);
  });
});
