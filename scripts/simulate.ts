// Bot d'équilibrage : joue N jours « raisonnablement » sans interface.
//   npm run simulate            → 10 jours
//   npm run simulate -- 60 1.4  → 60 jours, tous les prix à 140 % du marché
import { CATEGORIES } from '../src/data/categories';
import { UPGRADES } from '../src/data/upgrades';
import { createNewGame } from '../src/state/store';
import { expectedDemand, suggestedPrice, roundPrice, takeLoan, canTakeLoan } from '../src/systems/economy';
import { buyLicence, buyUpgrade, categoryLevel, checkLongObjectives, sellableProducts, upgradeCost } from '../src/systems/progression';
import { runDay, startNextDay } from '../src/systems/simulation';
import { autoArrange, totalQty } from '../src/systems/stock';
import { autoReorder, fastestSupplier, placeOrders, setCartLots, inTransit, cartView, storageCommitted, storageCapacity } from '../src/systems/suppliers';
import { BALANCE, WEEKDAYS } from '../src/data/constants';
import { DECOR_PARTS, DECOR_SLOTS } from '../src/data/decor';
import { canEquip, charmSummary, checkDecorUnlocks, equipPart, partCharm } from '../src/systems/decor';

const days = Number(process.argv[2] ?? 10);
const priceMult = Number(process.argv[3] ?? 1);
const mode = process.argv[4] ?? 'normal'; // 'lazy' = ignore les essentiels
const state = createNewGame(12345);

const pad = (v: string | number, n: number) => String(v).padStart(n);
console.log(`Simulation ${days} jours — prix × ${priceMult} — mode ${mode}\n`);
console.log(' Jour      | Clients (déçus) |     CA |  Marge | Charges | Pertes | Bénéf. | Tréso  | Rép. | Niv | Notes');

for (let i = 0; i < days; i++) {
  let orderErr = '';
  const cashMorning = state.cash;
  // 1. Prix
  for (const p of sellableProducts(state)) state.prices[p.id] = roundPrice(suggestedPrice(p, state) * priceMult);
  // 2. Améliorations (garde une réserve de trésorerie)
  const last = state.history[state.history.length - 1];
  const reserve = 150 + (last ? last.cogs * 2.5 : 250);
  for (const c of CATEGORIES) {
    if (c.licence && !state.licences.includes(c.id) && state.level >= categoryLevel(c.id) && state.cash > c.licence + reserve) buyLicence(state, c.id);
  }
  const prio = [...['cashier', 'fridge', 'stocker'], ...(process.env.NO_BUYER ? [] : ['buyer']), 'freezer', 'shelves', 'warehouse', 'deco', 'sign', 'billboard', 'express'];
  for (const id of prio) {
    const cost = upgradeCost(state, id);
    const def = UPGRADES.find((u) => u.id === id)!;
    if (cost !== null && state.level >= def.minLevel && state.cash > cost + reserve) buyUpgrade(state, id);
  }
  // 3. Nouveaux produits : un premier lot pour tout produit vendable jamais stocké
  if (mode !== 'lazy') {
    autoReorder(state, 'all');
    for (const p of sellableProducts(state)) {
      const sup = fastestSupplier(p, state);
      if (sup && !p.essential && totalQty(state, p.id) === 0 && inTransit(state, p.id) === 0 && !state.salesHistory[p.id]) {
        const lots = Math.max(1, Math.ceil(expectedDemand(state, p) * 2 / sup.lotSize));
        setCartLots(state, sup.id, p.id, lots);
        const cv = cartView(state);
        if (cv.overCash || cv.overCapacity) setCartLots(state, sup.id, p.id, 0);
      }
    }
    const err = placeOrders(state);
    if (err) orderErr = err;
    if (err && state.cart.length) { state.cart = []; autoReorder(state, 'essentials'); placeOrders(state); }
  } else if (state.day % 2 === 0) {
    // Mode « paresseux » : ne recommande que le confort
    for (const p of sellableProducts(state).filter((x) => !x.essential)) {
      const sup = fastestSupplier(p, state);
      if (sup && totalQty(state, p.id) < 6) setCartLots(state, sup.id, p.id, 1);
    }
    placeOrders(state);
  }
  if (state.cash < BALANCE.LOAN_TRIGGER_CASH && canTakeLoan(state)) takeLoan(state);
  checkLongObjectives(state);
  // Façade : le meilleur élément gagné pour chaque emplacement
  checkDecorUnlocks(state);
  for (const sl of DECOR_SLOTS) {
    const best = DECOR_PARTS.filter((p) => p.slot === sl.id && !canEquip(state, p.id)).sort((a, b) => partCharm(state, b) - partCharm(state, a))[0];
    if (best) equipPart(state, best.id);
  }
  // 4. Rayons
  autoArrange(state);
  // 5. Journée
  const { report: r } = runDay(state);
  const notes = [
    r.levelAfter > r.levelBefore ? `⬆ niv ${r.levelAfter}` : '',
    r.essentialStockouts.length ? `ruptures ess: ${r.essentialStockouts.length}` : '',
    r.queueLost ? `file: -${r.queueLost}` : '',
    r.objectivesDone.length ? `obj: ${r.objectivesDone.length}` : '',
    r.eventIds.join(','), orderErr, process.env.SHOW_BUYER && state.buyer?.last?.day === r.day ? `caisse matin ${Math.round(cashMorning + (state.buyer?.last?.day === state.day ? state.buyer.last.total : 0))}€ · ach: ${state.buyer.last.products}p ${state.buyer.last.total.toFixed(0)}€ skip ${state.buyer.last.skipped}` : '', process.env.SHOW_BUYER ? `stock ${Math.round(storageCommitted(state))}/${storageCapacity(state)}` : '',
  ].filter(Boolean).join(' · ');
  console.log(
    `${pad(r.day, 3)} ${WEEKDAYS[(r.day - 1) % 7].slice(0, 3)}   | ${pad(r.customersServed, 4)} /${pad(r.customersPotential, 4)} (${pad(r.disappointedStock + r.disappointedPrice, 3)}) |` +
    `${pad(r.revenue.toFixed(0), 7)} |${pad((r.revenue - r.cogs).toFixed(0), 7)} |${pad((r.rent + r.electricity + r.salaries).toFixed(0), 8)} |${pad(r.waste.toFixed(0), 7)} |` +
    `${pad(r.profit.toFixed(0), 7)} |${pad(r.cashEnd.toFixed(0), 7)} |${pad(r.repAfter.toFixed(1), 5)} |${pad(r.levelAfter, 4)} | ${notes}`,
  );
  state.pendingLevelUps = [];
  startNextDay(state);
}
console.log(`Façade : ${state.decor.owned.length}/${DECOR_PARTS.length} éléments gagnés · charme ${charmSummary(state).total} · +${(charmSummary(state).traffic * 100).toFixed(1)} % clients · +${charmSummary(state).rep} rép/jour`);
console.log(`\nTotal : CA ${state.totals.revenue.toFixed(0)} € · bénéfice ${state.totals.profit.toFixed(0)} € · pertes ${state.totals.waste.toFixed(0)} € · objectifs longs validés ${state.objectives.longDone.length} · final ${state.finalDone}`);
