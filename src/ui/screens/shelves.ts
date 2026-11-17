// Écran 2 : rayons (grille visuelle des emplacements).
import { CATEGORIES, CATEGORY_BY_ID } from '../../data/categories';
import { PRODUCT_BY_ID } from '../../data/products';
import type { GameState, Product } from '../../state/types';
import { store } from '../../state/store';
import { up } from '../../systems/economy';
import { isNewProduct, newBadgeTitle, sellableProducts } from '../../systems/progression';
import { assignSlot, autoArrange, canAssign, coldCapacity, coldUsed, fillAll, fillSlot, setSlotQty, slotCapacity, totalQty, warehouseQty } from '../../systems/stock';
import { on } from '../actions';
import { productBadges } from '../alerts';
import { sfx } from '../audio';
import { badge, esc, gauge, newBadge, num, pastille } from '../dom';
import { closeModal, openModal, updateModalBody } from '../modal';
import { toast } from '../toast';
import { ui } from '../uiState';

function slotCard(state: GameState, i: number): string {
  const slot = state.slots[i];
  const p = slot.productId ? PRODUCT_BY_ID[slot.productId] : null;
  if (!p) {
    return `<button class="slot empty" data-act="slot-pick" data-arg="${i}"><span class="slot-plus">＋</span><span>Choisir un produit</span><span class="slot-num">${i + 1}</span></button>`;
  }
  const cap = slotCapacity(p);
  const wh = warehouseQty(state, p.id);
  const pct = (slot.qty / cap) * 100;
  const cold = p.storage === 'fridge' ? '<span class="slot-cold" title="Réfrigéré">🧊</span>' : p.storage === 'freezer' ? '<span class="slot-cold" title="Surgelé">❄️</span>' : '';
  return `<div class="slot ${slot.qty === 0 ? 'out' : ''}" style="--h:${CATEGORY_BY_ID[p.cat].hue}">
    <span class="slot-num">${i + 1}</span>${cold}
    <button class="slot-head" data-act="slot-pick" data-arg="${i}" title="Changer de produit">
      ${pastille(p, 'lg')}<span class="slot-name">${esc(p.name)}${isNewProduct(p, state) ? `<br>${newBadge(newBadgeTitle(p, state))}` : ''}</span>
    </button>
    <div class="slot-badges">${productBadges(state, p)}</div>
    ${gauge(pct)}
    <div class="slot-qty"><b>${slot.qty}</b> / ${cap} <span class="muted">· entrepôt ${num(wh)}</span></div>
    <div class="slot-actions">
      <button class="btn icon" data-act="slot-qty" data-arg="${i}:-5" ${slot.qty === 0 ? 'disabled' : ''} title="Retirer 5">−</button>
      <button class="btn icon" data-act="slot-qty" data-arg="${i}:5" ${slot.qty >= cap || wh === 0 ? 'disabled' : ''} title="Ajouter 5">＋</button>
      <button class="btn sm ${slot.qty < cap && wh > 0 ? 'primary' : 'ghost'}" data-act="slot-fill" data-arg="${i}" ${slot.qty >= cap || wh === 0 ? 'disabled' : ''}>Remplir</button>
    </div>
  </div>`;
}

export function renderShelves(state: GameState): string {
  const used = state.slots.filter((s) => s.productId).length;
  const filled = state.slots.reduce((s, x) => s + (x.productId ? x.qty / slotCapacity(PRODUCT_BY_ID[x.productId]) : 0), 0);
  const fridgeCap = coldCapacity(state, 'fridge');
  const freezerCap = coldCapacity(state, 'freezer');
  return `
  <div class="screen-head">
    <div><h1>🗄️ Rayons</h1><p class="muted">Seuls les produits placés en rayon sont vendus. ${up(state, 'stocker') ? '🧑‍🔧 Ton employé remplit les rayons chaque matin et en journée.' : 'Remplis-les chaque matin depuis l’entrepôt.'}</p></div>
    <div class="head-actions">
      <button class="btn ghost" data-act="auto-arrange" title="Répartit tous les emplacements selon la demande">✨ Agencement auto</button>
      <button class="btn primary" data-act="fill-all">📥 Tout remplir</button>
    </div>
  </div>
  <section class="card stat-strip">
    <div><span class="kpi-label">Emplacements utilisés</span><b>${used} / ${state.slots.length}</b>${gauge((used / state.slots.length) * 100, 'blue')}</div>
    <div><span class="kpi-label">Remplissage global</span><b>${Math.round((filled / Math.max(1, state.slots.length)) * 100)} %</b>${gauge((filled / Math.max(1, state.slots.length)) * 100)}</div>
    <div><span class="kpi-label">🧊 Réfrigéré</span><b>${fridgeCap ? `${coldUsed(state, 'fridge')} / ${fridgeCap}` : 'Aucun frigo'}</b>${fridgeCap ? gauge((coldUsed(state, 'fridge') / fridgeCap) * 100, 'blue') : ''}</div>
    <div><span class="kpi-label">❄️ Surgelé</span><b>${freezerCap ? `${coldUsed(state, 'freezer')} / ${freezerCap}` : 'Aucun congélateur'}</b>${freezerCap ? gauge((coldUsed(state, 'freezer') / freezerCap) * 100, 'blue') : ''}</div>
  </section>
  <section class="slot-grid">${state.slots.map((_, i) => slotCard(state, i)).join('')}</section>`;
}

type PickerFilter = 'all' | 'todo' | 'placed' | 'new';

function pickerBody(state: GameState, slotIndex: number): string {
  const current = state.slots[slotIndex]?.productId;
  // Emplacements occupés par chaque produit (sans compter celui qu'on modifie)
  const placedIn = new Map<string, number[]>();
  state.slots.forEach((s, i) => {
    if (s.productId && i !== slotIndex) placedIn.set(s.productId, [...(placedIn.get(s.productId) ?? []), i + 1]);
  });
  const all = sellableProducts(state);
  const filter = ui.pickerFilter as PickerFilter;
  const todoCount = all.filter((p) => !placedIn.has(p.id) && totalQty(state, p.id) > 0).length;
  const placedCount = all.filter((p) => placedIn.has(p.id)).length;
  const newCount = all.filter((p) => isNewProduct(p, state)).length;
  const keep = (p: Product) => filter === 'all' || (filter === 'new' ? isNewProduct(p, state) : filter === 'placed' ? placedIn.has(p.id) : !placedIn.has(p.id));
  // Ordre : en stock et pas encore en rayon → pas en rayon sans stock → déjà en rayon
  // Les nouveautés passent devant à rang égal.
  const rank = (p: Product) => (placedIn.has(p.id) ? 4 : totalQty(state, p.id) > 0 ? 0 : 2) - (isNewProduct(p, state) ? 1 : 0);
  const groups = CATEGORIES.map((c) => ({ c, list: all.filter((p) => p.cat === c.id && keep(p)).sort((a, b) => rank(a) - rank(b)) })).filter((g) => g.list.length);
  const chip = (id: PickerFilter, label: string) => `<button class="chip ${filter === id ? 'on' : ''}" data-act="picker-filter" data-arg="${id}">${label}</button>`;
  return `
    <div class="picker-head">
      <div class="chips">
        ${newCount ? chip('new', `✨ Nouveautés (${newCount})`) : ''}
        ${chip('all', `Tous (${all.length})`)}
        ${chip('todo', `Pas encore en rayon (${all.length - placedCount})`)}
        ${chip('placed', `✓ Déjà en rayon (${placedCount})`)}
      </div>
      ${current ? `<button class="btn danger sm" data-act="slot-assign" data-arg="">🗑️ Libérer cet emplacement</button>` : ''}
    </div>
    ${newCount ? `<p class="small new-note">✨ ${num(newCount)} nouveau${newCount > 1 ? 'x' : ''} produit${newCount > 1 ? 's' : ''} disponible${newCount > 1 ? 's' : ''} depuis peu.${all.some((p) => isNewProduct(p, state) && !totalQty(state, p.id)) ? ' Pense à les commander !' : ''}</p>` : ''}
    ${todoCount ? `<p class="small muted">💡 ${num(todoCount)} produit${todoCount > 1 ? 's' : ''} en stock ${todoCount > 1 ? 'ne sont' : 'n’est'} pas encore en rayon : ${todoCount > 1 ? 'ils sont affichés' : 'il est affiché'} en premier.</p>` : ''}
    ${groups.map((g) => `<h4 class="picker-cat">${g.c.emoji} ${g.c.name}</h4><div class="picker-grid">
      ${g.list.map((p) => {
        const err = canAssign(state, slotIndex, p.id);
        const stock = totalQty(state, p.id);
        const where = placedIn.get(p.id);
        return `<button class="picker-item ${p.id === current ? 'on' : ''} ${where ? 'placed' : stock ? 'todo' : ''}" data-act="slot-assign" data-arg="${p.id}" ${err ? `disabled title="${esc(err)}"` : ''}>
          ${pastille(p)}<span class="picker-name">${esc(p.name)}${isNewProduct(p, state) ? ' ' + newBadge(newBadgeTitle(p, state)) : ''}${p.essential ? ' ' + badge('Essentiel', 'blue') : ''}</span>
          <span class="muted small">${stock ? `${num(stock)} en stock` : 'Pas de stock'} · ${slotCapacity(p)}/empl.</span>
          ${where ? `<span class="picker-placed">✓ Déjà en rayon · empl. ${where.join(', ')}</span>` : stock ? '<span class="picker-todo">À placer</span>' : ''}
        </button>`;
      }).join('')}</div>`).join('') || '<p class="muted">Aucun produit dans ce filtre.</p>'}`;
}

on('picker-filter', (f) => {
  ui.pickerFilter = f;
  updateModalBody(pickerBody(store.state, ui.pickerSlot));
});

on('slot-pick', (arg) => {
  ui.pickerSlot = Number(arg);
  openModal({ title: `Emplacement ${ui.pickerSlot + 1} — choisir un produit`, body: pickerBody(store.state, ui.pickerSlot), wide: true });
});
on('slot-assign', (arg) => {
  const err = assignSlot(store.state, ui.pickerSlot, arg || null);
  if (err) return toast(err, 'error');
  closeModal();
  sfx.click();
  store.commit();
});
on('slot-fill', (arg) => { fillSlot(store.state, Number(arg)); sfx.click(); store.commit(); });
on('slot-qty', (arg) => {
  const [i, d] = arg.split(':').map(Number);
  setSlotQty(store.state, i, store.state.slots[i].qty + d);
  store.commit();
});
on('fill-all', () => {
  const n = fillAll(store.state);
  toast(n ? `📥 ${num(n)} articles mis en rayon.` : 'Rien à ajouter : rayons pleins ou entrepôt vide.', n ? 'success' : 'info');
  store.commit();
});
on('auto-arrange', () => {
  autoArrange(store.state);
  toast('✨ Rayons réorganisés selon la demande.', 'success');
  store.commit();
});
