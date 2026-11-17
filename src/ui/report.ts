// Bilan de fin de journée + célébrations (niveau, objectif final).
import { FINAL_GOAL, WEEKDAYS } from '../data/constants';
import { CATEGORY_BY_ID } from '../data/categories';
import { EVENT_BY_ID } from '../data/events';
import { levelDef } from '../data/levels';
import { PRODUCT_BY_ID } from '../data/products';
import { store } from '../state/store';
import { DECOR_BY_ID, DECOR_PARTS, tierOf, tierWithArticle } from '../data/decor';
import { storefrontSvg } from './storefront';
import type { DayReport } from '../state/types';
import { levelNews, xpProgress } from '../systems/progression';
import { startNextDay } from '../systems/simulation';
import { activeShop, shopCount, shopDef } from '../systems/shops';
import { on } from './actions';
import { sfx } from './audio';
import { badge, catPastille, esc, gauge, money, money0, num, num1, pastille, signed } from './dom';
import { confetti, runCounters } from './fx';
import { closeModal, modalOpen, openModal } from './modal';
import { ui } from './uiState';

const line = (label: string, value: number, cls = '', sign: '' | '−' | '=' | '+' = '') =>
  `<div class="rp-line ${cls}"><span>${sign ? `<i>${sign}</i> ` : ''}${label}</span><b data-count="${value}" data-fmt="money">${money(value)}</b></div>`;

/** Bloc « Ventes manquées » du bilan (aussi utilisé dans l'historique). */
export function lostSalesBlock(r: DayReport): string {
  const l = r.lostSales;
  if (!l) return '';
  const total = l.stock + l.price + l.queue;
  if (!total) return '<div class="lost-box ok">✅ <b>Aucune vente manquée</b> aujourd’hui.</div>';
  const part = (n: number, label: string, tip: string) => (n ? `<li><span>${label}</span><b>${num(n)}</b><span class="small muted">${tip}</span></li>` : '');
  return `<div class="lost-box">
    <div class="lost-head"><span>📉 Ventes manquées</span><b class="neg">${num(total)} article${total > 1 ? 's' : ''}</b></div>
    <p class="small">≈ <b class="neg">${money0(l.value)}</b> de chiffre d’affaires perdu</p>
    <ul class="lost-parts">
      ${part(l.stock, '🚫 Rupture en rayon', 'commande ou remplis tes rayons')}
      ${part(l.price, '💸 Prix trop élevé', 'baisse un peu tes prix')}
      ${part(l.queue, '⏳ File d’attente', 'embauche un caissier')}
    </ul>
    ${l.top.length ? `<div class="lost-top">${l.top.map((t) => (PRODUCT_BY_ID[t.productId] ? `<span title="${esc(PRODUCT_BY_ID[t.productId].name)} : ${t.units} non vendus (≈ ${money0(t.value)})">${PRODUCT_BY_ID[t.productId].emoji} ×${num(t.units)}</span>` : '')).join('')}</div>` : ''}
  </div>`;
}

function reportHtml(r: DayReport): string {
  const state = store.state;
  const top = Object.entries(r.sales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const xp = xpProgress(state);
  const repDelta = Math.round((r.repAfter - r.repBefore) * 10) / 10;
  const mood = r.profit >= 0 ? (r.profit > 50 ? '🎉' : '🙂') : '😬';
  const pills = (ids: string[]) => ids.map((id) => PRODUCT_BY_ID[id] ? pastille(PRODUCT_BY_ID[id], 'sm') : '').join('');
  return `<div class="overlay report"><div class="report-card">
    <header class="rp-head">
      <div><span class="hero-level">Bilan de fin de journée</span><h2>Jour ${r.day} · ${WEEKDAYS[(r.day - 1) % 7]} ${r.weather}</h2>${shopCount(state) > 1 ? `<p class="muted small">${shopDef(activeShop(state).id).emoji} Détail : ${esc(shopDef(activeShop(state).id).name)} · bénéfice net de toute l’enseigne</p>` : ''}
        ${r.eventIds.map((id) => EVENT_BY_ID[id] ? badge(`${EVENT_BY_ID[id].emoji} ${EVENT_BY_ID[id].name}`, 'purple') : '').join(' ')}</div>
      <div class="rp-profit ${r.profit >= 0 ? 'pos' : 'neg'}"><span>${mood} Bénéfice du jour</span><b data-count="${r.profit}" data-fmt="smoney">${signed(r.profit, money)}</b></div>
    </header>
    <div class="rp-grid">
      <section class="rp-col">
        <h3>💶 Résultat</h3>
        ${line("Chiffre d'affaires", r.revenue, 'strong')}
        ${line('Coût des marchandises vendues', r.cogs, '', '−')}
        ${line('Marge brute', r.revenue - r.cogs, 'sub', '=')}
        ${line('Loyer', r.rent, '', '−')}
        ${line('Électricité', r.electricity, '', '−')}
        ${r.salaries ? line('Salaires', r.salaries, '', '−') : ''}
        ${r.waste ? line('Produits périmés jetés', r.waste, 'bad', '−') : ''}
        ${r.interest ? line('Intérêts du prêt', r.interest, 'bad', '−') : ''}
        ${r.branchIncome ? line('🏢 Revenus des succursales', r.branchIncome, 'pos-line', '+') : ''}
        ${r.shops?.length ? r.shops.map((o) => line(`${shopDef(o.id).emoji} ${esc(shopDef(o.id).name)}${o.manager ? ' (gérant)' : ''}`, o.profit, o.profit >= 0 ? 'pos-line' : 'bad', o.profit >= 0 ? '+' : '')).join('') : ''}
        ${line('Bénéfice net', r.profit, `total ${r.profit >= 0 ? 'pos' : 'neg'}`, '=')}
        <div class="rp-line cash"><span>🏦 Trésorerie ce soir</span><b>${money(r.cashEnd)}</b></div>
      </section>
      <section class="rp-col">
        <h3>🧑‍🤝‍🧑 Clients</h3>
        <div class="rp-stats">
          <div><b data-count="${r.customersServed}">${r.customersServed}</b><span>servis</span></div>
          <div><b class="${r.disappointedStock ? 'neg' : ''}" data-count="${r.disappointedStock}">${r.disappointedStock}</b><span>déçus (rupture)</span></div>
          <div><b class="${r.disappointedPrice ? 'neg' : ''}" data-count="${r.disappointedPrice}">${r.disappointedPrice}</b><span>déçus (prix)</span></div>
          ${r.queueLost ? `<div><b class="neg" data-count="${r.queueLost}">${r.queueLost}</b><span>partis (file d'attente)</span></div>` : ''}
        </div>
        <p class="muted small">${num(r.unitsSold)} articles vendus à ${num(r.customersPotential)} visiteurs potentiels.</p>
        ${lostSalesBlock(r)}
        <h4>🏆 Meilleures ventes</h4>
        ${top.length ? `<ul class="rp-top">${top.map(([id, s]) => `<li>${pastille(PRODUCT_BY_ID[id], 'sm')}<span>${esc(PRODUCT_BY_ID[id].name)} <span class="muted">× ${s.units}</span></span><b>${money0(s.revenue)}</b></li>`).join('')}</ul>` : '<p class="muted">Aucune vente aujourd’hui…</p>'}
        ${r.stockouts.length ? `<h4>🚫 Produits en rupture ${badge(String(r.stockouts.length), 'red')}</h4><div class="rp-pills">${pills(r.stockouts.slice(0, 16))}</div>
          ${r.essentialStockouts.length ? `<p class="small neg">Dont ${r.essentialStockouts.length} essentiel${r.essentialStockouts.length > 1 ? 's' : ''} : la réputation en souffre.</p>` : ''}` : '<p class="pos small">✅ Aucune rupture en rayon.</p>'}
        ${r.expired.length ? `<h4>🗑️ Périmés jetés</h4><ul class="rp-top">${r.expired.slice(0, 5).map((e) => `<li>${pastille(PRODUCT_BY_ID[e.productId], 'sm')}<span>${esc(PRODUCT_BY_ID[e.productId].name)} <span class="muted">× ${e.qty}</span></span><b class="neg">−${money(e.value)}</b></li>`).join('')}</ul>` : ''}
      </section>
      <section class="rp-col">
        <h3>⭐ Réputation</h3>
        <div class="rp-rep"><b>${num1(r.repBefore)}</b><span>→</span><b class="${repDelta >= 0 ? 'pos' : 'neg'}">${num1(r.repAfter)}</b>${badge(`${signed(repDelta)}`, repDelta >= 0 ? 'green' : 'red')}</div>
        ${gauge(r.repAfter, r.repAfter < 25 ? 'orange' : 'green')}
        <ul class="rp-rep-details">${r.repDetails.map((d) => `<li><span>${esc(d.label)}</span><b class="${d.delta >= 0 ? 'pos' : 'neg'}">${signed(d.delta)}</b></li>`).join('')}</ul>
        <h3>🎯 Objectifs validés</h3>
        ${r.objectivesDone.length ? `<ul class="rp-obj">${r.objectivesDone.map((o) => `<li>✅ <span>${esc(o.label)}</span><b class="pos">${[o.cash ? `+${money0(o.cash)}` : '', o.xp ? `+${num(o.xp)} XP` : '', o.unlock && PRODUCT_BY_ID[o.unlock] ? `🔓 ${PRODUCT_BY_ID[o.unlock].emoji}` : ''].filter(Boolean).join(' · ')}</b></li>`).join('')}</ul>` : '<p class="muted small">Aucun aujourd’hui. Consulte le panneau d’objectifs demain matin.</p>'}
        ${r.decorUnlocked?.length ? `<h3>🎁 Façade : nouveaux éléments</h3><div class="rp-decor">${r.decorUnlocked.map((id) => DECOR_BY_ID[id] ? `<span>${DECOR_BY_ID[id].emoji} ${esc(DECOR_BY_ID[id].name)}</span>` : '').join('')}</div>` : ''}
        <h3>📈 Progression</h3>
        <div class="rp-line"><span>Niveau ${state.level} · ${esc(levelDef(state.level).name)}</span><b class="pos">+${num(r.xpGained)} XP</b></div>
        ${gauge(xp.pct, 'purple')}
        ${r.levelAfter > r.levelBefore ? `<p class="pos"><b>🎊 Niveau ${r.levelAfter} atteint !</b></p>` : ''}
      </section>
    </div>
    <footer class="rp-foot"><button class="btn primary xl" data-act="next-day">☀️ Jour suivant</button></footer>
  </div></div>`;
}

export function showReport(): void {
  const r = store.state.lastReport;
  const root = document.getElementById('overlay-root')!;
  if (!r) { root.innerHTML = ''; return; }
  root.innerHTML = reportHtml(r);
  runCounters(root, { money, smoney: (v) => signed(Math.round(v * 100) / 100, money), num: (v) => num(Math.round(v)) });
  if (r.profit > 0) sfx.success();
  if (r.objectivesDone.some((o) => o.id === 'final')) setTimeout(showFinal, 900);
  else setTimeout(maybeCelebrate, 900);
}

export const reportVisible = () => !!document.querySelector('.overlay.report');

/** Affiche l'écran « Nouveautés » pour le prochain niveau en attente. */
export function maybeCelebrate(): void {
  const state = store.state;
  if (ui.simRunning || modalOpen() || !state.pendingLevelUps.length) return;
  const level = state.pendingLevelUps[0];
  const n = levelNews(level);
  const decorAtLevel = DECOR_PARTS.filter((p) => p.unlock.kind === 'level' && p.unlock.level === level);
  confetti();
  sfx.level();
  openModal({
    className: 'levelup', wide: true, dismissable: false,
    body: `<div class="lu-head"><span class="lu-star">⭐</span><span class="hero-level">Niveau ${level} atteint !</span><h2>${esc(n.name)}</h2>
        <p class="muted">Ton magasin s’agrandit. Voici les nouveautés :</p></div>
      <div class="lu-perks">
        <div><b>+${n.slots}</b><span>emplacements de rayon</span></div>
        <div><b>+${num(n.warehouse)}</b><span>volume d’entrepôt</span></div>
        <div><b>+${n.trafficPct} %</b><span>clients potentiels</span></div>
        ${n.basketPct > 0 ? `<div><b>+${n.basketPct} %</b><span>panier moyen</span></div>` : ''}
        ${n.buyingPct > 0 ? `<div><b>−${n.buyingPct} %</b><span>prix fournisseurs (centrale d’achat)</span></div>` : ''}
      </div>
      ${tierOf(level) > tierOf(level - 1) ? `<div class="lu-tier"><span class="lu-tier-preview">${storefrontSvg(state, { level })}</span><p><b>🏗️ Ton magasin devient ${esc(tierWithArticle(tierOf(level)))} !</b> Nouvelle architecture, et de nouveaux éléments de façade sont maintenant disponibles. Les éléments trop modestes risquent de devenir démodés.</p></div>` : ''}
      ${decorAtLevel.length ? `<h4>🎁 Nouveaux éléments de façade</h4><div class="lu-cats">${decorAtLevel.map((p) => `<span class="lu-cat">${p.emoji} ${esc(p.name)}</span>`).join('')}</div>` : ''}
      ${n.categories.length ? `<h4>Nouveaux rayons</h4><div class="lu-cats">${n.categories.map((c) => {
        const cat = CATEGORY_BY_ID[c];
        return `<span class="lu-cat">${catPastille(cat.emoji, cat.hue, 'sm')} ${esc(cat.name)}${cat.licence ? ` <span class="muted small">(licence ${money0(cat.licence)})</span>` : ''}</span>`;
      }).join('')}</div>` : ''}
      ${n.products.length ? `<h4>${n.products.length} nouveaux produits</h4><div class="lu-products">${n.products.map((p, i) => `<span class="lu-prod" style="animation-delay:${i * 40}ms">${pastille(p)}<span>${esc(p.name)}</span>${p.essential ? badge('Essentiel', 'blue') : ''}</span>`).join('')}</div>
        <p class="muted small">Les nouveaux essentiels seront attendus par les clients d’ici 2 jours. Certains produits demandent un réfrigérateur, un congélateur ou une licence (onglet Améliorations).</p>` : ''}
      <div class="modal-actions center"><button class="btn primary xl" data-act="levelup-ok">Super !</button></div>`,
  });
}

function showFinal(): void {
  confetti(4000);
  sfx.level();
  openModal({
    className: 'levelup', dismissable: false,
    body: `<div class="lu-head"><span class="lu-star">🏆</span><span class="hero-level">Objectif final atteint</span><h2>Félicitations, patron !</h2>
      <p>Tu as transformé une petite épicerie en <b>Mini-marché</b> prospère avec plus de <b>${money0(FINAL_GOAL.cash)}</b> en caisse.</p>
      <p class="muted">La partie continue en <b>mode libre</b> : atteins le niveau maximum, débloque tout le catalogue et bats tes records.</p></div>
      <div class="modal-actions center"><button class="btn primary xl" data-act="modal-close">Continuer en mode libre</button></div>`,
    onClose: () => setTimeout(maybeCelebrate, 200),
  });
}

export function announceFinal(): void { showFinal(); }

on('levelup-ok', () => {
  store.state.pendingLevelUps.shift();
  closeModal();
  store.commit();
  setTimeout(maybeCelebrate, 250);
});

on('next-day', () => {
  const state = store.state;
  if (state.phase !== 'report') return;
  startNextDay(state);
  document.getElementById('overlay-root')!.innerHTML = '';
  ui.screen = 'dashboard';
  ui.entering = true;
  sfx.notify();
  store.commit();
});
