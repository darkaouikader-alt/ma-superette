import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { createNewGame } from '../src/state/store';
import { addXp, isNewProduct, sellableProducts } from '../src/systems/progression';
import { runDay, startNextDay } from '../src/systems/simulation';

describe('produits « Nouveau »', () => {
  it('les produits du départ ne sont jamais marqués nouveaux', () => {
    const s = createNewGame(4);
    expect(sellableProducts(s).some((p) => isNewProduct(p, s))).toBe(false);
  });

  it('un produit débloqué pendant le bilan est nouveau les 3 jours suivants, puis ne l’est plus', () => {
    const s = createNewGame(4);
    runDay(s); // jour 1 terminé, phase « bilan »
    addXp(s, 1000); // passage au niveau 2 pendant le bilan
    const painDeMie = PRODUCT_BY_ID.pain_mie;
    expect(s.sellableSince.pain_mie).toBe(2);
    const seen: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      startNextDay(s); // jours 2, 3, 4, 5
      seen.push(isNewProduct(painDeMie, s));
      runDay(s);
    }
    expect(seen).toEqual([true, true, true, false]);
  });

  it('un produit débloqué le matin (ex. licence achetée) est nouveau à partir du jour même', () => {
    const s = createNewGame(4);
    s.day = 6;
    addXp(s, 1000);
    expect(isNewProduct(PRODUCT_BY_ID.pain_mie, s)).toBe(true);
    expect(isNewProduct(PRODUCT_BY_ID.baguette, s)).toBe(false);
  });
});
