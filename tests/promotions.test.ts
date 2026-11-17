import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/constants';
import { PRODUCT_BY_ID } from '../src/data/products';
import { createNewGame } from '../src/state/store';
import { demandFor, potentialCustomers, salePrice } from '../src/systems/economy';
import { expirePromotions, launchCampaign, promoSlots, startPromo } from '../src/systems/promotions';
import { runDay, startNextDay } from '../src/systems/simulation';
import { autoReorder } from '../src/systems/suppliers';
import { SUPPLIER_BY_ID } from '../src/data/suppliers';

describe('promotions', () => {
  it('applique la réduction au prix payé par le client', () => {
    const s = createNewGame(1);
    s.prices.chips = 2.0;
    expect(startPromo(s, 'chips', 20, 3)).toBeNull();
    expect(salePrice(s, PRODUCT_BY_ID.chips)).toBe(1.6);
    expect(salePrice(s, PRODUCT_BY_ID.chips, s.day + 3)).toBe(2.0); // promo terminée
  });
  it('augmente la demande du produit et le nombre de clients', () => {
    const s = createNewGame(1);
    const before = demandFor(s, PRODUCT_BY_ID.chips).total;
    const clients = potentialCustomers(s);
    startPromo(s, 'chips', 20, 1);
    const d = demandFor(s, PRODUCT_BY_ID.chips);
    expect(d.promoFactor).toBeCloseTo(1 + BALANCE.PROMO_VISIBILITY);
    expect(d.total).toBeGreaterThan(before * 1.5);
    expect(potentialCustomers(s)).toBeGreaterThan(clients);
  });
  it('limite le nombre de promos simultanées', () => {
    const s = createNewGame(1);
    const ids = ['chips', 'chocolat', 'cola', 'cafe', 'pates'];
    const results = ids.map((id) => startPromo(s, id, 10, 1));
    expect(results.filter((r) => r === null).length).toBe(promoSlots(s));
  });
  it('les promos et campagnes expirent et sont annoncées', () => {
    const s = createNewGame(1);
    startPromo(s, 'chips', 10, 1);
    s.cash = 1000;
    expect(launchCampaign(s, 'prospectus')).toBeNull();
    expect(launchCampaign(s, 'prospectus')).toMatch(/déjà/);
    s.day = 2;
    expect(expirePromotions(s).some((n) => n.includes('Chips'))).toBe(true);
    expect(s.promos).toHaveLength(0);
    expect(s.campaigns).toHaveLength(1); // prospectus : 3 jours
  });
  it('une campagne coûte de l’argent et attire plus de clients sur la journée', () => {
    const a = createNewGame(9), b = createNewGame(9);
    b.cash = 1000; a.cash = 1000;
    launchCampaign(b, 'prospectus');
    expect(b.cash).toBeLessThan(1000);
    expect(runDay(b).report.customersPotential).toBeGreaterThan(runDay(a).report.customersPotential);
  });
});

describe('réassort automatique par fournisseur', () => {
  it('ne commande que chez le fournisseur sélectionné', () => {
    const s = createNewGame(3);
    runDay(s); startNextDay(s);
    const n = autoReorder(s, 'all', 'fraicheur');
    expect(n).toBeGreaterThan(0);
    expect(s.cart.every((c) => c.supplierId === 'fraicheur')).toBe(true);
    expect(s.cart.every((c) => SUPPLIER_BY_ID.fraicheur.categories.includes(PRODUCT_BY_ID[c.productId].cat))).toBe(true);
  });
  it('ne recommande pas un produit déjà dans le panier chez un autre fournisseur', () => {
    const s = createNewGame(3);
    autoReorder(s, 'all', 'dupont');
    const dupont = s.cart.length;
    autoReorder(s, 'all', 'discount');
    const ids = s.cart.map((c) => c.productId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.cart.length).toBeGreaterThanOrEqual(dupont);
  });
});
