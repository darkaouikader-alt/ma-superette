// Simulation d'une journée : génère les clients, leurs paniers, les ventes,
// puis clôture la journée (charges, péremption, réputation, XP, objectifs).
// Retourne aussi une « timeline » que l'interface rejoue en animation.
import { BALANCE } from '../data/constants';
import { PRODUCT_BY_ID } from '../data/products';
import { SUPPLIER_BY_ID } from '../data/suppliers';
import type { DayReport, GameState, Product } from '../state/types';
import { computeDemand, reputationFactor, weekdayFactor } from './demand';
import { activeCampaigns, activePromos, canTakeLoan, checkoutCapacity, dailyCharges, salePrice, demandContext, payLoan, round2, up } from './economy';
import { activeEvents, rollEvents, weatherFor } from './events';
import { addXp, ensureObjectives, evaluateObjectives, expectedEssentials, refreshSellable, sellableProducts } from './progression';
import { computeReputation } from './reputation';
import { makeRng, stochRound } from './rng';
import { assortment, expireStock, fillAll, sellFromShelf, shelfCapacityFor, shelfQty, slotCapacity, totalQty, warehouseQty, coldCapacity, coldUsed } from './stock';
import { receiveDeliveries } from './suppliers';
import { expirePromotions } from './promotions';
import { charmSummary, checkDecorUnlocks } from './decor';

export interface SimSale { pid: string; qty: number; amount: number }
export interface SimEvent {
  t: number;
  sales: SimSale[];
  missed: string[];
  refused: string[];
  /** Regarnissage par l'employé : nouvelles quantités en rayon. */
  restock?: Record<string, number>;
}
export interface DayOutcome {
  report: DayReport;
  timeline: SimEvent[];
  opening: Record<string, { qty: number; cap: number }>;
}

/** Produits qui génèrent de la demande aujourd'hui : essentiels attendus + assortiment en rayon. */
export function demandProducts(state: GameState): Product[] {
  const inRayon = assortment(state);
  const set = new Set<Product>(expectedEssentials(state));
  for (const p of sellableProducts(state)) if (inRayon.has(p.id)) set.add(p);
  return [...set];
}

function shelfSnapshot(state: GameState): Record<string, number> {
  const snap: Record<string, number> = {};
  for (const s of state.slots) if (s.productId) snap[s.productId] = (snap[s.productId] ?? 0) + s.qty;
  return snap;
}

export function runDay(state: GameState): DayOutcome {
  const B = BALANCE;
  const day = state.day;
  const rng = makeRng(state.seed + day * 7919);
  const ctx = demandContext(state, day);
  const weather = weatherFor(state, day);
  const repBefore = state.reputation;
  const levelBefore = state.level;
  const hasStocker = up(state, 'stocker') > 0;

  if (hasStocker) fillAll(state);
  const opening: DayOutcome['opening'] = {};
  for (const pid of assortment(state)) opening[pid] = { qty: shelfQty(state, pid), cap: shelfCapacityFor(state, pid) };
  const emptyFraction = state.slots.filter((s) => !s.productId || s.qty === 0).length / Math.max(1, state.slots.length);

  // ── Affluence ──
  const nPot = Math.max(1, Math.round(
    B.BASE_CUSTOMERS * ctx.traffic * reputationFactor(ctx.reputation) * weekdayFactor(ctx.weekday) * (1 + (rng() * 2 - 1) * 0.05),
  ));
  const served = Math.min(nPot, checkoutCapacity(state));
  const queueLost = nPot - served;

  // ── Paniers ──
  interface Item { p: Product; ok: boolean }
  const baskets: Item[][] = Array.from({ length: served }, () => []);
  const prods = demandProducts(state);
  const inRayon = assortment(state);
  let ratioSum = 0;
  let ratioWeight = 0;
  for (const p of prods) {
    const price = salePrice(state, p, day);
    const noise = 1 + (rng() * 2 - 1) * B.DEMAND_NOISE;
    const d = computeDemand(p, price, ctx, noise);
    const wants = stochRound(Math.max(d.total, d.neutral), rng);
    const keep = d.total >= d.neutral ? 1 : d.neutral > 0 ? d.total / d.neutral : 0;
    for (let u = 0; u < wants; u++) {
      const c = Math.floor(rng() * nPot);
      if (c >= served) continue; // client reparti à cause de la file
      baskets[c].push({ p, ok: keep >= 1 || rng() < keep });
    }
    if (inRayon.has(p.id)) {
      const w = d.neutral * (p.essential ? 2 : 1);
      ratioSum += (price / d.market) * w;
      ratioWeight += w;
    }
  }

  // ── Passage des clients ──
  const timeline: SimEvent[] = [];
  const sales: DayReport['sales'] = {};
  const missedUnits: Record<string, number> = {};
  const cogsBy: Record<string, number> = {};
  const refills = hasStocker ? B.STOCKER_REFILLS.slice() : [];
  let revenue = 0, cogs = 0, unitsSold = 0;
  let customersServed = 0, disappointedStock = 0, disappointedPrice = 0;
  let essWanted = 0, essSold = 0, otherWanted = 0, otherMissed = 0;

  for (let c = 0; c < served; c++) {
    const t = (c + rng()) / served;
    while (refills.length && t >= refills[0]) {
      refills.shift();
      if (fillAll(state) > 0) timeline.push({ t, sales: [], missed: [], refused: [], restock: shelfSnapshot(state) });
    }
    const basket = baskets[c];
    if (!basket.length) continue;
    basket.sort((a, b) => Number(b.p.essential) - Number(a.p.essential));
    const ev: SimEvent = { t, sales: [], missed: [], refused: [] };
    let bought = 0, missEss = false, missAny = false;
    for (const it of basket) {
      const pid = it.p.id;
      if (!it.ok) { if (!ev.refused.includes(pid)) ev.refused.push(pid); continue; }
      if (it.p.essential) essWanted++; else otherWanted++;
      const cost = sellFromShelf(state, pid);
      if (cost === null) {
        missedUnits[pid] = (missedUnits[pid] ?? 0) + 1;
        if (!ev.missed.includes(pid)) ev.missed.push(pid);
        missAny = true;
        if (it.p.essential) missEss = true; else otherMissed++;
        continue;
      }
      const price = salePrice(state, it.p, day);
      bought++; unitsSold++;
      revenue += price; cogs += cost;
      cogsBy[pid] = (cogsBy[pid] ?? 0) + cost;
      if (it.p.essential) essSold++;
      const s = (sales[pid] ??= { units: 0, revenue: 0 });
      s.units++; s.revenue = round2(s.revenue + price);
      const line = ev.sales.find((x) => x.pid === pid);
      if (line) { line.qty++; line.amount = round2(line.amount + price); }
      else ev.sales.push({ pid, qty: 1, amount: price });
    }
    if (bought > 0) customersServed++;
    if (missEss || (bought === 0 && missAny)) disappointedStock++;
    if (ev.refused.length) disappointedPrice++;
    timeline.push(ev);
  }
  timeline.sort((a, b) => a.t - b.t);
  revenue = round2(revenue); cogs = round2(cogs);

  // ── Clôture ──
  const charges = dailyCharges(state);
  const expired = expireStock(state, day);
  const waste = round2(expired.reduce((s, e) => s + e.value, 0));
  state.cash = round2(state.cash + revenue - charges.total);
  const interest = payLoan(state);
  const profit = round2(revenue - cogs - charges.total - waste - interest);

  const stockouts = Object.keys(missedUnits);
  const essentialStockouts = stockouts.filter((id) => PRODUCT_BY_ID[id]?.essential);

  const decorCharm = charmSummary(state);
  const rep = computeReputation({
    reputation: repBefore,
    essentialWanted: essWanted, essentialSold: essSold,
    priceRatio: ratioWeight > 0 ? ratioSum / ratioWeight : 1,
    wasteValue: waste, revenue, emptyFraction,
    queueFraction: queueLost / nPot,
    missingFraction: otherWanted > 0 ? otherMissed / otherWanted : 0,
    decoLevel: up(state, 'deco'),
    bonus: [
      ...(decorCharm.rep > 0 ? [{ label: 'Façade attrayante', delta: decorCharm.rep }] : []),
      ...activeCampaigns(state, day).filter((c) => c.def.rep).map((c) => ({ label: `${c.def.name}`, delta: c.def.rep! })),
      ...(activePromos(state, day).some((x) => PRODUCT_BY_ID[x.productId]?.essential) ? [{ label: 'Promos sur les essentiels', delta: BALANCE.PROMO_REP_ESSENTIAL }] : []),
    ],
  });
  state.reputation = rep.after;

  // Historiques de ventes (14 jours)
  const tracked = new Set([...prods.map((p) => p.id), ...Object.keys(state.salesHistory)]);
  for (const pid of tracked) {
    const sold = sales[pid]?.units ?? 0;
    const sh = (state.salesHistory[pid] ??= []);
    const dh = (state.demandHistory[pid] ??= []);
    sh.push(sold); dh.push(sold + (missedUnits[pid] ?? 0));
    if (sh.length > 14) sh.shift();
    if (dh.length > 14) dh.shift();
    if (sold > 0) {
      const ps = (state.productStats[pid] ??= { units: 0, revenue: 0, cogs: 0 });
      ps.units += sold; ps.revenue = round2(ps.revenue + sales[pid].revenue);
      ps.cogs = round2(ps.cogs + (cogsBy[pid] ?? 0));
    }
  }
  state.totals.revenue = round2(state.totals.revenue + revenue);
  state.totals.profit = round2(state.totals.profit + profit);
  state.totals.customers += customersServed;
  state.totals.waste = round2(state.totals.waste + waste);
  state.totals.bestProfit = Math.max(state.totals.bestProfit, profit);
  state.totals.noWasteStreak = expired.length === 0 ? (state.totals.noWasteStreak ?? 0) + 1 : 0;
  state.objectives.essentialStreak = essentialStockouts.length === 0 && essWanted > 0 ? state.objectives.essentialStreak + 1 : 0;

  const xpBefore = state.xp;
  addXp(state, revenue * B.XP_PER_EURO + state.reputation * B.XP_PER_REP_POINT);

  const report: DayReport = {
    day, revenue, cogs,
    rent: charges.rent, electricity: charges.electricity, salaries: charges.salaries,
    waste, interest, profit, cashEnd: state.cash,
    customersPotential: nPot, customersServed, disappointedStock, disappointedPrice, queueLost,
    unitsSold, stockouts, essentialStockouts, expired,
    repBefore, repAfter: state.reputation, repDetails: rep.details,
    xpGained: 0, levelBefore, levelAfter: state.level,
    objectivesDone: [], sales,
    eventIds: activeEvents(state, day).map((e) => e.id), weather: weather.icon,
  };
  state.history.push(report);
  if (state.history.length > B.HISTORY_DAYS) state.history.shift();
  report.objectivesDone = evaluateObjectives(state, report);
  report.decorUnlocked = checkDecorUnlocks(state).map((p) => p.id);
  report.xpGained = state.xp - xpBefore;
  report.levelAfter = state.level;
  report.cashEnd = state.cash;

  state.phase = 'report';
  state.lastReport = report;
  return { report, timeline, opening };
}

/** Passe au matin suivant : livraisons, événements, objectifs, placement automatique. */
export function startNextDay(state: GameState): void {
  state.day++;
  state.phase = 'morning';
  const news: string[] = [];
  for (const o of receiveDeliveries(state)) {
    const n = o.lines.reduce((s, l) => s + l.qty, 0);
    news.push(`🚚 Livraison de ${SUPPLIER_BY_ID[o.supplierId]?.name ?? 'fournisseur'} : ${n} articles reçus.`);
  }
  news.push(...expirePromotions(state));
  news.push(...rollEvents(state, makeRng(state.seed * 13 + state.day * 331)));
  refreshSellable(state);
  ensureObjectives(state);
  if (up(state, 'stocker') > 0) stockerPlacement(state);
  if (state.loan) news.push(`🏦 Prêt en cours : ${state.loan.remaining.toFixed(2).replace('.', ',')} € restants.`);
  if (state.cash < BALANCE.LOAN_TRIGGER_CASH && canTakeLoan(state)) news.push('🏦 Caisse à sec : un prêt d’urgence est proposé plus bas sur cette page.');
  state.morningNews = news;
}

/** L'employé place en rayon les produits en stock qui n'ont pas d'emplacement, puis remplit tout. */
export function stockerPlacement(state: GameState): void {
  const inRayon = assortment(state);
  for (const p of sellableProducts(state)) {
    if (inRayon.has(p.id) || warehouseQty(state, p.id) <= 0 || totalQty(state, p.id) <= 0) continue;
    if (p.storage !== 'ambient' && coldUsed(state, p.storage) >= coldCapacity(state, p.storage)) continue;
    const free = state.slots.find((s) => !s.productId);
    if (!free) break;
    free.productId = p.id;
    free.qty = 0;
  }
  fillAll(state);
}

export { slotCapacity };
