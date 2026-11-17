// Barres de recherche (Commandes, Stock, Prix, Promotions, choix d'un produit en rayon).
// On ne redessine pas l'écran pendant la saisie (sur iPhone, cela fermerait le clavier) :
// les lignes qui ne correspondent pas sont simplement masquées.
import { CATEGORY_BY_ID } from '../data/categories';
import type { Product } from '../state/types';
import { on, onInput } from './actions';
import { esc } from './dom';
import { ui } from './uiState';

export type SearchScope = 'orders' | 'stock' | 'prices' | 'promos' | 'picker';

/** Minuscules, sans accents : « œufs » et « oeufs », « épicerie » et « epicerie » se valent. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase().trim();

/** Texte dans lequel on cherche : nom du produit + catégorie. */
export const searchKey = (p: Product) => norm(`${p.name} ${CATEGORY_BY_ID[p.cat].name}`);

export const currentSearch = (scope: SearchScope) => ui.search[scope] ?? '';

/** Le produit correspond-il à la recherche ? (tous les mots doivent apparaître) */
export function matchesSearch(key: string, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return words.every((w) => key.includes(w));
}

/**
 * Visibilité d'une ligne : avec une recherche, toutes les lignes qui correspondent (même hors
 * de la catégorie choisie) ; sans recherche, le filtre habituel (`catOk`).
 */
export function rowVisible(key: string, catOk: boolean, query: string): boolean {
  return query.trim() ? matchesSearch(key, query) : catOk;
}

/** Attributs d'une ligne recherchable. */
export function searchAttrs(scope: SearchScope, p: Product, catOk = true): string {
  const key = searchKey(p);
  return `data-search="${esc(key)}" data-search-scope="${scope}" data-cat-ok="${catOk ? 1 : 0}" ${rowVisible(key, catOk, currentSearch(scope)) ? '' : 'hidden'}`;
}

export function searchBox(scope: SearchScope, placeholder: string): string {
  const v = currentSearch(scope);
  return `<div class="search-box" data-search-root="${scope}">
    <span class="search-icon" aria-hidden="true">🔍</span>
    <input type="search" id="search-${scope}" data-input="search" data-arg="${scope}" value="${esc(v)}" placeholder="${esc(placeholder)}"
      autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="${esc(placeholder)}" />
    <button class="search-clear" type="button" data-act="search-clear" data-arg="${scope}" ${v ? '' : 'hidden'} aria-label="Effacer la recherche">✕</button>
  </div>`;
}

/** Actions supplémentaires après filtrage (ex. « aussi chez d'autres fournisseurs »). */
const afterFilter: Partial<Record<SearchScope, () => void>> = {};
export const onSearchApplied = (scope: SearchScope, fn: () => void) => { afterFilter[scope] = fn; };

/** Applique la recherche aux lignes affichées de l'écran (ou de la fenêtre). */
export function applySearch(scope: SearchScope): void {
  const q = currentSearch(scope);
  const root = scope === 'picker' ? document.querySelector('.modal') : document.getElementById('screen');
  if (!root) return;
  let shown = 0;
  // Seulement les lignes de cette recherche (un écran peut en avoir plusieurs, ex. Prix / Promotions).
  root.querySelectorAll<HTMLElement>(`[data-search][data-search-scope="${scope}"]`).forEach((el) => {
    const visible = rowVisible(el.dataset.search ?? '', el.dataset.catOk !== '0', q);
    el.hidden = !visible;
    if (visible) shown++;
  });
  // Groupes (titres de catégorie) sans aucune ligne visible : masqués aussi.
  root.querySelectorAll<HTMLElement>('[data-search-group]').forEach((g) => {
    g.hidden = !g.querySelector('[data-search]:not([hidden])');
  });
  root.querySelectorAll<HTMLElement>('[data-search-empty]').forEach((el) => {
    el.hidden = shown > 0;
    // Dans un tableau, le texte va dans la cellule (sinon la ligne perdrait sa mise en forme).
    (el.querySelector('td') ?? el).textContent = q.trim() ? `Aucun produit ne correspond à « ${q.trim()} ».` : 'Aucun produit.';
  });
  const clear = root.querySelector<HTMLElement>(`[data-act="search-clear"][data-arg="${scope}"]`);
  if (clear) clear.hidden = !q;
  afterFilter[scope]?.();
}

onInput('search', (scope, el) => {
  ui.search[scope as SearchScope] = (el as HTMLInputElement).value;
  applySearch(scope as SearchScope);
});

on('search-clear', (scope) => {
  ui.search[scope as SearchScope] = '';
  const input = document.getElementById(`search-${scope}`) as HTMLInputElement | null;
  if (input) { input.value = ''; input.focus(); }
  applySearch(scope as SearchScope);
});
