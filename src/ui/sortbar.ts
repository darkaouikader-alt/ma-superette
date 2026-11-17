// Barre « Trier par » : boutons visibles sur ordinateur et téléphone.
// 1er clic sur un critère : du plus petit au plus grand (▲) ; nouveau clic : l'inverse (▼).
import { esc } from './dom';

export function sortBar(act: string, options: Record<string, string>, current: string, dir: number): string {
  return `<div class="sort-bar" role="group" aria-label="Trier">
    <span class="small muted">Trier par</span>
    ${Object.entries(options).map(([k, label]) => {
      const on = k === current;
      return `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-arg="${k}" aria-pressed="${on}" title="${on ? 'Inverser l’ordre' : `Trier par ${esc(label.toLowerCase())}`}">${esc(label)}${on ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button>`;
    }).join('')}
  </div>`;
}

/** Nouveau critère : ordre croissant ; même critère : ordre inversé. */
export function nextSort(current: string, dir: number, clicked: string): { key: string; dir: number } {
  return clicked === current ? { key: current, dir: -dir } : { key: clicked, dir: 1 };
}

/** Compare deux valeurs ; les valeurs « infinies » (sans date, sans ventes…) restent en fin de liste. */
export function compareValues(x: number | string, y: number | string, dir: number): number {
  if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'fr') * dir;
  const fx = Number.isFinite(x), fy = Number.isFinite(y);
  if (!fx || !fy) return fx === fy ? 0 : fx ? -1 : 1;
  return (x - y) * dir;
}
