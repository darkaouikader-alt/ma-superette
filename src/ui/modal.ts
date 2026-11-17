// Fenêtres modales (une pile simple : la dernière ouverte est au-dessus).
import { on } from './actions';

interface ModalOptions { title?: string; body: string; wide?: boolean; dismissable?: boolean; onClose?: () => void; className?: string }
const stack: { el: HTMLElement; opts: ModalOptions }[] = [];

export function openModal(opts: ModalOptions): void {
  const root = document.getElementById('modal-root')!;
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal ${opts.wide ? 'wide' : ''} ${opts.className ?? ''}" role="dialog" aria-modal="true">
      ${opts.dismissable === false ? '' : '<button class="modal-close" data-act="modal-close" aria-label="Fermer">✕</button>'}
      ${opts.title ? `<h2 class="modal-title">${opts.title}</h2>` : ''}
      <div class="modal-body">${opts.body}</div>
    </div>`;
  if (opts.dismissable !== false) {
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeModal(); });
  }
  root.appendChild(el);
  stack.push({ el, opts });
}

export function closeModal(): void {
  const top = stack.pop();
  if (!top) return;
  top.el.remove();
  top.opts.onClose?.();
}

export const modalOpen = () => stack.length > 0;

/** Met à jour le contenu de la modale du dessus (sans la refermer). */
export function updateModalBody(html: string): void {
  const top = stack[stack.length - 1];
  const body = top?.el.querySelector('.modal-body');
  if (body) body.innerHTML = html;
}

let pendingConfirm: (() => void) | null = null;

export function confirmDialog(title: string, text: string, confirmLabel: string, onConfirm: () => void, danger = false): void {
  pendingConfirm = onConfirm;
  openModal({
    title,
    body: `<p class="muted">${text}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-act="modal-close">Annuler</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="modal-confirm">${confirmLabel}</button>
      </div>`,
    onClose: () => { pendingConfirm = null; },
  });
}

on('modal-close', () => closeModal());
on('modal-confirm', () => {
  const fn = pendingConfirm;
  closeModal();
  fn?.();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length && stack[stack.length - 1].opts.dismissable !== false) closeModal();
});
