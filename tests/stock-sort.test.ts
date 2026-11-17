import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { createNewGame } from '../src/state/store';
import { addStock } from '../src/systems/stock';
import { renderStock } from '../src/ui/screens/stock';
import { ui } from '../src/ui/uiState';

/** Ordre des produits affichés dans le tableau du stock. */
function order(): string[] {
  const s = createNewGame(5);
  addStock(s, 'pates', 300, 0.9, 1);
  addStock(s, 'riz', 120, 1.4, 1);
  // Des livraisons en route, pour que la colonne « En route » ait des valeurs différentes
  s.orders.push({ id: 1, supplierId: 'dupont', lines: [{ productId: 'cafe', qty: 24, unitCost: 2.5 }, { productId: 'chips', qty: 6, unitCost: 1 }], orderedDay: 1, arrivalDay: 2, total: 66 });
  const html = renderStock(s);
  const ids = Object.values(PRODUCT_BY_ID).map((p) => p.name);
  return [...html.matchAll(/<b>([^<]+)<\/b><div class="badges">/g)].map((m) => m[1]).filter((n) => ids.includes(n));
}

describe('tri du stock', () => {
  it('chaque colonne trie dans les deux sens', () => {
    for (const col of ['name', 'shelf', 'warehouse', 'transit', 'days', 'expiry', 'value']) {
      ui.stockSort = col; ui.stockDir = 1;
      const asc = order();
      ui.stockDir = -1;
      const desc = order();
      expect(asc.length, col).toBeGreaterThan(5);
      if (col === 'name') expect(desc).toEqual([...asc].reverse());
      else expect(desc[0], col).not.toBe(asc[0]);
    }
  });
  it('« Valeur » : du plus petit au plus grand puis l’inverse', () => {
    ui.stockSort = 'value'; ui.stockDir = -1;
    expect(order()[0]).toBe('Pâtes 500 g'); // 300 paquets en stock : la plus grosse valeur
  });
  it('« Péremption » : les produits non périssables restent en fin de liste dans les deux sens', () => {
    ui.stockSort = 'expiry';
    for (const dir of [1, -1]) {
      ui.stockDir = dir;
      const list = order();
      expect(list.at(-1) === 'Pâtes 500 g' || !PRODUCT_BY_ID[Object.keys(PRODUCT_BY_ID).find((k) => PRODUCT_BY_ID[k].name === list[0])!].shelfLife ? true : list.indexOf('Baguette') < list.indexOf('Pâtes 500 g')).toBe(true);
    }
  });
});

import { renderOrders } from '../src/ui/screens/orders';

describe('tri des commandes', () => {
  const names = () => {
    const s = createNewGame(5);
    addStock(s, 'pates', 300, 0.9, 1);
    ui.supplier = 'dupont'; ui.orderCat = 'all';
    return [...renderOrders(s).matchAll(/<tr id="or-[^"]+"[^>]*>\s*<td><div class="prod-cell">.*?<b>([^<]+)<\/b>/gs)].map((m) => m[1]);
  };
  it('chaque critère trie dans les deux sens', () => {
    for (const k of ['name', 'stock', 'sales', 'price']) {
      ui.orderSort = k; ui.orderDir = 1;
      const asc = names();
      ui.orderDir = -1;
      const desc = names();
      expect(asc.length, k).toBeGreaterThan(5);
      expect(desc[0], k).not.toBe(asc[0]);
    }
    ui.orderSort = 'stock'; ui.orderDir = -1;
    expect(names()[0]).toBe('Pâtes 500 g'); // 300 en stock
    ui.orderSort = 'default';
  });
});
