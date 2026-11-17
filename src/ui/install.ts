// Installation en application (PWA) : bouton « Installer » quand le navigateur le permet,
// instructions manuelles sur iPhone / iPad.
let deferred: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let listeners: (() => void)[] = [];

export function initInstall(onChange: () => void): void {
  listeners.push(onChange);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as typeof deferred;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((fn) => fn()); });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => !!deferred;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}

/** Enregistre le service worker (mode hors ligne). Silencieux si le contexte l'interdit. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* contexte sans service worker */ });
  });
}
