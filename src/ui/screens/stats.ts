// Écran 7 : statistiques et historique.
import { WEEKDAYS } from '../../data/constants';
import { EVENT_BY_ID } from '../../data/events';
import { PRODUCT_BY_ID } from '../../data/products';
import type { GameState } from '../../state/types';
import { store } from '../../state/store';
import { markupPct } from '../../systems/economy';
import { sellableProducts } from '../../systems/progression';
import { assortment } from '../../systems/stock';
import { on } from '../actions';
import { revenueChart } from '../chart';
import { esc, money, money0, num, num1, pastille, signed } from '../dom';
import { ui } from '../uiState';

export function renderStats(state: GameState): string {
  const t = state.totals;
  const days = state.history.length;
  const tab = ui.statsTab;
  const best = Object.entries(state.productStats).map(([id, s]) => ({ p: PRODUCT_BY_ID[id], ...s })).filter((x) => x.p)
    .sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  const inRayon = assortment(state);
  const margins = sellableProducts(state).filter((p) => inRayon.has(p.id))
    .map((p) => ({ p, price: state.prices[p.id], pct: markupPct(state.prices[p.id], p.cost) })).sort((a, b) => a.pct - b.pct).slice(0, 15);
  const maxRev = Math.max(1, ...best.map((b) => b.revenue));

  let body = '';
  if (tab === 'days') {
    body = `<table class="table"><thead><tr><th>Jour</th><th class="num">Clients</th><th class="num">Déçus</th><th class="num">Ventes manquées</th><th class="num">CA</th><th class="num">Marge brute</th><th class="num">Charges</th><th class="num">Pertes</th><th class="num">Bénéfice</th><th class="num">Réputation</th><th>Événement</th></tr></thead>
      <tbody>${state.history.slice().reverse().map((h) => `<tr>
        <td><b>J${h.day}</b> <span class="muted small">${WEEKDAYS[(h.day - 1) % 7].slice(0, 3)}.</span> ${h.weather}</td>
        <td class="num">${num(h.customersServed)}</td>
        <td class="num">${h.disappointedStock + h.disappointedPrice + h.queueLost ? `<span class="warn">${num(h.disappointedStock + h.disappointedPrice + h.queueLost)}</span>` : '0'}</td>
        <td class="num">${h.lostSales ? (h.lostSales.stock + h.lostSales.price + h.lostSales.queue ? `<span class="neg" title="≈ ${money0(h.lostSales.value)} perdus">${num(h.lostSales.stock + h.lostSales.price + h.lostSales.queue)}</span>` : '0') : '—'}</td>
        <td class="num">${money0(h.revenue)}</td><td class="num">${money0(h.revenue - h.cogs)}</td>
        <td class="num">${money0(h.rent + h.electricity + h.salaries + h.interest)}</td>
        <td class="num">${h.waste ? `<span class="neg">${money0(h.waste)}</span>` : '—'}</td>
        <td class="num"><b class="${h.profit >= 0 ? 'pos' : 'neg'}">${signed(h.profit, money0)}</b></td>
        <td class="num">${num1(h.repAfter)} <span class="small ${h.repAfter >= h.repBefore ? 'pos' : 'neg'}">(${signed(h.repAfter - h.repBefore)})</span></td>
        <td>${h.eventIds.map((id) => EVENT_BY_ID[id] ? `${EVENT_BY_ID[id].emoji} ${EVENT_BY_ID[id].name}` : '').join(', ')}</td>
      </tr>`).join('') || '<tr><td colspan="11" class="muted center">Aucune journée terminée pour l’instant.</td></tr>'}</tbody></table>`;
  } else if (tab === 'best') {
    body = `<table class="table"><thead><tr><th>#</th><th>Produit</th><th class="num">Unités vendues</th><th class="num">CA cumulé</th><th class="num">Marge cumulée</th><th>Part</th></tr></thead>
      <tbody>${best.map((b, i) => `<tr><td>${i + 1}</td><td><div class="prod-cell">${pastille(b.p, 'sm')}<b>${esc(b.p.name)}</b></div></td>
        <td class="num">${num(b.units)}</td><td class="num">${money0(b.revenue)}</td><td class="num pos">${money0(b.revenue - b.cogs)}</td>
        <td><div class="gauge green wide"><i style="--p:${(b.revenue / maxRev).toFixed(3)}"></i></div></td></tr>`).join('') || '<tr><td colspan="6" class="muted center">Pas encore de ventes.</td></tr>'}</tbody></table>`;
  } else {
    body = `<table class="table"><thead><tr><th>Produit</th><th class="num">Achat</th><th class="num">Prix de vente</th><th class="num">Marge unitaire</th><th class="num">Taux de marge</th></tr></thead>
      <tbody>${margins.map((m) => `<tr><td><div class="prod-cell">${pastille(m.p, 'sm')}<b>${esc(m.p.name)}</b></div></td>
        <td class="num">${money(m.p.cost)}</td><td class="num">${money(m.price)}</td>
        <td class="num ${m.price > m.p.cost ? 'pos' : 'neg'}">${money(m.price - m.p.cost)}</td>
        <td class="num"><b class="${m.pct < 15 ? 'neg' : m.pct < 30 ? 'warn' : 'pos'}">${num1(m.pct)} %</b></td></tr>`).join('')}</tbody></table>`;
  }

  return `
  <div class="screen-head"><div><h1>📊 Statistiques</h1><p class="muted">Bilans passés, meilleures ventes et marges les plus faibles.</p></div></div>
  <section class="kpis">
    <div class="card kpi"><span class="kpi-label">CA cumulé</span><span class="kpi-value">${money0(t.revenue)}</span><span class="kpi-sub">${days ? `${money0(t.revenue / Math.max(1, state.day - 1))} / jour en moyenne` : '—'}</span></div>
    <div class="card kpi"><span class="kpi-label">Bénéfice cumulé</span><span class="kpi-value ${t.profit < 0 ? 'neg' : ''}">${money0(t.profit)}</span><span class="kpi-sub">Record : ${money0(t.bestProfit)} en un jour</span></div>
    <div class="card kpi"><span class="kpi-label">Clients servis</span><span class="kpi-value">${num(t.customers)}</span><span class="kpi-sub">${num(state.day - 1)} jours d'ouverture</span></div>
    <div class="card kpi"><span class="kpi-label">Pertes (périmés)</span><span class="kpi-value ${t.waste > 0 ? 'neg' : ''}">${money0(t.waste)}</span><span class="kpi-sub">${t.revenue ? `${num1((t.waste / t.revenue) * 100)} % du CA` : '—'}</span></div>
  </section>
  <section class="card"><div class="card-head"><h2>📈 14 derniers jours</h2></div>${revenueChart(state.history)}</section>
  <section class="card table-card">
    <div class="card-head"><div class="tabs">
      <button class="${tab === 'days' ? 'on' : ''}" data-act="stats-tab" data-arg="days">Bilans passés</button>
      <button class="${tab === 'best' ? 'on' : ''}" data-act="stats-tab" data-arg="best">Meilleurs produits</button>
      <button class="${tab === 'margins' ? 'on' : ''}" data-act="stats-tab" data-arg="margins">Pires marges</button>
    </div></div>
    ${body}
  </section>`;
}

on('stats-tab', (t) => { ui.statsTab = t as typeof ui.statsTab; store.commit(); });
