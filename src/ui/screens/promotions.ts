// Onglet « Promotions » de l'écran Prix : promos produits et campagnes publicitaires.
import { CATEGORIES } from '../../data/categories';
import { CAMPAIGNS } from '../../data/campaigns';
import { BALANCE } from '../../data/constants';
import { PRODUCT_BY_ID } from '../../data/products';
import type { GameState, Product } from '../../state/types';
import { store } from '../../state/store';
import { activeCampaigns, activePromos, promoPct, promotionTraffic, salePrice } from '../../systems/economy';
import { launchCampaign, promoSlots, startPromo, stopPromo } from '../../systems/promotions';
import { sellableProducts } from '../../systems/progression';
import { assortment, totalQty } from '../../systems/stock';
import { on } from '../actions';
import { sfx } from '../audio';
import { badge, catPastille, esc, gauge, money, money0, num1, pastille } from '../dom';
import { toast } from '../toast';
import { ui } from '../uiState';

const endText = (state: GameState, endDay: number) => (endDay === state.day ? 'se termine ce soir' : `jusqu’au jour ${endDay}`);

function promoRow(state: GameState, p: Product): string {
  const price = state.prices[p.id];
  const active = activePromos(state).find((x) => x.productId === p.id);
  const pct = active ? active.pct : ui.promoPct;
  const promoPrice = active ? salePrice(state, p) : Math.max(0.05, Math.round(price * (1 - pct / 100) * 100) / 100);
  const margin = promoPrice - p.cost;
  return `<tr class="${active ? 'in-cart' : ''}">
    <td><div class="prod-cell">${pastille(p)}<div><b>${esc(p.name)}</b><div class="badges">${p.essential ? badge('Essentiel', 'blue') : ''}${active ? ` ${badge(`−${active.pct} % · ${endText(state, active.endDay)}`, 'purple')}` : ''}</div></div></div></td>
    <td class="num" data-label="Prix normal">${money(price)}</td>
    <td class="num" data-label="${active ? 'Prix promo' : `Prix à −${pct} %`}"><b>${money(promoPrice)}</b></td>
    <td class="num" data-label="Marge"><b class="${margin > 0 ? 'pos' : 'neg'}">${money(margin)}</b>${margin <= 0 ? '<div class="small neg">Vendu à perte</div>' : ''}</td>
    <td class="m-end">${active
      ? `<button class="btn ghost sm" data-act="promo-stop" data-arg="${p.id}">Arrêter</button>`
      : `<button class="btn primary sm" data-act="promo-start" data-arg="${p.id}">📣 −${pct} % · ${ui.promoDays} j</button>`}</td>
  </tr>`;
}

export function renderPromos(state: GameState): string {
  const promos = activePromos(state);
  const slots = promoSlots(state);
  const bonus = Math.round((promotionTraffic(state) - 1) * 100);
  const inRayon = assortment(state);
  const candidates = sellableProducts(state)
    .filter((p) => inRayon.has(p.id) || totalQty(state, p.id) > 0)
    .sort((a, b) => (promoPct(state, b.id) ? 1 : 0) - (promoPct(state, a.id) ? 1 : 0)
      || CATEGORIES.findIndex((c) => c.id === a.cat) - CATEGORIES.findIndex((c) => c.id === b.cat));
  const campaigns = activeCampaigns(state);
  return `
  <section class="promo-summary">
    <div class="card kpi"><span class="kpi-label">Clients en plus aujourd’hui</span><span class="kpi-value ${bonus > 0 ? 'pos' : ''}">+${bonus} %</span>
      <span class="kpi-sub">Chaque promo attire +${Math.round(BALANCE.PROMO_TRAFFIC_EACH * 100)} % de clients (max +${Math.round(BALANCE.PROMO_TRAFFIC_MAX * 100)} %), les campagnes en plus.</span></div>
    <div class="card kpi"><span class="kpi-label">Promos en cours</span><span class="kpi-value">${promos.length}<small> / ${slots}</small></span>
      ${gauge((promos.length / slots) * 100, 'purple')}<span class="kpi-sub">Un emplacement de plus tous les 2 niveaux.</span></div>
  </section>

  <h2 class="group-title">Campagnes publicitaires</h2>
  <section class="upgrade-grid">${CAMPAIGNS.map((c) => {
    const running = campaigns.find((x) => x.id === c.id);
    const cost = c.cost(state.level);
    const locked = state.level < c.minLevel;
    return `<div class="card upgrade ${locked ? 'locked' : ''} ${running ? 'maxed' : ''}">
      <div class="up-head">${catPastille(c.emoji, 280, 'lg')}<div><h3>${esc(c.name)}</h3><span class="small muted">${c.days} jour${c.days > 1 ? 's' : ''}</span></div></div>
      <p class="muted">${esc(c.desc)}</p>
      <p class="up-effect">➜ +${Math.round((c.traffic - 1) * 100)} % de clients${c.rep ? ` · +${num1(c.rep)} réputation/jour` : ''}</p>
      <div class="up-foot">${running ? badge(`✔ En cours · ${endText(state, running.endDay)}`, 'green')
        : locked ? badge(`🔒 Niveau ${c.minLevel} requis`, 'grey')
        : `<button class="btn ${state.cash >= cost ? 'primary' : 'ghost'} block" data-act="campaign" data-arg="${c.id}" ${state.cash >= cost ? '' : 'disabled'}>Lancer · ${money0(cost)}</button>`}</div>
    </div>`;
  }).join('')}</section>

  <h2 class="group-title">Promotions sur les produits</h2>
  <section class="card toolbar">
    <p class="muted small">Un produit en promo se vend mieux (prix plus bas + mise en avant) et attire de nouveaux clients dans le magasin. Attention à ne pas vendre à perte !</p>
    <div class="chips">
      <span class="small muted">Réduction</span>
      ${BALANCE.PROMO_PCTS.map((v) => `<button class="chip ${ui.promoPct === v ? 'on' : ''}" data-act="promo-pct" data-arg="${v}">−${v} %</button>`).join('')}
    </div>
    <div class="chips">
      <span class="small muted">Durée</span>
      ${BALANCE.PROMO_DAYS.map((v) => `<button class="chip ${ui.promoDays === v ? 'on' : ''}" data-act="promo-days" data-arg="${v}">${v} jour${v > 1 ? 's' : ''}</button>`).join('')}
    </div>
  </section>
  <section class="card table-card">
    <table class="table mcards">
      <thead><tr><th>Produit</th><th class="num">Prix normal</th><th class="num">Prix promo</th><th class="num">Marge</th><th></th></tr></thead>
      <tbody>${candidates.map((p) => promoRow(state, p)).join('') || '<tr><td colspan="5" class="muted center">Mets d’abord des produits en rayon.</td></tr>'}</tbody>
    </table>
  </section>`;
}

on('promo-pct', (v) => { ui.promoPct = Number(v); store.commit(); });
on('promo-days', (v) => { ui.promoDays = Number(v); store.commit(); });
on('promo-start', (pid) => {
  const err = startPromo(store.state, pid, ui.promoPct, ui.promoDays);
  if (err) return toast(err, 'error');
  sfx.success();
  toast(`📣 Promo −${ui.promoPct} % sur ${esc(PRODUCT_BY_ID[pid].name)} pendant ${ui.promoDays} jour${ui.promoDays > 1 ? 's' : ''}.`, 'success');
  store.commit();
});
on('promo-stop', (pid) => { stopPromo(store.state, pid); store.commit(); });
on('campaign', (id) => {
  const err = launchCampaign(store.state, id);
  if (err) return toast(err, 'error');
  sfx.success();
  toast('📣 Campagne lancée : plus de clients dès aujourd’hui !', 'success');
  store.commit();
});
