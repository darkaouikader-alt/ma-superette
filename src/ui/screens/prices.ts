// Écran 3 : prix (tableau triable et filtrable).
import { CATEGORIES, CATEGORY_BY_ID } from '../../data/categories';
import { PRODUCT_BY_ID } from '../../data/products';
import type { GameState, Product } from '../../state/types';
import { store } from '../../state/store';
import { activeCampaigns, activePromos, markupPct, priceVerdict, promoPct, salePrice, roundPrice, setPrice, suggestedPrice, VERDICT_LABEL, type Verdict } from '../../systems/economy';
import { eventModifiers, marketPrice } from '../../systems/events';
import { sellableProducts } from '../../systems/progression';
import { avgOf, totalQty } from '../../systems/stock';
import { on, onChange } from '../actions';
import { productBadges } from '../alerts';
import { sparkline } from '../chart';
import { badge, esc, money, num1, pastille, type Tone } from '../dom';
import { saveGame } from '../../state/save';
import { toast } from '../toast';
import { ui } from '../uiState';
import { renderPromos } from './promotions';

const VERDICT_TONE: Record<Verdict, Tone> = { cheap: 'green', fair: 'blue', high: 'orange', abuse: 'red' };
const refCost = (p: Product, state: GameState) => Math.round(p.cost * eventModifiers(state).supplierCost * 100) / 100;

function priceRow(state: GameState, p: Product): string {
  const price = state.prices[p.id];
  const promo = promoPct(state, p.id);
  const cost = refCost(p, state);
  const market = marketPrice(p, state);
  const margin = price - cost;
  const verdict = priceVerdict(price, market);
  const pct = markupPct(price, cost);
  return `<tr id="pr-${p.id}">
    <td><div class="prod-cell">${pastille(p)}<div><b>${esc(p.name)}</b><div class="badges">${productBadges(state, p)}</div></div></div></td>
    <td class="num" data-label="Achat">${money(cost)}</td>
    <td class="num" data-label="Marché">${money(market)}${market < p.market ? ' <span class="down" title="Promo concurrente">▼</span>' : ''}</td>
    <td class="num m-wide" data-label="Prix de vente"><div class="price-edit">
      <button class="btn icon" data-act="price-step" data-arg="${p.id}:-0.05" aria-label="Baisser">−</button>
      <input type="text" inputmode="decimal" value="${price.toFixed(2).replace('.', ',')}" data-change="price" data-arg="${p.id}" aria-label="Prix de vente de ${esc(p.name)}" />
      <button class="btn icon" data-act="price-step" data-arg="${p.id}:0.05" aria-label="Augmenter">＋</button>
    </div>${promo ? `<div class="small promo-note">📣 Promo −${promo} % : ${money(salePrice(state, p))}</div>` : ''}</td>
    <td class="num" data-label="Marge"><b class="${margin > 0 ? 'pos' : 'neg'}">${money(margin)}</b><div class="small ${margin > 0 ? 'pos' : 'neg'}">${pct >= 0 ? '+' : ''}${num1(pct)} %</div></td>
    <td data-label="Indicateur">${badge(VERDICT_LABEL[verdict], VERDICT_TONE[verdict])}</td>
    <td data-label="Ventes 7 j">${sparkline(state.salesHistory[p.id] ?? [])}</td>
    <td class="m-end"><button class="btn ghost sm" data-act="price-suggest" data-arg="${p.id}" title="Prix conseillé : ${money(suggestedPrice(p, state))}">Conseillé</button></td>
  </tr>`;
}

function filtered(state: GameState): Product[] {
  const f = ui.price;
  let list = sellableProducts(state);
  if (f.cat !== 'all') list = list.filter((p) => p.cat === f.cat);
  if (f.essential) list = list.filter((p) => p.essential);
  if (f.rupture) list = list.filter((p) => totalQty(state, p.id) === 0);
  const key: Record<string, (p: Product) => number | string> = {
    name: (p) => p.name,
    cat: (p) => CATEGORIES.findIndex((c) => c.id === p.cat) * 1000 + p.level,
    cost: (p) => p.cost,
    market: (p) => p.market,
    price: (p) => state.prices[p.id],
    margin: (p) => markupPct(state.prices[p.id], p.cost),
    verdict: (p) => state.prices[p.id] / marketPrice(p, state),
    sales: (p) => avgOf(state.salesHistory[p.id], 7) ?? -1,
  };
  const k = key[f.sort] ?? key.cat;
  return list.slice().sort((a, b) => {
    const x = k(a), y = k(b);
    return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * f.dir;
  });
}

export function renderPrices(state: GameState): string {
  const f = ui.price;
  const cats = CATEGORIES.filter((c) => sellableProducts(state).some((p) => p.cat === c.id));
  const th = (key: string, label: string, cls = '') => `<th class="sortable ${cls} ${f.sort === key ? 'sorted' : ''}" data-act="price-sort" data-arg="${key}">${label}${f.sort === key ? (f.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const nPromos = activePromos(state).length + activeCampaigns(state).length;
  const head = `
  <div class="screen-head">
    <div><h1>🏷️ Prix et promotions</h1><p class="muted">${ui.priceTab === 'prices'
      ? 'Le <b>prix du marché</b> est la référence des clients. Plus cher : moins de ventes (surtout sur le confort). Trop cher sur les essentiels : la réputation chute.'
      : 'Lance des promotions et des campagnes pour attirer plus de clients dans ton magasin.'}</p></div>
    <div class="tabs">
      <button class="${ui.priceTab === 'prices' ? 'on' : ''}" data-act="price-tab" data-arg="prices">🏷️ Prix</button>
      <button class="${ui.priceTab === 'promos' ? 'on' : ''}" data-act="price-tab" data-arg="promos">📣 Promotions${nPromos ? ` <span class="nav-badge green inline">${nPromos}</span>` : ''}</button>
    </div>
  </div>`;
  if (ui.priceTab === 'promos') return head + renderPromos(state);
  const list = filtered(state);
  return `${head}
  <section class="card toolbar">
    <div class="chips">
      <button class="chip ${f.cat === 'all' ? 'on' : ''}" data-act="price-cat" data-arg="all">Tout</button>
      ${cats.map((c) => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-act="price-cat" data-arg="${c.id}">${c.emoji} ${c.name}</button>`).join('')}
    </div>
    <div class="chips">
      <button class="chip ${f.essential ? 'on' : ''}" data-act="price-toggle" data-arg="essential">⭐ Essentiels</button>
      <button class="chip ${f.rupture ? 'on' : ''}" data-act="price-toggle" data-arg="rupture">🚫 En rupture</button>
      <span class="spacer"></span>
      <label class="bulk">Appliquer
        <input type="number" step="1" value="${f.bulkPct}" data-change="bulk-pct" aria-label="Pourcentage" /> %
        à <select data-change="bulk-cat" aria-label="Catégorie">
          <option value="all" ${f.bulkCat === 'all' ? 'selected' : ''}>tous les produits</option>
          ${cats.map((c) => `<option value="${c.id}" ${f.bulkCat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <button class="btn primary sm" data-act="bulk-apply">Appliquer</button>
      </label>
      <select class="m-only" data-change="price-sort-select" aria-label="Trier par">
        ${[['cat', 'Catégorie'], ['name', 'Nom'], ['margin', 'Marge'], ['verdict', 'Prix vs marché'], ['sales', 'Ventes']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>Trier : ${l}</option>`).join('')}
      </select>
      <button class="btn ghost sm" data-act="bulk-suggest" title="Remet les produits affichés au prix conseillé">↺ Prix conseillés</button>
    </div>
  </section>
  <section class="card table-card">
    <table class="table prices mcards">
      <thead><tr>${th('name', 'Produit')}${th('cost', 'Achat', 'num')}${th('market', 'Marché', 'num')}${th('price', 'Prix de vente', 'num')}${th('margin', 'Marge', 'num')}${th('verdict', 'Indicateur')}${th('sales', 'Ventes 7 j')}<th></th></tr></thead>
      <tbody>${list.map((p) => priceRow(state, p)).join('') || '<tr><td colspan="8" class="muted center">Aucun produit ne correspond aux filtres.</td></tr>'}</tbody>
    </table>
  </section>`;
}

/** Met à jour une seule ligne (évite de perdre le focus pendant la saisie). */
function refreshRow(pid: string): void {
  const row = document.getElementById(`pr-${pid}`);
  if (row) row.outerHTML = priceRow(store.state, PRODUCT_BY_ID[pid]);
  saveGame(store.state);
}

onChange('price', (pid, el) => {
  const v = parseFloat((el as HTMLInputElement).value.replace(',', '.').replace(/[^\d.]/g, ''));
  if (Number.isFinite(v) && v > 0) setPrice(store.state, pid, v);
  refreshRow(pid);
});
on('price-step', (arg) => {
  const [pid, d] = arg.split(':');
  setPrice(store.state, pid, Math.round((store.state.prices[pid] + Number(d)) * 20) / 20);
  refreshRow(pid);
});
on('price-suggest', (pid) => {
  setPrice(store.state, pid, suggestedPrice(PRODUCT_BY_ID[pid], store.state));
  refreshRow(pid);
});
on('price-tab', (t) => { ui.priceTab = t as typeof ui.priceTab; ui.entering = true; store.commit(); });
on('price-sort', (key) => {
  if (ui.price.sort === key) ui.price.dir *= -1;
  else { ui.price.sort = key; ui.price.dir = 1; }
  store.commit();
});
on('price-cat', (cat) => { ui.price.cat = cat; store.commit(); });
on('price-toggle', (k) => {
  if (k === 'essential') ui.price.essential = !ui.price.essential;
  else ui.price.rupture = !ui.price.rupture;
  store.commit();
});
onChange('price-sort-select', (_a, el) => { ui.price.sort = (el as HTMLSelectElement).value; ui.price.dir = ui.price.sort === 'sales' || ui.price.sort === 'margin' ? -1 : 1; store.commit(); });
onChange('bulk-pct', (_a, el) => { ui.price.bulkPct = Number((el as HTMLInputElement).value) || 0; });
onChange('bulk-cat', (_a, el) => { ui.price.bulkCat = (el as HTMLSelectElement).value; });
on('bulk-apply', () => {
  const { bulkCat, bulkPct } = ui.price;
  const list = sellableProducts(store.state).filter((p) => bulkCat === 'all' || p.cat === bulkCat);
  for (const p of list) setPrice(store.state, p.id, roundPrice(store.state.prices[p.id] * (1 + bulkPct / 100)));
  const name = bulkCat === 'all' ? 'tous les produits' : CATEGORY_BY_ID[bulkCat as keyof typeof CATEGORY_BY_ID].name;
  toast(`🏷️ ${bulkPct >= 0 ? '+' : ''}${bulkPct} % appliqué à ${name} (${list.length} produits).`, 'success');
  store.commit();
});
on('bulk-suggest', () => {
  const list = filtered(store.state);
  for (const p of list) setPrice(store.state, p.id, suggestedPrice(p, store.state));
  toast(`↺ Prix conseillés appliqués à ${list.length} produits.`, 'success');
  store.commit();
});
