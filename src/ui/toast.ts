import { sfx } from './audio';

export function toast(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = message;
  root.appendChild(el);
  if (tone === 'error') sfx.error();
  else if (tone === 'success') sfx.notify();
  while (root.children.length > 4) root.firstElementChild?.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}
