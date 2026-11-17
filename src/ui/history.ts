// Tableau de bord : historique des 7 dernières journées (résumé + détail d'une journée).
import { WEEKDAYS } from '../data/constants';
import { DECOR_BY_ID } from '../data/decor';
import { EVENT_BY_ID } from '../data/events';
import { PRODUCT_BY_ID } from '../data/products';
import type { DayReport, GameState } from '../state/types';
import { store } from '../state/store';
import { on } from './actions';
import { badge, esc, money, money0, num, num1, pastille, signed } from './dom';
import { openModal } from './modal';
import { lostSalesBlock } from './report';

const DAYS_SHOWN = 7;
const dayName = (d: number) => WEEKDAYS[(d - 1) % 7];
const disappointed = (r: DayReport) => r.disappointedStock + r.disappointedPrice + r.queueLost;
const lostCount = (r: DayReport) => (r.lostSales ? r.lostSales.stock + r.lostSales.price + r.lostSales.queue : 0);
const charges = (r: DayReport) => r.rent + r.electricity + r.salaries + r.interest;

interface Totals { revenue: number; profit: number; served: number; disappointed: number; waste: number; days: number }
function totals(list: DayReport[]): Totals {
  return list.reduce((t, r) => ({
    revenue: t.revenue + r.revenue, profit: t.profit + r.profit, served: t.served + r.customersServed,
    disappointed: t.disappointed + disappointed(r), waste: t.waste + r.waste, days: t.days + 1,
  }), { revenue: 0, profit: 0, served: 0, disappointed: 0, waste: 0, days: 0 });
}

/** Évolution en % par rapport aux 7 jours précédents (null si pas de comparaison possible). */
function trend(now: number, before: number | null): string {
  if (before === null || Math.abs(before) < 1) return '';
  const pct = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(pct) < 1) return '<span class="trend flat">= </span>';
  return `<span class="trend ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${num(Math.abs(Math.round(pct)))} %</span>`;
}

/** Petites icônes des faits marquants d'une journée. */
function highlights(r: DayReport): string {
  const h: string[] = [];
  if (r.levelAfter > r.levelBefore) h.push(`<span title="Niveau ${r.levelAfter} atteint">🏅</span>`);
  for (const id of r.eventIds) if (EVENT_BY_ID[id]) h.push(`<span title="${esc(EVENT_BY_ID[id].name)}">${EVENT_BY_ID[id].emoji}</span>`);
  if (r.objectivesDone.length) h.push(`<span title="${r.objectivesDone.length} objectif(s) validé(s)">🎯</span>`);
  if (r.decorUnlocked?.length) h.push(`<span title="Éléments de façade gagnés">🎁</span>`);
  if (r.essentialStockouts.length) h.push(`<span title="${r.essentialStockouts.length} essentiel(s) en rupture">🚫</span>`);
  if (r.waste > 0) h.push(`<span title="Produits périmés jetés : ${money(r.waste)}">🗑️</span>`);
  return h.join('');
}

export function historyCard(state: GameState): string {
  const list = state.history.slice(-DAYS_SHOWN).reverse();
  if (!list.length) {
    return `<section class="card"><div class="card-head"><h2>🗓️ Les 7 derniers jours</h2></div>
      <div class="chart-empty">Le résumé de tes journées apparaîtra ici après ta première journée.</div></section>`;
  }
  const prev = state.history.slice(-DAYS_SHOWN * 2, -DAYS_SHOWN);
  const t = totals(list);
  const p = prev.length === DAYS_SHOWN ? totals(prev) : null;
  const best = list.reduce((a, b) => (b.profit > a.profit ? b : a));
  return `<section class="card">
    <div class="card-head"><h2>🗓️ Les ${list.length === 1 ? 'derniers jours' : `${list.length} derniers jours`}</h2><span class="muted small">Touche une journée pour son bilan</span></div>
    <div class="week-totals">
      <div><span class="kpi-label">Chiffre d'affaires</span><b>${money0(t.revenue)}</b>${trend(t.revenue, p?.revenue ?? null)}</div>
      <div><span class="kpi-label">Bénéfice</span><b class="${t.profit >= 0 ? 'pos' : 'neg'}">${signed(t.profit, money0)}</b>${trend(t.profit, p?.profit ?? null)}</div>
      <div><span class="kpi-label">Clients servis</span><b>${num(t.served)}</b>${trend(t.served, p?.served ?? null)}</div>
      <div><span class="kpi-label">Moyenne / jour</span><b>${money0(t.revenue / t.days)}</b><span class="small muted">bénéf. ${signed(t.profit / t.days, money0)}</span></div>
    </div>
    ${p ? '<p class="small muted">▲▼ : comparé aux 7 jours précédents.</p>' : ''}
    <div class="day-list" role="list">
      <div class="day-row head" aria-hidden="true"><span>Jour</span><span>CA</span><span>Bénéfice</span><span>Clients</span><span>Réputation</span><span>Faits</span></div>
      ${list.map((r) => {
        const rep = r.repAfter - r.repBefore;
        return `<button class="day-row ${r === best && list.length > 1 && r.profit > 0 ? 'best' : ''}" data-act="day-detail" data-arg="${r.day}" role="listitem">
          <span class="day-name"><b>J${r.day}</b> <span class="muted">${dayName(r.day).slice(0, 3)}.</span> ${r.weather}${r === best && list.length > 1 && r.profit > 0 ? ' <span class="badge green">Meilleur jour</span>' : ''}</span>
          <span data-label="CA">${money0(r.revenue)}</span>
          <span data-label="Bénéfice"><b class="${r.profit >= 0 ? 'pos' : 'neg'}">${signed(r.profit, money0)}</b></span>
          <span data-label="Clients">${num(r.customersServed)}${disappointed(r) ? ` <span class="warn small">(${num(disappointed(r))} déçus)</span>` : ''}${lostCount(r) ? `<br><span class="small neg" title="Articles voulus mais non vendus">📉 ${num(lostCount(r))} ventes manquées</span>` : ''}</span>
          <span data-label="Réputation">${num1(r.repAfter)} <span class="small ${rep >= 0 ? 'pos' : 'neg'}">${signed(rep)}</span></span>
          <span class="day-highlights">${highlights(r)}</span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

const line = (label: string, value: string, cls = '') => `<div class="rp-line ${cls}"><span>${label}</span><b>${value}</b></div>`;

function dayDetail(r: DayReport): string {
  const top = Object.entries(r.sales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const pills = (ids: string[]) => ids.map((id) => (PRODUCT_BY_ID[id] ? pastille(PRODUCT_BY_ID[id], 'sm') : '')).join('');
  return `
    ${r.eventIds.length ? `<div class="badges">${r.eventIds.map((id) => (EVENT_BY_ID[id] ? badge(`${EVENT_BY_ID[id].emoji} ${EVENT_BY_ID[id].name}`, 'purple') : '')).join(' ')}</div>` : ''}
    <div class="detail-grid">
      <section class="rp-col">
        <h3>💶 Résultat</h3>
        ${line("Chiffre d'affaires", money(r.revenue), 'strong')}
        ${line('Coût des marchandises', `− ${money(r.cogs)}`)}
        ${line('Charges (loyer, électricité, salaires)', `− ${money(charges(r))}`)}
        ${r.branchIncome ? line('🏢 Succursales', `+ ${money(r.branchIncome)}`, 'pos') : ''}
        ${r.waste ? line('Périmés jetés', `− ${money(r.waste)}`, 'bad') : ''}
        ${line('Bénéfice net', signed(r.profit, money), `total ${r.profit >= 0 ? 'pos' : 'neg'}`)}
        ${line('Trésorerie le soir', money(r.cashEnd))}
      </section>
      <section class="rp-col">
        <h3>🧑‍🤝‍🧑 Clients</h3>
        ${line('Servis', num(r.customersServed))}
        ${line('Déçus (rupture)', num(r.disappointedStock), r.disappointedStock ? 'bad' : '')}
        ${line('Déçus (prix)', num(r.disappointedPrice), r.disappointedPrice ? 'bad' : '')}
        ${r.queueLost ? line('Partis (file d’attente)', num(r.queueLost), 'bad') : ''}
        ${line('Articles vendus', num(r.unitsSold))}
        ${lostSalesBlock(r)}
        <h4>🏆 Meilleures ventes</h4>
        ${top.length ? `<ul class="rp-top">${top.map(([id, s]) => (PRODUCT_BY_ID[id] ? `<li>${pastille(PRODUCT_BY_ID[id], 'sm')}<span>${esc(PRODUCT_BY_ID[id].name)} <span class="muted">× ${s.units}</span></span><b>${money0(s.revenue)}</b></li>` : '')).join('')}</ul>` : '<p class="muted small">Aucune vente.</p>'}
        ${r.stockouts.length ? `<h4>🚫 En rupture</h4><div class="rp-pills">${pills(r.stockouts.slice(0, 14))}</div>` : ''}
      </section>
      <section class="rp-col">
        <h3>⭐ Réputation</h3>
        ${line(`${num1(r.repBefore)} → ${num1(r.repAfter)}`, signed(r.repAfter - r.repBefore), r.repAfter >= r.repBefore ? 'pos' : 'bad')}
        <ul class="rp-rep-details">${r.repDetails.map((d) => `<li><span>${esc(d.label)}</span><b class="${d.delta >= 0 ? 'pos' : 'neg'}">${signed(d.delta)}</b></li>`).join('')}</ul>
        ${r.objectivesDone.length ? `<h4>🎯 Objectifs validés</h4><ul class="rp-obj">${r.objectivesDone.map((o) => `<li>✅ <span>${esc(o.label)}</span></li>`).join('')}</ul>` : ''}
        ${r.decorUnlocked?.length ? `<h4>🎁 Façade</h4><div class="rp-decor">${r.decorUnlocked.map((id) => (DECOR_BY_ID[id] ? `<span>${DECOR_BY_ID[id].emoji} ${esc(DECOR_BY_ID[id].name)}</span>` : '')).join('')}</div>` : ''}
        ${r.levelAfter > r.levelBefore ? `<p class="pos"><b>🏅 Niveau ${r.levelAfter} atteint</b></p>` : ''}
      </section>
    </div>`;
}

on('day-detail', (d) => {
  const r = store.state.history.find((h) => h.day === Number(d));
  if (!r) return;
  openModal({ title: `Bilan du jour ${r.day} · ${dayName(r.day)} ${r.weather}`, body: dayDetail(r), wide: true, className: 'day-modal' });
});
