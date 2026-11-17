// Interface des magasins gérés : sélecteur dans la barre du haut, section « Mes magasins »
// (Améliorations), choix d'un gérant, bandeau du magasin confié à un gérant.
import { levelDef } from '../data/levels';
import { MANAGERS, MANAGER_BY_ID, MIN_SHOPS_TO_DELEGATE, SHOPS, type ManagerId, type ShopDef } from '../data/shops';
import { store } from '../state/store';
import type { GameState, ShopEntry } from '../state/types';
import { managerSalary } from '../systems/shopMeta';
import {
  activeShop, activeShopIndex, buyShop, delegateBlock, delegateShop, ownsShop, shopCount, shopDef, shopList, switchShop, takeBackShop,
} from '../systems/shops';
import { on } from './actions';
import { sfx } from './audio';
import { badge, catPastille, esc, money0, num } from './dom';
import { confetti } from './fx';
import { closeModal, openModal } from './modal';
import { toast } from './toast';
import { ui } from './uiState';

const managerLabel = (e: ShopEntry) => (e.manager ? `${MANAGER_BY_ID[e.manager].emoji} ${MANAGER_BY_ID[e.manager].name}` : '🙋 Géré par toi');

/** Pastille du magasin affiché dans la barre du haut (dès 2 magasins). */
export function shopChip(state: GameState): string {
  if (shopCount(state) < 2) return '';
  const d = shopDef(activeShop(state).id);
  return `<button class="top-chip shop-chip" data-act="shop-menu" title="Changer de magasin">${d.emoji} <b>${esc(d.name)}</b> ▾</button>`;
}

function shopMenuBody(state: GameState): string {
  const active = activeShopIndex(state);
  return `<ul class="shop-menu">${shopList(state).map((e, i) => {
    const d = shopDef(e.id);
    return `<li><button class="shop-menu-item ${i === active ? 'on' : ''}" data-act="shop-switch" data-arg="${i}">
      <span class="shop-emoji">${d.emoji}</span><span><b>${esc(d.name)}</b><span class="small muted">${managerLabel(e)}${e.last ? ` · hier ${money0(e.last.revenue)} de CA` : ''}</span></span>
      ${i === active ? badge('Affiché', 'green') : ''}</button></li>`;
  }).join('')}</ul>
  <p class="small muted">Trésorerie, niveau, licences et façade sont communs à tous tes magasins. Rayons, stock, prix, commandes, équipement et réputation sont propres à chacun.</p>`;
}

on('shop-menu', () => openModal({ title: '🏪 Mes magasins', body: shopMenuBody(store.state) }));

on('shop-switch', (arg) => {
  if (ui.simRunning) return;
  const i = Number(arg);
  closeModal();
  if (i === activeShopIndex(store.state)) return;
  switchShop(store.state, i);
  ui.entering = true;
  toast(`${shopDef(activeShop(store.state).id).emoji} Tu gères maintenant : ${esc(shopDef(activeShop(store.state).id).name)}.`, 'info');
  store.commit();
});

/** Bandeau d'un magasin confié à un gérant (tableau de bord). */
export function delegatedBanner(state: GameState): string {
  const e = activeShop(state);
  if (!e.manager) return '';
  const m = MANAGER_BY_ID[e.manager];
  return `<section class="card coach"><p>${m.emoji} <b>Ce magasin est confié à : ${esc(m.name)}.</b> Chaque matin, ce gérant fixe les prix, commande et range les rayons à ta place. Tes changements ici seront donc revus par lui.</p>
    <div class="row-actions"><button class="btn ghost sm" data-act="shop-takeback" data-arg="${activeShopIndex(state)}">🙋 Reprendre la main</button></div></section>`;
}

function ownedCard(state: GameState, e: ShopEntry, i: number): string {
  const d = shopDef(e.id);
  const active = i === activeShopIndex(state);
  const block = delegateBlock(state, i);
  return `<div class="card upgrade ${active ? 'maxed' : ''}">
    <div class="up-head">${catPastille(d.emoji, 30, 'lg')}<div><h3>${esc(d.name)}</h3><span class="small muted">📍 ${esc(d.city)}</span></div></div>
    <p class="up-effect">${managerLabel(e)}${e.manager ? ` · ${money0(managerSalary(MANAGER_BY_ID[e.manager], state.level))}/jour` : ''}</p>
    <p class="small muted">${e.last ? `Dernière journée : ${money0(e.last.revenue)} de CA, <b class="${e.last.profit >= 0 ? 'pos' : 'neg'}">${money0(e.last.profit)}</b> de bénéfice, ${num(e.last.customers)} clients.` : 'Pas encore de journée d’ouverture.'}</p>
    <div class="up-foot shop-actions">
      ${active ? badge('👁️ Affiché', 'green') : `<button class="btn ghost sm" data-act="shop-switch" data-arg="${i}">👁️ Afficher</button>`}
      ${e.manager ? `<button class="btn ghost sm" data-act="shop-takeback" data-arg="${i}">🙋 Reprendre la main</button>`
        : `<button class="btn ${block ? 'ghost' : 'primary'} sm" data-act="shop-delegate-open" data-arg="${i}" ${block ? `disabled title="${esc(block)}"` : ''}>🧑‍💼 Confier à un gérant</button>`}
    </div>
  </div>`;
}

function buyCard(state: GameState, d: ShopDef): string {
  const locked = state.level < d.minLevel;
  const afford = state.cash >= d.cost;
  return `<div class="card upgrade ${locked ? 'locked' : ''}">
    <div class="up-head">${catPastille(d.emoji, 30, 'lg')}<div><h3>${esc(d.name)}</h3><span class="small muted">📍 ${esc(d.city)}</span></div></div>
    <p class="small muted">Un vrai magasin à la taille de ton enseigne : rayons vides et sans équipement au départ, à remplir et équiper (ou à confier à un gérant).</p>
    <div class="up-foot">${locked ? badge(`🔒 Niveau ${d.minLevel} requis (${esc(levelDef(d.minLevel).name)})`, 'grey')
      : `<button class="btn ${afford ? 'primary' : 'ghost'} block" data-act="shop-buy" data-arg="${d.id}" ${afford ? '' : 'disabled'}>Acheter · ${money0(d.cost)}</button>`}</div>
  </div>`;
}

/** Section « Mes magasins » de l'écran Améliorations. */
export function shopsSection(state: GameState): string {
  const list = shopList(state);
  const toBuy = SHOPS.filter((d) => !ownsShop(state, d.id));
  return `<h2 class="group-title">🏪 Mes magasins</h2>
  <p class="muted small group-note">De vrais magasins que tu gères : chacun a ses rayons, son stock, ses prix et son équipement. Dès ${MIN_SHOPS_TO_DELEGATE} magasins, tu peux en confier à un gérant, mais tu dois toujours en garder au moins un. Change de magasin avec le bouton en haut de l’écran.</p>
  <section class="upgrade-grid">${list.map((e, i) => ownedCard(state, e, i)).join('')}${toBuy.map((d) => buyCard(state, d)).join('')}</section>`;
}

on('shop-buy', (id) => {
  const err = buyShop(store.state, id);
  if (err) return toast(err, 'error');
  sfx.level();
  confetti(1800);
  toast(`🏪 Nouveau magasin : ${esc(SHOPS.find((s) => s.id === id)!.name)} ! Passe dessus avec le bouton en haut pour le remplir, ou confie-le à un gérant.`, 'success');
  store.commit();
});

on('shop-delegate-open', (arg) => {
  const i = Number(arg);
  const state = store.state;
  const d = shopDef(shopList(state)[i].id);
  openModal({
    title: `🧑‍💼 Confier « ${esc(d.name)} »`,
    body: `<p class="muted">Le gérant fixe les prix du marché, commande et range les rayons chaque matin. Il garde toujours une réserve dans la caisse commune. Tu peux reprendre la main quand tu veux.</p>
      <div class="manager-list">${MANAGERS.map((m) => `<button class="card manager-card" data-act="shop-delegate" data-arg="${i}:${m.id}">
        <span class="manager-emoji">${m.emoji}</span>
        <span><b>${esc(m.name)}</b><span class="small muted">${esc(m.desc)}</span>
        <span class="small">Rendement <b>${Math.round(m.efficiency * 100)} %</b> · salaire <b>${money0(managerSalary(m, state.level))}/jour</b></span></span>
      </button>`).join('')}</div>`,
  });
});

on('shop-delegate', (arg) => {
  const [i, m] = arg.split(':');
  const err = delegateShop(store.state, Number(i), m as ManagerId);
  closeModal();
  if (err) return toast(err, 'error');
  sfx.success();
  toast(`${MANAGER_BY_ID[m as ManagerId].emoji} ${esc(MANAGER_BY_ID[m as ManagerId].name)} prend la gestion de ${esc(shopDef(shopList(store.state)[Number(i)].id).name)} : prix fixés, commandes passées, rayons rangés.`, 'success');
  store.commit();
});

on('shop-takeback', (arg) => {
  takeBackShop(store.state, Number(arg));
  toast('🙋 Tu reprends la gestion de ce magasin.', 'info');
  store.commit();
});
