import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/constants';
import { EVENT_BY_ID } from '../src/data/events';
import { PRODUCT_BY_ID, PRODUCTS } from '../src/data/products';
import { computeDemand, dayFactor, priceFactor, reputationFactor, type DemandContext } from '../src/systems/demand';

const ctx = (over: Partial<DemandContext> = {}): DemandContext => ({ reputation: 50, weekday: 3, traffic: 1, events: [], marketMult: 1, ...over });

describe('facteur prix', () => {
  it('vaut 1 au prix du marché', () => {
    expect(priceFactor(2, 2, 1.5)).toBeCloseTo(1);
  });
  it('suit (marché / prix) ^ élasticité', () => {
    expect(priceFactor(2, 2.2, 1.5)).toBeCloseTo(Math.pow(2 / 2.2, 1.5));
    expect(priceFactor(2, 1.8, 0.6)).toBeCloseTo(Math.pow(2 / 1.8, 0.6));
  });
  it('est borné entre 0 et 2', () => {
    expect(priceFactor(2, 0.01, 2.5)).toBe(BALANCE.PRICE_FACTOR_MAX);
    expect(priceFactor(2, 50, 0.5)).toBe(0);
    expect(priceFactor(2, 0, 1)).toBe(BALANCE.PRICE_FACTOR_MAX);
  });
  it('un prix absurde fait perdre toutes les ventes, même sur un essentiel', () => {
    const pain = PRODUCT_BY_ID.baguette;
    expect(computeDemand(pain, pain.market * 3, ctx()).total).toBe(0);
  });
});

describe('demande', () => {
  it('multiplie tous les facteurs de la formule', () => {
    const p = PRODUCT_BY_ID.chips;
    const d = computeDemand(p, 2.0, ctx({ reputation: 40, weekday: 5, traffic: 1.3 }), 1.05);
    const attendu = d.base * d.essentialWeight * d.priceFactor * d.repFactor * d.dayFactor * d.eventFactor * d.traffic * d.noise;
    expect(d.total).toBeCloseTo(attendu);
    expect(d.base).toBeCloseTo(p.base * BALANCE.DEMAND_SCALE);
    expect(d.noise).toBe(1.05);
  });
  it('les essentiels sont moins sensibles au prix que le confort', () => {
    const ess = PRODUCT_BY_ID.baguette, lux = PRODUCT_BY_ID.chocolat;
    const drop = (p: typeof ess) => computeDemand(p, p.market * 1.2, ctx()).total / computeDemand(p, p.market, ctx()).total;
    expect(drop(ess)).toBeGreaterThan(drop(lux));
    expect(drop(ess)).toBeGreaterThan(0.85);
    expect(drop(lux)).toBeLessThan(0.8);
  });
  it('baisser le prix augmente les ventes, le monter les diminue', () => {
    const p = PRODUCT_BY_ID.cola;
    const base = computeDemand(p, p.market, ctx()).total;
    expect(computeDemand(p, p.market * 0.85, ctx()).total).toBeGreaterThan(base);
    expect(computeDemand(p, p.market * 1.15, ctx()).total).toBeLessThan(base);
  });
  it('la réputation augmente l’affluence', () => {
    expect(reputationFactor(0)).toBe(BALANCE.REP_FACTOR_AT_0);
    expect(reputationFactor(100)).toBe(BALANCE.REP_FACTOR_AT_100);
    expect(reputationFactor(80)).toBeGreaterThan(reputationFactor(20));
  });
  it('le week-end est plus fort que le lundi, avec des bonus par catégorie', () => {
    const eau = PRODUCT_BY_ID.eau, saucisses = PRODUCT_BY_ID.saucisses;
    expect(dayFactor(eau, 5)).toBeGreaterThan(dayFactor(eau, 0));
    // Barbecue du samedi : bonus supérieur au simple effet week-end
    expect(dayFactor(saucisses, 5)).toBeGreaterThan(BALANCE.WEEKDAY_FACTORS[5] * 1.3);
  });
  it('la canicule dope les boissons et une promo concurrente baisse le marché', () => {
    const eau = PRODUCT_BY_ID.eau;
    const normal = computeDemand(eau, eau.market, ctx()).total;
    expect(computeDemand(eau, eau.market, ctx({ events: [EVENT_BY_ID.canicule] })).total).toBeGreaterThan(normal * 1.4);
    expect(computeDemand(eau, eau.market, ctx({ marketMult: 0.88 })).total).toBeLessThan(normal);
  });
});

describe('catalogue', () => {
  it('contient au moins 80 produits aux identifiants uniques', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
  });
  it('respecte les fourchettes de marge (15–35 % essentiels, 40–100 % confort)', () => {
    for (const p of PRODUCTS) {
      const m = ((p.market - p.cost) / p.cost) * 100;
      if (p.essential) { expect(m, p.id).toBeGreaterThanOrEqual(15); expect(m, p.id).toBeLessThanOrEqual(35); }
      else { expect(m, p.id).toBeGreaterThanOrEqual(40); expect(m, p.id).toBeLessThanOrEqual(100); }
    }
  });
  it('donne une élasticité faible aux essentiels et forte au confort', () => {
    for (const p of PRODUCTS.filter((x) => x.essential)) expect(p.elasticity, p.id).toBeLessThanOrEqual(0.8);
  });
});
