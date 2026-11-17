// Écran 5 : stock / entrepôt.
import { PRODUCT_BY_ID } from '../../data/products';
import type { GameState, Product } from '../../state/types';
import { store } from '../../state/store';
import { daysOfStock, shelfQty, stockValue, totalQty, warehouseCapacity, warehouseQty, warehouseUsed } from '../../systems/stock';
import { inTransit } from '../../systems/suppliers';
import { on, onChange } from '../actions';
import { productBadges, trackedProducts } from '../alerts';
import { badge, esc, gauge, money, num, num1, pastille } from '../dom';
import { ui } from '../uiState';
import { searchAttrs, searchBox } from '../search';

function expiryCell(state: GameState, p: Product): string {
  const batches = (state.stock[p.id] ?? []).filter((b) => b.exp !== null);
  if (!p.shelfLife) return '<span class="muted small">Non périssable</span>';
  if (!batches.length) return '<span class="muted small">—</span>';
  return batches.slice(0, 3).map((b) => {
    const d = b.exp! - state.day;
    return badge(`${b.qty} · ${d <= 0 ? 'ce soir' : d === 1 ? 'demain' : `${d + 1} j`}`, d <= 0 ? 'red' : d === 1 ? 'orange' : 'grey');
  }).join(' ');
}

export function renderStock(state: GameState): string {
  const used = warehouseUsed(state);
  const cap = warehouseCapacity(state);
  const prods = trackedProducts(state);
  // Tri sur toutes les colonnes, dans les deux sens (▲ du plus petit au plus grand, ▼ l'inverse).
  const firstExpiry = (p: Product) => Math.min(...(state.stock[p.id] ?? []).map((b) => b.exp ?? Infinity), Infinity);
  const sorters: Record<string, (p: Product) => number | string> = {
    name: (p) => p.name,
    shelf: (p) => shelfQty(state, p.id),
    warehouse: (p) => warehouseQty(state, p.id),
    transit: (p) => inTransit(state, p.id),
    days: (p) => (totalQty(state, p.id) === 0 ? 0 : daysOfStock(state, p)),
    expiry: (p) => firstExpiry(p),
    value: (p) => stockValue(state.stock[p.id]),
  };
  const key = sorters[ui.stockSort] ? ui.stockSort : 'days';
  /** Compare deux valeurs dans le sens choisi ; « non périssable » / « sans ventes » (∞) restent toujours en fin de liste. */
  const compare = (x: number | string, y: number | string): number => {
    if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'fr') * ui.stockDir;
    const fx = Number.isFinite(x), fy = Number.isFinite(y);
    if (!fx || !fy) return fx === fy ? 0 : fx ? -1 : 1;
    return (x - y) * ui.stockDir;
  };
  const list = prods.slice().sort((a, b) => compare(sorters[key](a), sorters[key](b)) || a.name.localeCompare(b.name, 'fr'));
  const value = prods.reduce((s, p) => s + stockValue(state.stock[p.id]), 0);
  const recent = state.history.slice(-7);
  const losses = new Map<string, { qty: number; value: number }>();
  for (const h of recent) for (const e of h.expired) {
    const l = losses.get(e.productId) ?? { qty: 0, value: 0 };
    l.qty += e.qty; l.value += e.value;
    losses.set(e.productId, l);
  }
  const lossTotal = [...losses.values()].reduce((s, l) => s + l.value, 0);
  const arrow = (k: string) => (key === k ? (ui.stockDir > 0 ? ' ▲' : ' ▼') : '');
  const th = (k: string, label: string, cls = '') => `<th class="sortable ${cls} ${key === k ? 'sorted' : ''}" data-act="stock-sort" data-arg="${k}" aria-sort="${key === k ? (ui.stockDir > 0 ? 'ascending' : 'descending') : 'none'}" title="Trier par ${label.toLowerCase()}">${label}${arrow(k)}</th>`;
  const LABELS: Record<string, string> = { name: 'Produit', shelf: 'Rayon', warehouse: 'Entrepôt', transit: 'En route', days: 'Couverture', expiry: 'Péremption', value: 'Valeur' };

  return `
  <div class="screen-head">
    <div><h1>📦 Stock et entrepôt</h1><p class="muted">Inventaire complet, dates de péremption et pertes. L’estimation « stock pour X jours » se base sur tes ventes récentes.</p></div>
  </div>
  <section class="card stat-strip">
    <div><span class="kpi-label">Entrepôt</span><b class="${used > cap ? 'neg' : ''}">${num(used)} / ${num(cap)}</b>${gauge((used / cap) * 100, used > cap * 0.9 ? 'red' : 'blue')}</div>
    <div><span class="kpi-label">Valeur du stock</span><b>${money(value)}</b></div>
    <div><span class="kpi-label">Références suivies</span><b>${prods.length}</b></div>
    <div><span class="kpi-label">Pertes (7 derniers jours)</span><b class="${lossTotal > 0 ? 'neg' : 'pos'}">${money(lossTotal)}</b></div>
  </section>
  <div class="orders-grid">
    <section class="card table-card">
      <div class="pad-x">${searchBox('stock', 'Rechercher un produit dans le stock…')}
        <div class="m-sort m-only-flex-row">
          <select data-change="stock-sort-select" aria-label="Trier par">${Object.entries(LABELS).map(([k, l]) => `<option value="${k}" ${key === k ? 'selected' : ''}>Trier : ${l}</option>`).join('')}</select>
          <button class="btn ghost sm" data-act="stock-sort-dir" aria-label="Inverser l’ordre">${ui.stockDir > 0 ? '▲ Croissant' : '▼ Décroissant'}</button>
        </div></div>
      <table class="table mcards">
        <thead><tr>${th('name', 'Produit')}${th('shelf', 'Rayon', 'num')}${th('warehouse', 'Entrepôt', 'num')}${th('transit', 'En route', 'num')}${th('days', 'Couverture', 'num')}${th('expiry', 'Péremption')}${th('value', 'Valeur', 'num')}</tr></thead>
        <tbody>${list.map((p) => {
          const days = daysOfStock(state, p);
          const total = totalQty(state, p.id);
          return `<tr ${searchAttrs('stock', p)}>
            <td><div class="prod-cell">${pastille(p)}<div><b>${esc(p.name)}</b><div class="badges">${productBadges(state, p)}</div></div></div></td>
            <td class="num" data-label="Rayon">${num(shelfQty(state, p.id))}</td>
            <td class="num" data-label="Entrepôt">${num(warehouseQty(state, p.id))}</td>
            <td class="num" data-label="En route">${inTransit(state, p.id) ? `<span class="pos">+${num(inTransit(state, p.id))}</span>` : '<span class="muted">—</span>'}</td>
            <td class="num" data-label="Couverture"><b class="${total === 0 ? 'neg' : days < 1.2 ? 'warn' : ''}">${total === 0 ? '0 j' : Number.isFinite(days) ? `${num1(Math.min(99, days))} j` : '—'}</b></td>
            <td class="m-wide" data-label="Péremption">${expiryCell(state, p)}</td>
            <td class="num" data-label="Valeur">${money(stockValue(state.stock[p.id]))}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="muted center">Aucun stock.</td></tr>'}<tr data-search-empty hidden><td colspan="7" class="muted center"></td></tr></tbody>
      </table>
    </section>
    <div class="col side">
      <section class="card">
        <div class="card-head"><h2>🗑️ Pertes récentes</h2></div>
        ${losses.size ? `<ul class="alerts">${[...losses.entries()].sort((a, b) => b[1].value - a[1].value).map(([pid, l]) => {
          const p = PRODUCT_BY_ID[pid];
          return p ? `<li>${pastille(p, 'sm')}<span>${esc(p.name)} <span class="muted">× ${l.qty}</span></span><b class="neg">−${money(l.value)}</b></li>` : '';
        }).join('')}</ul><p class="muted small">Astuce : commande les produits frais en plus petites quantités, plus souvent.</p>`
          : '<p class="muted">♻️ Aucun produit jeté cette semaine. Bravo !</p>'}
      </section>
    </div>
  </div>`;
}

on('stock-sort', (k) => {
  // 1er clic : du plus petit au plus grand ; nouveau clic sur la même colonne : ordre inverse.
  if (ui.stockSort === k) ui.stockDir = -ui.stockDir;
  else { ui.stockSort = k; ui.stockDir = 1; }
  store.commit();
});
on('stock-sort-dir', () => { ui.stockDir = -ui.stockDir; store.commit(); });
onChange('stock-sort-select', (_a, el) => { ui.stockSort = (el as HTMLSelectElement).value; ui.stockDir = 1; store.commit(); });
