// Écran 1 : tableau de bord.
import { BALANCE, WEEKDAYS } from '../../data/constants';
import { levelDef } from '../../data/levels';
import type { GameState } from '../../state/types';
import { store } from '../../state/store';
import { activeCampaigns, activePromos, canTakeLoan, checkoutCapacity, dailyCharges, loanOffer, potentialCustomers, priceImageFactor, takeLoan, weekdayOf } from '../../systems/economy';
import { activeEvents, upcomingEvents, weatherFor } from '../../systems/events';
import { objectivesPanel, xpProgress, type ObjectiveView } from '../../systems/progression';
import { on } from '../actions';
import { collectAlerts } from '../alerts';
import { revenueChart } from '../chart';
import { badge, esc, gauge, money, money0, num, pastille } from '../dom';
import { storefrontSvg } from '../storefront';
import { toast } from '../toast';
import { ui } from '../uiState';
import { PRODUCT_BY_ID } from '../../data/products';
import { unseenDecor } from './decor';
import { historyCard } from '../history';

interface Coach { title: string; text: string; cta?: string; screen?: string }

function coach(state: GameState): Coach | null {
  if (state.tutorialOff || state.day > 5) return null;
  const ordered = state.totals.ordersPlaced > 0;
  if (state.day === 1 && !ordered) return { title: 'Étape 1 · Ta première commande', text: 'Ton kit de démarrage ne tiendra qu’une journée. Va dans <b>Commandes</b>, clique sur <b>« Réassort auto des essentiels »</b> puis valide le panier : la livraison arrivera demain matin.', cta: 'Aller aux commandes', screen: 'orders' };
  if (state.day === 1) return { title: 'Étape 2 · Ouvre le magasin', text: 'Commande passée, bravo ! Clique maintenant sur <b>« Ouvrir le magasin »</b> : la journée se déroule toute seule, puis tu découvres ton bilan.' };
  if (state.day === 2) return { title: 'Jour 2 · Remplis tes rayons', text: 'Ta livraison est arrivée dans l’entrepôt. Va dans <b>Rayons</b> et clique sur <b>« Tout remplir »</b>. Pense à recommander chaque matin.', cta: 'Voir les rayons', screen: 'shelves' };
  if (state.day === 3) return { title: 'Jour 3 · Ajuste tes prix', text: 'Dans <b>Prix</b>, compare ton prix au <b>prix du marché</b>. Les essentiels supportent mal les abus (réputation !), les snacks se vendent beaucoup mieux quand ils sont bon marché.', cta: 'Régler les prix', screen: 'prices' };
  if (state.day === 4) return { title: 'Jour 4 · Investis', text: 'Dès que la trésorerie le permet, passe par <b>Améliorations</b> : rayons, décoration, puis réfrigérateur pour vendre les produits frais.', cta: 'Voir les améliorations', screen: 'upgrades' };
  return { title: 'Jour 5 · Garde un œil sur la péremption', text: 'Le pain et les produits frais se périment : commande-les en petites quantités. Des <b>événements</b> (canicule, fête locale…) seront bientôt annoncés ici. Bonne gestion !' };
}

function objectiveRow(v: ObjectiveView): string {
  const reward = [v.cash ? `+${money0(v.cash)}` : '', v.xp ? `+${num(v.xp)} XP` : '', v.unlock ? `🔓 ${v.unlock.emoji} ${esc(v.unlock.name)}` : ''].filter(Boolean).join(' · ');
  const showProgress = v.target > 1 || v.def.final;
  return `<div class="objective ${v.done ? 'done' : ''}">
    <span class="obj-icon">${v.done ? '✅' : v.def.emoji}</span>
    <div class="obj-main">
      <div class="obj-label">${esc(v.label)}</div>
      ${showProgress ? gauge(v.pct, v.done ? 'green' : 'blue') : ''}
      <div class="obj-reward">${v.done ? 'Validé !' : `Récompense : ${reward}`}</div>
    </div>
  </div>`;
}

export function renderDashboard(state: GameState): string {
  const wd = weekdayOf(state.day);
  const lvl = levelDef(state.level);
  const weather = weatherFor(state);
  const xp = xpProgress(state);
  const charges = dailyCharges(state);
  const pot = Math.round(potentialCustomers(state));
  const cap = checkoutCapacity(state);
  const image = priceImageFactor(state);
  const events = activeEvents(state);
  const upcoming = upcomingEvents(state);
  const alerts = collectAlerts(state);
  const panel = objectivesPanel(state);
  const c = coach(state);
  const offer = loanOffer(state);
  const lowCash = state.cash < BALANCE.LOAN_TRIGGER_CASH * 2.5;
  const objList = ui.objTab === 'daily' ? panel.daily : ui.objTab === 'weekly' ? panel.weekly : panel.long.slice(0, 6);

  return `
  <section class="hero">
    ${storefrontSvg(state)}
    <div class="hero-info">
      <span class="hero-level">Niveau ${state.level} · ${esc(lvl.name)}</span>
      <h1>Jour ${state.day} <small>${WEEKDAYS[wd]}</small></h1>
      <span class="hero-weather">${weather.icon} ${esc(weather.label)}</span>
    </div>
    <button class="hero-skin" data-act="nav" data-arg="decor" title="Personnaliser la façade">🎨 Façade${unseenDecor(state) ? ` <span class="nav-badge inline">${unseenDecor(state)}</span>` : ''}</button>
    <div class="hero-cta">
      <button class="btn primary xl pulse" data-act="open-store">🔑 Ouvrir le magasin</button>
      <span class="hero-hint">≈ ${num(Math.min(pot, cap))} clients attendus</span>
    </div>
  </section>

  ${c ? `<section class="card coach">
    <span class="coach-icon">💡</span>
    <div><h3>${c.title}</h3><p>${c.text}</p></div>
    <div class="coach-actions">
      ${c.cta ? `<button class="btn primary sm" data-act="nav" data-arg="${c.screen}">${c.cta}</button>` : ''}
      <button class="btn ghost sm" data-act="tutorial-off">Masquer l’aide</button>
    </div>
  </section>` : ''}

  <section class="kpis">
    <div class="card kpi"><span class="kpi-label">Trésorerie</span><span class="kpi-value ${state.cash < 0 ? 'neg' : ''}">${money(state.cash)}</span>
      <span class="kpi-sub">Charges du jour : ${money0(charges.total)}${state.loan ? ` · prêt ${money0(state.loan.daily)}/j` : ''}</span></div>
    <div class="card kpi"><span class="kpi-label">Réputation</span><span class="kpi-value">${num(Math.round(state.reputation))}<small> / 100</small></span>
      ${gauge(state.reputation, state.reputation < 25 ? 'orange' : 'green')}</div>
    <div class="card kpi"><span class="kpi-label">Niveau ${state.level}</span><span class="kpi-value small">${esc(lvl.name)}</span>
      ${gauge(xp.pct, 'purple')}<span class="kpi-sub">${xp.max ? 'Niveau maximum' : `${num(xp.current)} / ${num(xp.needed)} XP`}</span></div>
    <div class="card kpi"><span class="kpi-label">Affluence prévue</span><span class="kpi-value">${num(pot)}<small> clients</small></span>
      <span class="kpi-sub ${pot > cap || image < 1 ? 'warn' : ''}">${image < 1 ? `⚠️ Prix jugés trop élevés : −${Math.round((1 - image) * 100)} % de clients` : pot > cap ? `⚠️ Caisse saturée (max ${cap}) : embauche un caissier` : `Capacité de caisse : ${cap}/jour`}</span></div>
  </section>

  <div class="dash-grid">
    <div class="col">
      <section class="card">
        <div class="card-head"><h2>🎯 Objectifs</h2>
          <div class="tabs sm">
            <button class="${ui.objTab === 'daily' ? 'on' : ''}" data-act="obj-tab" data-arg="daily">Du jour</button>
            <button class="${ui.objTab === 'weekly' ? 'on' : ''}" data-act="obj-tab" data-arg="weekly">Semaine</button>
            <button class="${ui.objTab === 'long' ? 'on' : ''}" data-act="obj-tab" data-arg="long">Long terme</button>
          </div>
        </div>
        <div class="objectives">${objList.map(objectiveRow).join('') || '<p class="muted">Tous les objectifs sont validés. Bravo !</p>'}</div>
        ${state.finalDone ? `<p class="muted small">🏆 Objectif final atteint — tu joues en mode libre.</p>` : ''}
      </section>
      <section class="card">
        <div class="card-head"><h2>📈 Chiffre d'affaires — 14 derniers jours</h2></div>
        ${revenueChart(state.history)}
      </section>
      ${historyCard(state)}
    </div>
    <div class="col">
      <section class="card">
        <div class="card-head"><h2>📰 Infos du jour</h2></div>
        <ul class="news">
          ${state.morningNews.map((n) => `<li>${esc(n)}</li>`).join('')}
          ${activeCampaigns(state).map((c) => `<li class="promo"><b>${c.def.emoji} ${esc(c.def.name)}</b> — +${Math.round((c.def.traffic - 1) * 100)} % de clients, ${c.endDay === state.day ? 'dernier jour' : `jusqu’au jour ${c.endDay}`}.</li>`).join('')}
          ${activePromos(state).length ? `<li class="promo"><b>📣 En promo :</b> ${activePromos(state).map((x) => PRODUCT_BY_ID[x.productId] ? `${PRODUCT_BY_ID[x.productId].emoji} −${x.pct} %` : '').join(' · ')} <button class="link" data-act="goto-promos">Gérer</button></li>` : state.day >= 2 && !activeCampaigns(state).length ? `<li class="promo">💡 Envie de plus de clients ? Lance une promo ou une campagne de prospectus. <button class="link" data-act="goto-promos">Voir les promotions</button></li>` : ''}
          ${events.map((e) => `<li class="event"><b>${e.emoji} ${esc(e.name)}</b> — ${esc(e.desc)}</li>`).join('')}
          ${upcoming.map((u) => `<li class="event soon"><b>${u.def.emoji} ${esc(u.def.name)}</b> ${u.inDays === 1 ? 'demain' : `dans ${u.inDays} jours`} — ${esc(u.def.desc)}</li>`).join('')}
          ${!state.morningNews.length && !events.length && !upcoming.length ? '<li class="muted">Journée ordinaire, rien à signaler.</li>' : ''}
        </ul>
      </section>
      <section class="card">
        <div class="card-head"><h2>🔔 Alertes stock</h2>${alerts.length ? badge(String(alerts.length), 'orange') : ''}</div>
        ${alerts.length ? `<ul class="alerts">${alerts.slice(0, 8).map((a) => `<li>${pastille(a.p, 'sm')}<span>${esc(a.p.name)}</span>${badge(a.text, a.tone)}</li>`).join('')}</ul>
          ${alerts.length > 8 ? `<p class="muted small">… et ${alerts.length - 8} autres (voir Stock).</p>` : ''}
          <div class="row-actions"><button class="btn ghost sm" data-act="nav" data-arg="orders">Commander</button><button class="btn ghost sm" data-act="nav" data-arg="shelves">Rayons</button></div>`
          : '<p class="muted">✨ Tout est en ordre : aucun risque de rupture.</p>'}
      </section>
      ${state.loan || lowCash ? `<section class="card loan">
        <div class="card-head"><h2>🏦 Prêt d'urgence</h2></div>
        ${state.loan ? `<p>Reste à rembourser : <b>${money(state.loan.remaining)}</b> (${money(state.loan.daily)} par jour).</p>` : ''}
        ${canTakeLoan(state) && lowCash ? `<p class="muted">Caisse à sec ? La banque avance <b>${money0(offer.amount)}</b>, remboursés ${money0(offer.total)} en ${offer.days} jours (${money(offer.daily)}/jour).</p>
          <button class="btn primary sm" data-act="take-loan">Accepter le prêt</button>` : ''}
      </section>` : ''}
    </div>
  </div>`;
}

on('goto-promos', () => { ui.screen = 'prices'; ui.priceTab = 'promos'; ui.entering = true; store.commit(); });
on('obj-tab', (arg) => { ui.objTab = arg as typeof ui.objTab; store.commit(); });
on('tutorial-off', () => { store.state.tutorialOff = true; store.commit(); });
on('take-loan', () => {
  if (takeLoan(store.state)) toast(`🏦 Prêt accordé : +${money0(loanOffer(store.state).amount)}`, 'success');
  store.commit();
});
