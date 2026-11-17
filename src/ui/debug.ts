// Mode debug (touche D) : détail des formules de demande pour l'équilibrage.
import { BALANCE } from '../data/constants';
import type { GameState } from '../state/types';
import { store } from '../state/store';
import { reputationFactor, weekdayFactor } from '../systems/demand';
import { checkoutCapacity, demandContext, demandFor, potentialCustomers, priceImageFactor } from '../systems/economy';
import { addXp } from '../systems/progression';
import { demandProducts } from '../systems/simulation';
import { shelfQty, totalQty } from '../systems/stock';
import { on } from './actions';
import { esc, num1 } from './dom';
import { ui } from './uiState';

const f2 = (v: number) => v.toFixed(2);

export function renderDebug(state: GameState): string {
  if (!ui.debug) return '';
  const ctx = demandContext(state);
  const rows = demandProducts(state).map((p) => ({ p, d: demandFor(state, p) })).sort((a, b) => b.d.total - a.d.total);
  const total = rows.reduce((s, r) => s + r.d.total, 0);
  return `<aside class="debug">
    <header><b>🐞 Debug — formule de demande</b>
      <span><button class="btn xs ghost" data-act="debug-cash">+1 000 €</button> <button class="btn xs ghost" data-act="debug-xp">+1 000 XP</button> <button class="btn xs ghost" data-act="toggle-debug">✕</button></span></header>
    <p>demande = base × essentiel × prix × réputation × jour × événements × affluence × aléa(±${BALANCE.DEMAND_NOISE * 100} %)</p>
    <p>Réputation ${num1(state.reputation)} → ×${f2(reputationFactor(state.reputation))} · jour ×${f2(weekdayFactor(ctx.weekday))} · affluence ×${f2(ctx.traffic)} (dont image prix ×${f2(priceImageFactor(state))}) · marché ×${f2(ctx.marketMult)}
      · clients potentiels ${num1(potentialCustomers(state))} (caisse max ${checkoutCapacity(state)}) · demande totale ≈ ${num1(total)} u.</p>
    <div class="debug-scroll"><table>
      <thead><tr><th>Produit</th><th>base</th><th>ess.</th><th>prix</th><th>(€/marché)</th><th>rép.</th><th>jour</th><th>évén.</th><th>affl.</th><th>= demande</th><th>rayon</th><th>stock</th></tr></thead>
      <tbody>${rows.map(({ p, d }) => `<tr class="${shelfQty(state, p.id) < d.total ? 'short' : ''}">
        <td>${p.emoji} ${esc(p.name)} <i>ε${p.elasticity}</i></td><td>${f2(d.base)}</td><td>${f2(d.essentialWeight)}</td><td>${f2(d.priceFactor)}</td>
        <td>${f2(state.prices[p.id])}/${f2(d.market)}</td><td>${f2(d.repFactor)}</td><td>${f2(d.dayFactor)}</td><td>${f2(d.eventFactor)}</td><td>${f2(d.traffic)}</td>
        <td><b>${num1(d.total)}</b></td><td>${shelfQty(state, p.id)}</td><td>${totalQty(state, p.id)}</td></tr>`).join('')}</tbody>
    </table></div>
  </aside>`;
}

on('toggle-debug', () => { ui.debug = !ui.debug; store.commit(); });
on('debug-cash', () => { store.state.cash += 1000; store.commit(); });
on('debug-xp', () => { addXp(store.state, 1000); store.commit(); });
