// Coquille de l'application : barre latérale, barre du haut, routage des écrans.
import { WEEKDAYS } from '../data/constants';
import { levelDef } from '../data/levels';
import { PRODUCT_BY_ID } from '../data/products';
import { UPGRADES } from '../data/upgrades';
import { saveGame } from '../state/save';
import { store } from '../state/store';
import type { GameState } from '../state/types';
import { up, weekdayOf } from '../systems/economy';
import { upgradeCost } from '../systems/progression';
import { runDay } from '../systems/simulation';
import { slotCapacity, warehouseQty } from '../systems/stock';
import { initActions, on } from './actions';
import { initInstall } from './install';
import { askAccountOnFirstLaunch, cloudPill, setupCloud } from './cloud';
import { invalidateLeaderboard } from './leaderboard';
import { applySearch } from './search';
import { collectAlerts } from './alerts';
import { sfx } from './audio';
import { renderDebug } from './debug';
import { $, esc, money, money0, num } from './dom';
import { animateNumber } from './fx';
import { confirmDialog, modalOpen } from './modal';
import { announceFinal, maybeCelebrate, reportVisible, showReport } from './report';
import { renderDashboard } from './screens/dashboard';
import { renderOrders } from './screens/orders';
import { renderPrices } from './screens/prices';
import { renderSettings } from './screens/settings';
import { renderShelves } from './screens/shelves';
import { renderStats } from './screens/stats';
import { renderStock } from './screens/stock';
import { renderUpgrades } from './screens/upgrades';
import { markSlotSeen, renderDecor, unseenDecor } from './screens/decor';
import { playDay } from './simulation';
import { toast } from './toast';
import { ui, type ScreenId } from './uiState';

/** `short` : libellé de la barre d'onglets sur mobile. */
const NAV: { id: ScreenId; icon: string; label: string; short: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Tableau de bord', short: 'Accueil' },
  { id: 'shelves', icon: '🗄️', label: 'Rayons', short: 'Rayons' },
  { id: 'prices', icon: '🏷️', label: 'Prix', short: 'Prix' },
  { id: 'orders', icon: '🚚', label: 'Commandes', short: 'Achats' },
  { id: 'stock', icon: '📦', label: 'Stock', short: 'Stock' },
  { id: 'upgrades', icon: '🛠️', label: 'Améliorations', short: 'Équiper' },
  { id: 'decor', icon: '🎨', label: 'Façade', short: 'Façade' },
  { id: 'stats', icon: '📊', label: 'Statistiques', short: 'Stats' },
  { id: 'settings', icon: '⚙️', label: 'Paramètres', short: 'Réglages' },
];

const SCREENS: Record<ScreenId, (s: GameState) => string> = {
  dashboard: renderDashboard, shelves: renderShelves, prices: renderPrices, orders: renderOrders,
  stock: renderStock, upgrades: renderUpgrades, decor: renderDecor, stats: renderStats, settings: renderSettings,
};

function refillable(state: GameState): number {
  return state.slots.filter((s) => s.productId && s.qty < slotCapacity(PRODUCT_BY_ID[s.productId]) && warehouseQty(state, s.productId) > 0).length;
}

function navBadge(state: GameState, id: ScreenId): string {
  let n = 0;
  let tone = 'orange';
  if (id === 'shelves') n = refillable(state);
  if (id === 'orders') { n = state.cart.length; tone = 'green'; }
  if (id === 'stock') n = collectAlerts(state).filter((a) => a.kind === 'rupture' || a.kind === 'expToday').length;
  if (id === 'decor') { n = unseenDecor(state); tone = 'orange'; }
  if (id === 'upgrades') { n = UPGRADES.filter((u) => state.level >= u.minLevel && (upgradeCost(state, u.id) ?? Infinity) <= state.cash).length; tone = 'green'; }
  return n ? `<span class="nav-badge ${tone}">${n}</span>` : '';
}

let shownCash: number | null = null;

function render(): void {
  const state = store.state;
  document.documentElement.dataset.theme = state.settings.dark ? 'dark' : 'light';
  const app = document.getElementById('app')!;
  // Position de défilement : zone interne (ordinateur) ou page entière (mobile).
  const scroller = $('.main', app);
  const scroll = scroller?.scrollTop ?? 0;
  const pageScroll = window.scrollY;
  const lvl = levelDef(state.level);
  app.innerHTML = `
  <div class="app">
    <aside class="sidebar">
      <div class="logo"><span class="logo-icon">🏪</span><div><b>Ma Supérette</b><span>${esc(lvl.name)}</span></div></div>
      <nav>${NAV.map((n) => `<button class="nav-btn ${ui.screen === n.id ? 'on' : ''}" data-act="nav" data-arg="${n.id}">
        <span class="nav-icon">${n.icon}</span><span class="nav-label">${n.label}</span><span class="nav-short">${n.short}</span>${navBadge(state, n.id)}</button>`).join('')}</nav>
      <div class="sidebar-foot">
        <button class="btn icon" data-act="quick-sound" title="Son">${state.settings.sound ? '🔊' : '🔇'}</button>
        <button class="btn icon" data-act="quick-dark" title="Thème">${state.settings.dark ? '🌙' : '☀️'}</button>
        ${cloudPill()}
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="top-chips">
          <span class="top-chip" title="Jour">📅 <b>J${state.day}</b><span class="m-hide"> · ${WEEKDAYS[weekdayOf(state.day)]}</span></span>
          <span class="top-chip cash ${state.cash < 0 ? 'neg' : ''}" title="Trésorerie">💶 <b id="top-cash">${money(state.cash)}</b></span>
          <span class="top-chip" title="Réputation">⭐ <b>${num(Math.round(state.reputation))}</b><span class="m-hide">/100</span></span>
          <span class="top-chip" title="Niveau du magasin">🏅 <span class="m-hide">Niv. </span><b>${state.level}</b></span>
        </div>
        <button class="btn primary top-open" data-act="open-store" aria-label="Ouvrir le magasin">🔑 <span class="m-hide">Ouvrir le magasin</span><span class="m-short">Ouvrir</span></button>
      </header>
      <main class="screen ${ui.entering ? 'enter' : ''}" id="screen">${SCREENS[ui.screen](state)}</main>
    </div>
  </div>${renderDebug(state)}`;
  const newScroller = $('.main', app);
  if (ui.entering) {
    window.scrollTo(0, 0);
    ui.cartOpen = false;
    document.body.classList.remove('sheet-open');
  } else {
    // Défilement immédiat (pas d'option « behavior » : compatible avec tous les Safari d'iPhone).
    if (newScroller) newScroller.scrollTop = scroll;
    if (pageScroll) window.scrollTo(0, pageScroll);
  }
  ui.entering = false;
  if (ui.screen === 'decor') queueMicrotask(() => markSlotSeen(state));
  // Recherche en cours : messages « aucun résultat » et suggestions à jour après chaque rendu.
  if (ui.screen === 'orders' || ui.screen === 'stock' || ui.screen === 'prices') applySearch(ui.screen);
  const cashEl = $('#top-cash');
  if (cashEl && shownCash !== null && shownCash !== state.cash) animateNumber(cashEl, shownCash, state.cash, money, 600);
  shownCash = state.cash;

  // Reprise après rechargement : bilan en attente, célébration en attente.
  if (state.phase === 'report' && !ui.simRunning && !reportVisible()) showReport();
  else if (state.phase === 'morning' && !ui.simRunning && !modalOpen()) setTimeout(maybeCelebrate, 300);
}

function openStore(): void {
  const state = store.state;
  ui.simRunning = true;
  document.getElementById('toast-root')?.replaceChildren();
  sfx.open();
  const outcome = runDay(state);
  saveGame(state);
  playDay(outcome, () => {
    ui.simRunning = false;
    invalidateLeaderboard();
    showReport();
  });
}

on('nav', (id) => {
  if (ui.screen !== id) ui.entering = true;
  ui.screen = id as ScreenId;
  sfx.click();
  render();
});
on('quick-sound', () => { store.state.settings.sound = !store.state.settings.sound; store.commit(); sfx.click(); });
on('quick-dark', () => { store.state.settings.dark = !store.state.settings.dark; store.commit(); });
on('open-store', () => {
  const state = store.state;
  if (ui.simRunning || state.phase !== 'morning') return;
  const onShelf = state.slots.reduce((s, x) => s + x.qty, 0);
  const toFill = up(state, 'stocker') ? 0 : refillable(state);
  if (onShelf === 0 && toFill === 0) {
    confirmDialog('Rayons vides !', 'Aucun produit n’est en rayon : tu ne vendras rien aujourd’hui et ta réputation va chuter. Ouvrir quand même ?', 'Ouvrir quand même', openStore, true);
  } else if (state.cart.length) {
    confirmDialog('Commande non validée', `Ton panier contient ${state.cart.length} produit${state.cart.length > 1 ? 's' : ''} non commandé${state.cart.length > 1 ? 's' : ''}. Ouvrir sans valider la commande ?`, 'Ouvrir sans commander', openStore);
  } else if (toFill > 0) {
    confirmDialog('Rayons à remplir', `${toFill} emplacement${toFill > 1 ? 's peuvent' : ' peut'} encore être rempli${toFill > 1 ? 's' : ''} depuis l’entrepôt (onglet Rayons → « Tout remplir »). Ouvrir quand même ?`, 'Ouvrir quand même', openStore);
  } else openStore();
});

export function initApp(): void {
  initActions();
  initInstall(() => { if (ui.screen === 'settings') render(); });
  setupCloud(render);
  store.subscribe(render);
  store.onDecor = (parts) => {
    toast(parts.length === 1
      ? `🎁 Nouvel élément de façade : ${parts[0].emoji} ${esc(parts[0].name)}`
      : `🎁 ${parts.length} nouveaux éléments de façade : ${parts.map((p) => p.emoji).join(' ')} — voir l’onglet Façade`, 'success');
  };
  store.onObjectives = (done) => {
    for (const o of done) {
      toast(`🎯 Objectif validé : ${esc(o.label)}${o.cash ? ` · +${money0(o.cash)}` : ''}${o.xp ? ` · +${num(o.xp)} XP` : ''}`, 'success');
    }
    if (done.some((o) => o.id === 'final')) announceFinal();
  };
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'd') { ui.debug = !ui.debug; render(); }
  });
  render();
  askAccountOnFirstLaunch();
}
