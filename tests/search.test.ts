import { describe, expect, it } from 'vitest';
import { PRODUCT_BY_ID } from '../src/data/products';
import { matchesSearch, norm, rowVisible, searchKey } from '../src/ui/search';

describe('recherche de produits', () => {
  it('ignore les majuscules et les accents', () => {
    expect(norm('Œufs ÉPICERIE Crème')).toBe('oeufs epicerie creme');
    expect(matchesSearch(searchKey(PRODUCT_BY_ID.oeufs), 'oeuf')).toBe(true);
    expect(matchesSearch(searchKey(PRODUCT_BY_ID.creme), 'creme')).toBe(true);
  });
  it('cherche aussi dans le nom de la catégorie, et tous les mots doivent correspondre', () => {
    expect(matchesSearch(searchKey(PRODUCT_BY_ID.pates), 'epicerie')).toBe(true);
    expect(matchesSearch(searchKey(PRODUCT_BY_ID.pates), 'pates 500')).toBe(true);
    expect(matchesSearch(searchKey(PRODUCT_BY_ID.pates), 'pates riz')).toBe(false);
  });
  it('une recherche montre les produits de toutes les catégories ; sans recherche, le filtre habituel s’applique', () => {
    const key = searchKey(PRODUCT_BY_ID.chips);
    expect(rowVisible(key, false, 'chips')).toBe(true);
    expect(rowVisible(key, false, '')).toBe(false);
    expect(rowVisible(key, true, '')).toBe(true);
    expect(rowVisible(key, true, 'baguette')).toBe(false);
  });
});
