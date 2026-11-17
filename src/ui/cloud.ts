// Interface du compte joueur : carte « Compte » des Réglages, indicateur d'état, conflits.
import { WEEKDAYS } from '../data/constants';
import { levelDef } from '../data/levels';
import {
  cloudError, cloudStatus, cloudUser, flush, initCloud, lastSyncTime, logOut, reconcile, resetPassword, resolveConflict,
  signIn, signUp, whenAuthResolved, cloudAvailableHere, type CloudStatus, type Conflict, type SaveSummary,
} from '../cloud/sync';
import { store } from '../state/store';
import { currentUsername, forgetProfile, onProfileChange, profileReady } from '../cloud/social';
import { onSignedIn } from './leaderboard';
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

/** Formulaire de connexion (réutilisé dans les Réglages et la fenêtre d'accueil). */
function cloudForm(prefix: string, welcome = false): string {
  return `<form class="cloud-form" data-cloud-form>
        <label for="${prefix}-email">Adresse e-mail</label>
        <input id="${prefix}-email" class="cf-email" type="email" autocomplete="username" inputmode="email" placeholder="toi@exemple.fr" />
        <label for="${prefix}-pass">Mot de passe</label>
        <input id="${prefix}-pass" class="cf-pass" type="password" autocomplete="${welcome ? 'new-password' : 'current-password'}" placeholder="6 caractères minimum" />
        <div class="row-gap">
          ${welcome
            ? '<button class="btn primary" type="button" data-act="cloud-signup">Créer mon compte</button><button class="btn ghost" type="submit" data-act="cloud-signin">J’ai déjà un compte</button>'
            : '<button class="btn primary" type="submit" data-act="cloud-signin">Se connecter</button><button class="btn ghost" type="button" data-act="cloud-signup">Créer un compte</button>'}
        </div>
        <button class="link small" type="button" data-act="cloud-reset">Mot de passe oublié ?</button>
        <p class="small neg cf-msg" role="alert"></p>
      </form>`;
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
      <p><b>https://ma-superette.github.io</b></p>
      <p class="muted small">Ici, ta partie est sauvegardée seulement sur cet appareil.</p>`;
  } else if (!u) {
    body = `<p class="muted">Connecte-toi pour retrouver la même partie sur ton téléphone, ta tablette et ton ordinateur.</p>
      ${cloudForm('cloud')}
      <p class="muted small">À la première connexion, la partie de cet appareil est envoyée en ligne. Sur un autre appareil, connecte-toi avec le même compte pour la retrouver.</p>`;
  } else {
    body = `<div class="setting"><div><b>Connecté</b><p class="muted small">${esc(u.email ?? '')}</p></div>${cloudPill()}</div>
      <div class="setting"><div><b>Nom de joueur</b><p class="muted small">${currentUsername() ? esc(currentUsername()!) : profileReady() ? 'Pas encore choisi' : '…'}</p></div>
        <button class="btn ghost sm" data-act="lb-username">${currentUsername() ? '✏️ Modifier' : 'Choisir'}</button></div>
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

// ── Premier lancement sur un appareil : proposer de se connecter ou de créer un compte ──
const WELCOME_KEY = 'ma-superette-accueil-compte';
const welcomeDone = () => { try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch { return true; } };
const setWelcomeDone = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* stockage indisponible */ } };

function showWelcome(): void {
  if (welcomeDone() || cloudUser() || !cloudAvailableHere() || document.querySelector('.welcome-modal')) return;
  openModal({
    className: 'welcome-modal',
    dismissable: false,
    body: `<div class="welcome-head"><span class="welcome-logo">🏪</span>
        <h2>Bienvenue dans Ma Supérette !</h2>
        <p class="muted">Crée ton compte pour sauvegarder ta progression en ligne et la retrouver sur tous tes appareils : téléphone, tablette, ordinateur.</p></div>
      ${cloudForm('welcome', true)}
      <div class="welcome-skip"><button class="link small" type="button" data-act="welcome-skip">Jouer sans compte pour l’instant</button>
        <span class="small muted">Tu pourras créer un compte plus tard dans Réglages.</span></div>`,
    onClose: setWelcomeDone,
  });
  setTimeout(() => $<HTMLInputElement>('#welcome-email')?.focus(), 300);
}

function closeWelcome(): void {
  if (document.querySelector('.welcome-modal')) closeModal();
  setWelcomeDone();
}

on('welcome-skip', () => {
  closeWelcome();
  toast('Tu joues sans compte : ta partie est sauvegardée sur cet appareil.', 'info');
});

export function setupCloud(render: () => void): void {
  onProfileChange(refreshCloudUi);
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
      const uid = cloudUser()?.uid ?? null;
      if (uid !== knownUid) {
        knownUid = uid;
        if (uid) onSignedIn(); else forgetProfile();
      }
      if (cloudUser() && document.querySelector('.welcome-modal')) {
        closeWelcome();
        toast(`👋 Connecté : ${esc(cloudUser()?.email ?? '')}`, 'success');
      }
      if (s === 'error' && previous !== 'error') toast(`⚠️ ${esc(cloudError())}`, 'error');
      if (s === 'synced' && (previous === 'syncing' && !lastShown)) { lastShown = true; toast('☁️ Partie sauvegardée en ligne.', 'success'); }
      previous = s;
      refreshCloudUi();
    },
  });
}
let lastShown = false;
let knownUid: string | null = null;

/** À appeler une fois l'interface affichée. */
export function askAccountOnFirstLaunch(): void {
  if (!cloudAvailableHere() || welcomeDone()) return;
  whenAuthResolved(() => setTimeout(() => { if (!ui.simRunning) showWelcome(); }, 600));
}

const formOf = (el: HTMLElement) => el.closest<HTMLFormElement>('[data-cloud-form]')!;
const field = (el: HTMLElement, cls: string) => formOf(el)?.querySelector<HTMLInputElement>(`.${cls}`)?.value ?? '';
function message(el: HTMLElement, text: string, ok = false): void {
  const m = formOf(el)?.querySelector('.cf-msg');
  if (m) { m.textContent = text; m.className = `small cf-msg ${ok ? 'pos' : 'neg'}`; }
}

async function withBusy(btn: HTMLElement, fn: () => Promise<string | null>, okText?: string): Promise<void> {
  (btn as HTMLButtonElement).disabled = true;
  message(btn, '');
  const err = await fn();
  (btn as HTMLButtonElement).disabled = false;
  if (err) { message(btn, err); sfx.error(); return; }
  if (okText) message(btn, okText, true);
}

on('cloud-signin', (_a, el) => { void withBusy(el, () => signIn(field(el, 'cf-email'), field(el, 'cf-pass'))); });
on('cloud-signup', (_a, el) => { void withBusy(el, () => signUp(field(el, 'cf-email'), field(el, 'cf-pass'))); });
on('cloud-reset', (_a, el) => {
  if (!field(el, 'cf-email')) return message(el, 'Écris d’abord ton adresse e-mail, puis touche « Mot de passe oublié ».');
  void withBusy(el, () => resetPassword(field(el, 'cf-email')), '📧 E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.');
});
on('cloud-sync', () => { void reconcile(); });
on('cloud-logout', () => { void logOut().then(() => { lastShown = false; toast('Déconnecté. Ta partie reste sur cet appareil.', 'info'); }); });
on('cloud-keep', (choice) => {
  closeModal();
  void resolveConflict(choice as 'local' | 'cloud');
});
export { flush as flushCloud };
