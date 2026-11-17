// Interface du compte joueur : carte « Compte » des Réglages, indicateur d'état, conflits.
import { WEEKDAYS } from '../data/constants';
import { levelDef } from '../data/levels';
import {
  cloudError, cloudStatus, cloudUser, flush, initCloud, lastSyncTime, logOut, reconcile, resetPassword, resolveConflict,
  signIn, signUp, type CloudStatus, type Conflict, type SaveSummary,
} from '../cloud/sync';
import { store } from '../state/store';
import { on } from './actions';
import { sfx } from './audio';
import { $, esc, money } from './dom';
import { closeModal, openModal } from './modal';
import { toast } from './toast';
import { ui } from './uiState';

const LABEL: Record<CloudStatus, [string, string]> = {
  off: ['💾', 'Sauvegarde sur cet appareil'],
  unavailable: ['💾', 'Sauvegarde sur cet appareil'],
  signedOut: ['💾', 'Sauvegarde sur cet appareil'],
  syncing: ['🔄', 'Synchronisation…'],
  synced: ['☁️', 'Partie en ligne à jour'],
  pending: ['☁️', 'Envoi dans quelques secondes…'],
  offline: ['📴', 'Hors ligne : envoi plus tard'],
  error: ['⚠️', 'Erreur de synchronisation'],
  conflict: ['⚠️', 'Choix de partie en attente'],
};

export function cloudPill(): string {
  const [icon, text] = LABEL[cloudStatus()];
  return `<span class="cloud-pill ${cloudStatus()}" data-cloud-pill title="${esc(text)}">${icon} <span>${esc(text)}</span></span>`;
}

const fmtTime = (t: number | null) => (t ? new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais');

export function cloudCard(): string {
  const s = cloudStatus();
  const u = cloudUser();
  let body = '';
  if (s === 'off') {
    body = '<p class="muted">La synchronisation en ligne n’est pas encore configurée pour ce jeu. Ta partie est sauvegardée sur cet appareil.</p>';
  } else if (s === 'unavailable') {
    body = `<p class="muted">Le compte en ligne fonctionne sur la version installable du jeu :</p>
      <p><b>https://darkaouikader-alt.github.io/ma-superette/</b></p>
      <p class="muted small">Ici, ta partie est sauvegardée seulement sur cet appareil.</p>`;
  } else if (!u) {
    body = `<p class="muted">Connecte-toi pour retrouver la même partie sur ton téléphone, ta tablette et ton ordinateur.</p>
      <form class="cloud-form" data-cloud-form>
        <label>Adresse e-mail<input id="cloud-email" type="email" autocomplete="username" inputmode="email" placeholder="toi@exemple.fr" /></label>
        <label>Mot de passe<input id="cloud-pass" type="password" autocomplete="current-password" placeholder="6 caractères minimum" /></label>
        <div class="row-gap">
          <button class="btn primary" type="submit" data-act="cloud-signin">Se connecter</button>
          <button class="btn ghost" type="button" data-act="cloud-signup">Créer un compte</button>
        </div>
        <button class="link small" type="button" data-act="cloud-reset">Mot de passe oublié ?</button>
        <p class="small neg" id="cloud-msg" role="alert"></p>
      </form>
      <p class="muted small">À la première connexion, la partie de cet appareil est envoyée en ligne. Sur un autre appareil, connecte-toi avec le même compte pour la retrouver.</p>`;
  } else {
    body = `<div class="setting"><div><b>Connecté</b><p class="muted small">${esc(u.email ?? '')}</p></div>${cloudPill()}</div>
      <div class="setting"><div><b>Dernière synchronisation</b><p class="muted small">${esc(fmtTime(lastSyncTime()))}</p></div>
        <button class="btn ghost sm" data-act="cloud-sync">🔄 Synchroniser</button></div>
      ${s === 'error' || s === 'offline' ? `<p class="small ${s === 'error' ? 'neg' : 'muted'}">${esc(cloudError())}</p>` : ''}
      <p class="muted small">La partie est envoyée automatiquement après chaque journée et chaque achat. Les autres appareils la récupèrent à l’ouverture du jeu.</p>
      <button class="btn ghost sm" data-act="cloud-logout">Se déconnecter</button>`;
  }
  return `<section class="card" id="cloud-card"><div class="card-head"><h2>☁️ Compte et synchronisation</h2></div>${body}</section>`;
}

/** Met à jour l'indicateur et la carte sans redessiner tout l'écran (le formulaire garde sa saisie). */
function refreshCloudUi(): void {
  document.querySelectorAll('[data-cloud-pill]').forEach((el) => { el.outerHTML = cloudPill(); });
  // On ne redessine pas le formulaire de connexion tant qu'on n'est pas connecté (la saisie est conservée).
  const card = document.getElementById('cloud-card');
  const formShown = !!document.querySelector('[data-cloud-form]');
  if (card && !(formShown && !cloudUser())) card.outerHTML = cloudCard();
}

const describe = (s: SaveSummary) => `Jour ${s.day} (${WEEKDAYS[(s.day - 1) % 7].toLowerCase()}) · niveau ${s.level} · ${levelDef(s.level).name} · ${money(s.cash)}`;

function showConflict(c: Conflict): void {
  openModal({
    title: '☁️ Deux parties différentes',
    dismissable: false,
    body: `<p class="muted">Ta partie a avancé sur cet appareil <b>et</b> sur un autre. Choisis celle que tu veux garder : l’autre sera remplacée partout.</p>
      <div class="conflict-grid">
        <div class="conflict-card"><b>📱 Sur cet appareil</b><span>${esc(describe(c.local))}</span>
          <button class="btn ghost block" data-act="cloud-keep" data-arg="local">Garder celle-ci</button></div>
        <div class="conflict-card"><b>☁️ En ligne</b><span>${esc(describe(c.cloud))}</span>
          ${c.cloud.when ? `<span class="small muted">Envoyée le ${esc(fmtTime(c.cloud.when.getTime()))}</span>` : ''}
          <button class="btn primary block" data-act="cloud-keep" data-arg="cloud">Reprendre celle-ci</button></div>
      </div>`,
  });
}

export function setupCloud(render: () => void): void {
  // « Entrée » dans le formulaire : pas de rechargement de page (le bouton « Se connecter » fait le travail).
  document.addEventListener('submit', (e) => { if ((e.target as HTMLElement).matches('[data-cloud-form]')) e.preventDefault(); });
  let previous = cloudStatus();
  initCloud({
    getState: () => store.state,
    applyState: (state) => {
      store.state = state;
      ui.entering = true;
      render();
      toast(`☁️ Partie récupérée : jour ${state.day}, niveau ${state.level}.`, 'success');
    },
    onConflict: showConflict,
    busy: () => ui.simRunning,
    onChange: () => {
      const s = cloudStatus();
      if (s === 'error' && previous !== 'error') toast(`⚠️ ${esc(cloudError())}`, 'error');
      if (s === 'synced' && (previous === 'syncing' && !lastShown)) { lastShown = true; toast('☁️ Partie sauvegardée en ligne.', 'success'); }
      previous = s;
      refreshCloudUi();
    },
  });
}
let lastShown = false;

const field = (id: string) => ($<HTMLInputElement>(`#${id}`)?.value ?? '');
function message(text: string, ok = false): void {
  const el = document.getElementById('cloud-msg');
  if (el) { el.textContent = text; el.className = `small ${ok ? 'pos' : 'neg'}`; }
}

async function withBusy(btn: HTMLElement, fn: () => Promise<string | null>, okText?: string): Promise<void> {
  (btn as HTMLButtonElement).disabled = true;
  message('');
  const err = await fn();
  (btn as HTMLButtonElement).disabled = false;
  if (err) { message(err); sfx.error(); } else if (okText) message(okText, true);
}

on('cloud-signin', (_a, el) => { void withBusy(el, () => signIn(field('cloud-email'), field('cloud-pass'))); });
on('cloud-signup', (_a, el) => { void withBusy(el, () => signUp(field('cloud-email'), field('cloud-pass'))); });
on('cloud-reset', (_a, el) => {
  if (!field('cloud-email')) return message('Écris d’abord ton adresse e-mail, puis touche « Mot de passe oublié ».');
  void withBusy(el, () => resetPassword(field('cloud-email')), '📧 E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.');
});
on('cloud-sync', () => { void reconcile(); });
on('cloud-logout', () => { void logOut().then(() => { lastShown = false; toast('Déconnecté. Ta partie reste sur cet appareil.', 'info'); }); });
on('cloud-keep', (choice) => {
  closeModal();
  void resolveConflict(choice as 'local' | 'cloud');
});
export { flush as flushCloud };
