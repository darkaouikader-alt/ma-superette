// Petits utilitaires d'affichage partagés par tous les écrans.
import { CATEGORY_BY_ID } from '../data/categories';
import type { Product } from '../state/types';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export const money = (v: number) => `${nf2.format(v)} €`;
export const money0 = (v: number) => `${nf0.format(Math.round(v))} €`;
export const num = (v: number) => nf0.format(v);
export const num1 = (v: number) => nf1.format(v);
export const signed = (v: number, fmt: (n: number) => string = num1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

export function pastille(p: Product, size: 'sm' | 'md' | 'lg' = 'md'): string {
  return `<span class="pastille ${size}" style="--h:${CATEGORY_BY_ID[p.cat].hue}" title="${esc(p.name)}">${p.emoji}</span>`;
}

export function catPastille(emoji: string, hue: number, size: 'sm' | 'md' | 'lg' = 'md'): string {
  return `<span class="pastille ${size}" style="--h:${hue}">${emoji}</span>`;
}

export type Tone = 'green' | 'red' | 'orange' | 'blue' | 'grey' | 'purple';
export const badge = (text: string, tone: Tone = 'grey') => `<span class="badge ${tone}">${text}</span>`;

export function gauge(pct: number, tone: Tone | '' = '', extra = ''): string {
  const p = Math.max(0, Math.min(100, pct));
  const t = tone || (p <= 15 ? 'red' : p <= 40 ? 'orange' : 'green');
  return `<div class="gauge ${t}" ${extra}><i style="width:${p}%"></i></div>`;
}

/** Badge « ✨ Nouveau » des produits récemment débloqués. */
export const newBadge = (title: string) => `<span class="badge new" title="${esc(title)}">✨ Nouveau</span>`;

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n > 1 ? many : one}`;
