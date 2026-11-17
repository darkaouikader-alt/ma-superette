// Écran 4 : commandes fournisseurs.
import { CATEGORIES } from '../../data/categories';
import { WEEKDAYS } from '../../data/constants';
import { PRODUCT_BY_ID } from '../../data/products';
import { SUPPLIERS, SUPPLIER_BY_ID } from '../../data/suppliers';
import type { GameState, Product } from '../../state/types';
import { store } from '../../state/store';
import { eventModifiers } from '../../systems/events';
import { isNewProduct, isSellable, newBadgeTitle, sellableProducts } from '../../systems/progression';
import { avgDailyDemand, daysOfStock, totalQty } from '../../systems/stock';
import { autoReorder, cartLots, cartView, effectiveDelay, inTransit, linePrice, placeOrders, setCartLots, storageCapacity, storageCommitted, unitCost } from '../../systems/suppliers';
import { on } from '../actions';
import { productBadges } from '../alerts';
import { sfx } from '../audio';
import { badge, esc, gauge, money, money0, newBadge, num, num1, pastille, plural } from '../dom';
import { toast } from '../toast';
import { compareValues, nextSort, sortBar } from '../sortbar';
import { BALANCE } from '../../data/constants';
import { levelDef } from '../../data/levels';
import { UPGRADE_BY_ID } from '../../data/upgrades';
import { addUrgentToCart, buyerSettings, hasBuyer, lowStockProducts, ruptureProducts, runBuyer } from '../../systems/buyer';
import { applySearch, currentSearch, matchesSearch, onSearchApplied, searchAttrs, searchBox, searchKey } from '../search';
import { saveGame } from '../../state/save';
import { ui } from '../uiState';

const dayName = (day: number) => WEEKDAYS[(day - 1) % 7].toLowerCase();
const delayText = (d: number) => (d === 1 ? 'Demain matin' : `Dans ${d} jours`);

function catalogRow(state: GameState, p: Product, supId: string, catOk = rowCatOk(state, p)): string {
  const sup = SUPPLIER_BY_ID[supId];
  const lots = cartLots(state, supId, p.id);
  const price = linePrice(p, sup, Math.max(1, lots), state);
  const days = daysOfStock(state, p);
  const transit = inTransit(state, p.id);
  return `<tr id="or-${p.id}" class="${lots ? 'in-cart' : ''}" ${searchAttrs('orders', p, catOk)}>
    <td><div class="prod-cell">${pastille(p)}<div><b>${esc(p.name)}</b><div class="badges">${isNewProduct(p, state) ? newBadge(newBadgeTitle(p, state)) + ' ' : ''}${productBadges(state, p)}${p.shelfLife ? ' ' + badge(`⏳ ${p.shelfLife} j`, 'grey') : ''}</div></div></div></td>
    <td class="num" data-label="Stock">${num(totalQty(state, p.id))}${transit ? `<div class="small pos">+${num(transit)} en route</div>` : ''}</td>
    <td class="num" data-label="Ventes">${num1(avgDailyDemand(state, p))}/j<div class="small muted">${Number.isFinite(days) ? `stock ${num1(days)} j` : ''}</div></td>
    <td class="num" data-label="Prix unitaire">${money(unitCost(p, sup, state))}<div class="small muted">lot de ${sup.lotSize}</div></td>
    <td data-label="Quantité"><div class="lot-edit">
      <button class="btn icon" data-act="cart-lots" data-arg="${supId}:${p.id}:-1" ${lots ? '' : 'disabled'}>−</button>
      <span class="lot-count ${lots ? 'on' : ''}">${lots ? `${lots * sup.lotSize}` : '0'}</span>
      <button class="btn icon" data-act="cart-lots" data-arg="${supId}:${p.id}:1">＋</button>
    </div></td>
    <td class="num" data-label="Total">${lots ? `<b>${money(price.total)}</b>${price.discountPct ? `<div class="small pos">remise −${Math.round(price.discountPct * 100)} %</div>` : ''}` : '<span class="muted">—</span>'}</td>
  </tr>`;
}

export function renderOrders(state: GameState): string {
  const mods = eventModifiers(state);
  const sellable = sellableProducts(state);
  const sups = SUPPLIERS.filter((s) => sellable.some((p) => s.categories.includes(p.cat)));
  if (!sups.some((s) => s.id === ui.supplier)) ui.supplier = sups[0].id;
  const sup = SUPPLIER_BY_ID[ui.supplier];
  const prods = sellable.filter((p) => sup.categories.includes(p.cat));
  const cats = CATEGORIES.filter((c) => prods.some((p) => p.cat === c.id));
  if (ui.orderCat !== 'all' && ui.orderCat !== 'new' && !cats.some((c) => c.id === ui.orderCat)) ui.orderCat = 'all';
  const newHere = prods.filter((p) => isNewProduct(p, state));
  if (ui.orderCat === 'new' && !newHere.length) ui.orderCat = 'all';
  // Les nouveautés en tête de liste
  // Tri : par défaut les nouveautés en tête ; sinon le critère choisi (titres de colonnes ou barre « Trier par »).
  const sorters: Record<string, (p: Product) => number | string> = {
    name: (p) => p.name,
    stock: (p) => totalQty(state, p.id),
    sales: (p) => avgDailyDemand(state, p),
    price: (p) => unitCost(p, sup, state),
    qty: (p) => cartLots(state, sup.id, p.id) * sup.lotSize,
    total: (p) => (cartLots(state, sup.id, p.id) ? linePrice(p, sup, cartLots(state, sup.id, p.id), state).total : 0),
  };
  const sortKey = sorters[ui.orderSort] ? ui.orderSort : 'default';
  const shown = prods.slice().sort((a, b) => sortKey === 'default'
    ? Number(isNewProduct(b, state)) - Number(isNewProduct(a, state))
    : compareValues(sorters[sortKey](a), sorters[sortKey](b), ui.orderDir) || a.name.localeCompare(b.name, 'fr'));
  const oth = (k: string, label: string, cls = '') => `<th class="sortable ${cls} ${sortKey === k ? 'sorted' : ''}" data-act="order-sort" data-arg="${k}" title="Trier par ${label.toLowerCase()}">${label}${sortKey === k ? (ui.orderDir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  return `
  <div class="screen-head">
    <div><h1>🚚 Commandes</h1><p class="muted">Chaque fournisseur a son délai, sa taille de lot et sa remise de volume. Les livraisons arrivent le matin, dans l’entrepôt.</p></div>
  </div>
  ${quickBuyBar(state)}
  ${mods.supplierCost > 1 ? `<div class="banner orange">📈 Hausse des prix fournisseur en cours : +${Math.round((mods.supplierCost - 1) * 100)} % sur tous les tarifs.</div>` : ''}
  ${mods.deliveryDelay > 0 ? `<div class="banner red">🚧 Grève des livraisons : +${mods.deliveryDelay} jour de délai sur les commandes passées aujourd'hui.</div>` : ''}
  <div class="orders-grid">
    <div class="col">
      <section class="supplier-tabs">
        ${sups.map((s) => {
          const d = effectiveDelay(s, state);
          return `<button class="supplier ${s.id === ui.supplier ? 'on' : ''}" data-act="supplier" data-arg="${s.id}">
            <span class="sup-emoji">${s.emoji}</span><b>${esc(s.name)}</b>
            ${sellable.some((p) => s.categories.includes(p.cat) && isNewProduct(p, state)) ? `<span class="badge new">✨ ${sellable.filter((p) => s.categories.includes(p.cat) && isNewProduct(p, state)).length} nouveauté${sellable.filter((p) => s.categories.includes(p.cat) && isNewProduct(p, state)).length > 1 ? 's' : ''}</span>` : ''}
            <span class="small">${delayText(d)} · lots de ${s.lotSize}</span>
            <span class="small">${s.priceFactor < 1 ? `Prix −${Math.round((1 - s.priceFactor) * 100)} % · ` : ''}−${Math.round(s.discountPct * 100)} % dès ${s.discountLots} lots</span>
          </button>`;
        }).join('')}
      </section>
      <section class="card table-card">
        <div class="card-head"><div><h2>${sup.emoji} ${esc(sup.name)}</h2><span class="muted small">${esc(sup.desc)}</span></div></div>
        <div class="reorder-bar">
          <span class="small muted">Réassort automatique chez <b>${esc(sup.name)}</b>, d’après tes ventes récentes :</span>
          <div class="row-gap">
            <button class="btn primary sm" data-act="auto-reorder" data-arg="essentials">⭐ Essentiels</button>
            <button class="btn ghost sm" data-act="auto-reorder" data-arg="all">🔁 Tout l’assortiment</button>
          </div>
        </div>
        <div class="pad-x">${searchBox('orders', `Rechercher chez ${sup.name}…`)}<div class="search-elsewhere" id="search-elsewhere"></div>
          ${sortBar('order-sort', { default: 'Nouveautés', name: 'Produit', stock: 'Stock', sales: 'Ventes', price: 'Prix', qty: 'Au panier' }, sortKey, ui.orderDir)}</div>
        <div class="chips pad">
          ${newHere.length ? `<button class="chip new ${ui.orderCat === 'new' ? 'on' : ''}" data-act="order-cat" data-arg="new">✨ Nouveautés (${newHere.length})</button>` : ''}
          <button class="chip ${ui.orderCat === 'all' ? 'on' : ''}" data-act="order-cat" data-arg="all">Tout</button>
          ${cats.map((c) => `<button class="chip ${ui.orderCat === c.id ? 'on' : ''}" data-act="order-cat" data-arg="${c.id}">${c.emoji} ${c.name}</button>`).join('')}
        </div>
        <table class="table mcards">
          <thead><tr>${oth('name', 'Produit')}${oth('stock', 'Stock', 'num')}${oth('sales', 'Ventes', 'num')}${oth('price', 'Prix unitaire', 'num')}${oth('qty', 'Quantité')}${oth('total', 'Total', 'num')}</tr></thead>
          <tbody>${shown.map((p) => catalogRow(state, p, sup.id)).join('')}<tr data-search-empty hidden><td colspan="6" class="muted center"></td></tr></tbody>
        </table>
      </section>
    </div>
    <div class="col side">
      ${buyerCard(state)}
      <div class="cart-dock ${ui.cartOpen ? 'open' : ''}" id="cart-dock"><div class="cart-dock-inner" id="cart-box">${cartPanel(state)}</div></div>
      <section class="card">
        <div class="card-head"><h2>📦 Livraisons en cours</h2></div>
        ${state.orders.length ? state.orders.slice().sort((a, b) => a.arrivalDay - b.arrivalDay).map((o) => {
          const s = SUPPLIER_BY_ID[o.supplierId];
          const d = o.arrivalDay - state.day;
          return `<div class="delivery"><div><b>${s?.emoji ?? '🚚'} ${esc(s?.name ?? '')}</b> ${badge(d <= 1 ? 'Demain' : `Dans ${d} j`, d <= 1 ? 'green' : 'blue')}<span class="muted small"> · ${money(o.total)}</span></div>
            <div class="delivery-items">${o.lines.map((l) => PRODUCT_BY_ID[l.productId] ? `<span title="${esc(PRODUCT_BY_ID[l.productId].name)}">${PRODUCT_BY_ID[l.productId].emoji}×${l.qty}</span>` : '').join(' ')}</div></div>`;
        }).join('') : '<p class="muted">Aucune livraison attendue.</p>'}
      </section>
    </div>
  </div>
  <div id="cartbar-slot">${cartBar(state)}</div>
  ${ui.cartOpen ? '<div class="cart-scrim" data-act="cart-toggle"></div>' : ''}`;
}

/** La ligne passe-t-elle le filtre de catégorie choisi ? */
function rowCatOk(state: GameState, p: Product): boolean {
  return ui.orderCat === 'all' || (ui.orderCat === 'new' ? isNewProduct(p, state) : p.cat === ui.orderCat);
}

/** Pendant une recherche : les autres fournisseurs qui ont des produits correspondants. */
onSearchApplied('orders', () => {
  const box = document.getElementById('search-elsewhere');
  if (!box) return;
  const q = currentSearch('orders');
  // Pendant une recherche, les catégories ne filtrent plus : on les atténue.
  box.closest('.card')?.querySelector('.chips.pad')?.classList.toggle('dimmed', !!q.trim());
  if (!q.trim()) { box.innerHTML = ''; return; }
  const state = store.state;
  const sellable = sellableProducts(state);
  const others = SUPPLIERS.filter((s) => s.id !== ui.supplier)
    .map((s) => ({ s, n: sellable.filter((p) => s.categories.includes(p.cat) && matchesSearch(searchKey(p), q)).length }))
    .filter((x) => x.n > 0);
  box.innerHTML = others.length
    ? `<span class="small muted">Aussi chez :</span> ${others.map((x) => `<button class="chip" data-act="supplier" data-arg="${x.s.id}">${x.s.emoji} ${esc(x.s.name)} (${x.n})</button>`).join('')}`
    : '';
});

/** Boutons « commander les ruptures / le stock faible ». */
function quickBuyBar(state: GameState): string {
  const rupt = ruptureProducts(state).length;
  const low = lowStockProducts(state).length;
  return `<section class="card quick-buy">
    <div><b>⚡ Achats rapides</b><span class="small muted">Au panier chez le fournisseur le plus rapide, pour couvrir les prochains jours.</span></div>
    <div class="row-gap">
      <button class="btn ${rupt ? 'danger' : 'ghost'} sm" data-act="quick-buy" data-arg="rupture" ${rupt ? '' : 'disabled'}>🚫 Tout ce qui est en rupture (${rupt})</button>
      <button class="btn ghost sm" data-act="quick-buy" data-arg="low" ${low ? '' : 'disabled'}>⚠️ Stock faible (${low})</button>
    </div>
  </section>`;
}

/** Carte du responsable des achats (acheteur automatique). */
function buyerCard(state: GameState): string {
  const def = UPGRADE_BY_ID.buyer;
  const head = `<div class="card-head"><h2>${def.emoji} Responsable des achats</h2>${hasBuyer(state) ? `<button class="switch ${buyerSettings(state).enabled ? 'on' : ''}" data-act="buyer-toggle" role="switch" aria-checked="${buyerSettings(state).enabled}" aria-label="Activer les achats automatiques"><i></i></button>` : ''}</div>`;
  if (!hasBuyer(state)) {
    const locked = state.level < def.minLevel;
    return `<section class="card buyer ${locked ? 'locked' : ''}">${head}
      <p class="small muted">Un employé qui passe les commandes chaque matin à ta place, au meilleur prix, en s’assurant que la livraison arrive avant la rupture.</p>
      ${locked
        ? `${badge(`🔒 Niveau ${def.minLevel} requis (${esc(levelDef(def.minLevel).name)})`, 'grey')}${gauge((state.level / def.minLevel) * 100, 'purple')}`
        : `<button class="btn primary sm block" data-act="nav" data-arg="upgrades">Embaucher · ${money0(def.costs[0])} (+${def.salary} €/jour)</button>`}
    </section>`;
  }
  const cfg = buyerSettings(state);
  const last = cfg.last;
  return `<section class="card buyer">${head}
    <p class="small ${cfg.enabled ? 'pos' : 'muted'}"><b>${cfg.enabled ? 'Actif : il commande chaque matin' : 'En pause : tu commandes toi-même'}</b></p>
    <div class="buyer-opt"><span class="small muted">Stock visé</span><div class="tabs sm">${BALANCE.BUYER_COVER_CHOICES.map((d) => `<button class="${cfg.coverDays === d ? 'on' : ''}" data-act="buyer-cover" data-arg="${d}">${d} jours</button>`).join('')}</div></div>
    <div class="buyer-opt"><span class="small muted">Garder en caisse</span><div class="tabs sm">${BALANCE.BUYER_RESERVE_CHOICES.map((r) => `<button class="${cfg.reserve === r ? 'on' : ''}" data-act="buyer-reserve" data-arg="${r}">${money0(r)}</button>`).join('')}</div></div>
    ${last ? `<p class="small muted">Jour ${last.day} : ${last.products} produit${last.products > 1 ? 's' : ''} commandé${last.products > 1 ? 's' : ''} pour ${money(last.total)}${last.saved >= 1 ? ` · <span class="pos">${money0(last.saved)} économisés</span>` : ''}${last.skipped ? ` · <span class="warn">${last.skipped} non commandé${last.skipped > 1 ? 's' : ''} (budget)</span>` : ''}</p>` : ''}
    <button class="btn ghost sm block" data-act="buyer-run" ${cfg.enabled ? '' : 'disabled'}>🧑‍💼 Commander maintenant</button>
  </section>`;
}

function cartPanel(state: GameState): string {
  const cart = cartView(state);
  const cap = storageCapacity(state);
  const committed = storageCommitted(state);
  const bySup = new Map<string, typeof cart.lines>();
  for (const l of cart.lines) bySup.set(l.sup.id, [...(bySup.get(l.sup.id) ?? []), l]);
  return `
      <section class="card cart">
        <div class="card-head"><h2>🛒 Panier</h2><span class="row-gap">${cart.lines.length ? `<button class="btn ghost sm" data-act="cart-clear">Vider</button>` : ''}<button class="btn icon m-only-flex" data-act="cart-toggle" aria-label="Fermer le panier">✕</button></span></div>
        <div class="cart-lines">${cart.lines.length ? [...bySup.entries()].map(([sid, lines]) => {
          const s = SUPPLIER_BY_ID[sid];
          const arr = state.day + effectiveDelay(s, state);
          return `<div class="cart-group"><div class="cart-sup">${s.emoji} ${esc(s.name)} <span class="muted small">→ ${dayName(arr)} (jour ${arr})</span></div>
            ${lines.map((l) => `<div class="cart-line">${pastille(l.p, 'sm')}<span class="grow">${esc(l.p.name)} <span class="muted">× ${l.price.qty}</span></span><b>${money(l.price.total)}</b>
              <button class="btn icon xs" data-act="cart-lots" data-arg="${sid}:${l.p.id}:-99" aria-label="Retirer">✕</button></div>`).join('')}</div>`;
        }).join('') : '<p class="muted">Ton panier est vide. Ajoute des lots avec « ＋ » ou utilise le réassort automatique.</p>'}</div>
        <div class="cart-total"><span>Total</span><b class="${cart.overCash ? 'neg' : ''}">${money(cart.total)}</b></div>
        <div class="small muted">Trésorerie après commande : <b class="${cart.overCash ? 'neg' : ''}">${money(state.cash - cart.total)}</b></div>
        <div class="storage">
          <div class="small muted">Place en stock (entrepôt + rayons) : ${num(committed + cart.volume)} / ${num(cap)}</div>
          ${gauge(((committed + cart.volume) / cap) * 100, cart.overCapacity ? 'red' : 'blue')}
        </div>
        ${cart.overCash ? '<div class="banner red small">Trésorerie insuffisante.</div>' : ''}
        ${cart.overCapacity ? '<div class="banner red small">Pas assez de place : agrandis l’entrepôt ou réduis la commande.</div>' : ''}
        <button class="btn primary block" data-act="cart-order" ${!cart.lines.length || cart.overCash || cart.overCapacity ? 'disabled' : ''}>✅ Valider la commande</button>
      </section>
`;
}

function cartBar(state: GameState): string {
  const cart = cartView(state);
  if (!cart.lines.length && !ui.cartOpen) return '';
  return `<button class="m-cartbar ${ui.cartOpen ? 'open' : ''}" data-act="cart-toggle">
    <span>🛒 ${cart.lines.length ? `${cart.lines.length} produit${cart.lines.length > 1 ? 's' : ''}` : 'Panier vide'}</span><b>${money(cart.total)}</b>
    <span>${ui.cartOpen ? 'Fermer ⌄' : 'Voir le panier ⌃'}</span></button>`;
}

/** Met à jour uniquement la ligne du catalogue, le panier et la pastille du menu : la page ne bouge pas. */
function refreshOrderParts(pids: string[]): void {
  const state = store.state;
  for (const pid of pids) {
    const row = document.getElementById(`or-${pid}`);
    if (row) row.outerHTML = catalogRow(state, PRODUCT_BY_ID[pid], ui.supplier);
  }
  const box = document.getElementById('cart-box');
  if (box) box.innerHTML = cartPanel(state);
  const bar = document.getElementById('cartbar-slot');
  if (bar) bar.innerHTML = cartBar(state);
  const navBtn = document.querySelector('.nav-btn[data-arg="orders"]');
  navBtn?.querySelector('.nav-badge')?.remove();
  if (navBtn && state.cart.length) navBtn.insertAdjacentHTML('beforeend', `<span class="nav-badge green">${state.cart.length}</span>`);
  saveGame(state);
}

on('cart-toggle', () => {
  ui.cartOpen = !ui.cartOpen;
  document.getElementById('cart-dock')?.classList.toggle('open', ui.cartOpen);
  document.querySelector('.cart-scrim')?.remove();
  if (ui.cartOpen) document.getElementById('cart-dock')?.insertAdjacentHTML('afterend', '<div class="cart-scrim" data-act="cart-toggle"></div>');
  document.body.classList.toggle('sheet-open', ui.cartOpen);
  const bar = document.getElementById('cartbar-slot');
  if (bar) bar.innerHTML = cartBar(store.state);
});
on('order-sort', (k) => {
  const n = nextSort(ui.orderSort, ui.orderDir, k);
  ui.orderSort = n.key; ui.orderDir = k === 'default' ? 1 : n.dir;
  store.commit();
});
on('supplier', (id) => { ui.supplier = id; ui.orderCat = 'all'; store.commit(); applySearch('orders'); });
on('order-cat', (c) => {
  // Choisir une catégorie efface la recherche en cours.
  ui.orderCat = c;
  ui.search.orders = '';
  store.commit();
});
on('cart-lots', (arg) => {
  const [sid, pid, d] = arg.split(':');
  if (!isSellable(PRODUCT_BY_ID[pid], store.state)) return;
  setCartLots(store.state, sid, pid, cartLots(store.state, sid, pid) + Number(d));
  refreshOrderParts([pid]);
});
on('quick-buy', (kind) => {
  const list = kind === 'rupture' ? ruptureProducts(store.state) : lowStockProducts(store.state);
  const r = addUrgentToCart(store.state, list);
  toast(r.added
    ? `⚡ ${plural(r.added, 'produit ajouté', 'produits ajoutés')} au panier${r.skipped ? ` (${r.skipped} manquent de budget ou de place)` : ''}. Vérifie puis valide.`
    : 'Rien n’a pu être ajouté : trésorerie ou place insuffisante.', r.added ? 'success' : 'error');
  if (r.added) { ui.cartOpen = true; document.body.classList.add('sheet-open'); }
  store.commit();
});
on('buyer-toggle', () => { const c = buyerSettings(store.state); c.enabled = !c.enabled; sfx.click(); store.commit(); });
on('buyer-cover', (d) => { buyerSettings(store.state).coverDays = Number(d); store.commit(); });
on('buyer-reserve', (r) => { buyerSettings(store.state).reserve = Number(r); store.commit(); });
on('buyer-run', () => {
  const r = runBuyer(store.state);
  if (!r) return;
  toast(r.products
    ? `🧑‍💼 ${plural(r.products, 'produit commandé', 'produits commandés')} pour ${money(r.total)}${r.saved >= 1 ? ` · ${money0(r.saved)} économisés` : ''}.`
    : 'Rien à commander pour l’instant : le stock et les livraisons couvrent les prochains jours.', r.products ? 'success' : 'info');
  if (r.products) sfx.success();
  store.commit();
});
on('cart-clear', () => {
  const pids = store.state.cart.map((c) => c.productId);
  store.state.cart = [];
  refreshOrderParts(pids);
});
on('auto-reorder', (scope) => {
  const before = new Set(store.state.cart.map((c) => c.productId));
  const sup = SUPPLIER_BY_ID[ui.supplier];
  const n = autoReorder(store.state, scope as 'essentials' | 'all', ui.supplier);
  toast(n ? `🔁 ${plural(n, 'produit ajouté', 'produits ajoutés')} au panier chez ${esc(sup.name)}. Vérifie puis valide.`
    : `Rien à recommander chez ${esc(sup.name)} : le stock couvre déjà les prochains jours, les produits sont déjà dans le panier, ou la trésorerie est trop juste.`, n ? 'success' : 'info');
  refreshOrderParts(store.state.cart.map((c) => c.productId).filter((id) => !before.has(id)));
});
on('cart-order', () => {
  const total = cartView(store.state).total;
  const err = placeOrders(store.state);
  if (err) return toast(err, 'error');
  ui.cartOpen = false;
  document.body.classList.remove('sheet-open');
  sfx.success();
  toast(`✅ Commande validée (${money(total)}).`, 'success');
  store.commit();
});
