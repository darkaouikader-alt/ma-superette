// Nom de joueur et classement mondial (tableau de bord + fenêtre du top 100).
import {
  chooseUsername, currentUsername, fetchLeaderboard, LEADERBOARD_SIZE, loadProfile, profileReady, rankingProblem, type LeaderEntry, type Leaderboard,
} from '../cloud/social';
import { cloudAvailableHere, cloudUser } from '../cloud/sync';
import { levelDef } from '../data/levels';
import { store } from '../state/store';
import type { GameState } from '../state/types';
import { on } from './actions';
import { sfx } from './audio';
import { $, esc, num } from './dom';
import { closeModal, openModal, updateModalBody } from './modal';
import { toast } from './toast';
import { ui } from './uiState';

const CACHE_MS = 60_000;
let cache: { data: Leaderboard | null; error: string | null; at: number } | null = null;
let loading = false;

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);
const ordinal = (n: number) => (n === 1 ? '1er' : `${num(n)}e`);

/** Recharge le classement (après une journée, un changement de nom…). */
export function invalidateLeaderboard(): void { cache = null; }

function load(state: GameState): void {
  if (loading) return;
  loading = true;
  fetchLeaderboard(state)
    .then((data) => { cache = { data, error: null, at: Date.now() }; })
    .catch((e) => { cache = { data: null, error: (e as { code?: string })?.code === 'permission-denied' ? 'Classement pas encore activé (règles Firestore à mettre à jour).' : 'Classement injoignable pour le moment.', at: Date.now() }; })
    .finally(() => {
      loading = false;
      const card = document.getElementById('lb-card');
      if (card) card.outerHTML = leaderboardCard(store.state);
      if (document.querySelector('.lb-modal')) updateModalBody(fullList());
    });
}

function row(e: LeaderEntry, rank: number, mine: boolean): string {
  return `<div class="lb-row ${mine ? 'me' : ''} ${rank <= 3 ? 'podium' : ''}">
    <span class="lb-rank">${medal(rank)}</span>
    <span class="lb-name">${esc(e.username)}${mine ? ' <span class="badge green">Toi</span>' : ''}<span class="small muted">Niv. ${e.level} · ${esc(levelDef(e.level).name)} · jour ${num(e.day)}</span></span>
    <b class="lb-score">${num(e.score)}</b>
  </div>`;
}

export function leaderboardCard(state: GameState): string {
  const head = '<div class="card-head"><h2>🏆 Classement mondial</h2><span class="muted small">Score = points d’expérience</span></div>';
  if (!cloudAvailableHere()) {
    return `<section class="card" id="lb-card">${head}<p class="muted small">Le classement est disponible dans la version en ligne du jeu.</p></section>`;
  }
  if (!cache || Date.now() - cache.at > CACHE_MS) load(state);
  const problem = rankingProblem(state);
  const cta = !cloudUser()
    ? '<button class="btn primary sm" data-act="nav" data-arg="settings">Créer un compte</button>'
    : !currentUsername() && profileReady() ? '<button class="btn primary sm" data-act="lb-username">Choisir mon nom de joueur</button>' : '';
  let body = '';
  if (!cache) body = '<p class="muted small">Chargement du classement…</p>';
  else if (cache.error) body = `<p class="muted small">${esc(cache.error)}</p>`;
  else {
    const d = cache.data!;
    const uid = cloudUser()?.uid;
    body = `${d.me ? `<div class="lb-me"><span class="lb-me-rank">${ordinal(d.me.rank)}</span><span>sur ${num(Math.max(d.total, d.me.rank))} joueur${d.total > 1 ? 's' : ''}<br><span class="small muted">${esc(d.me.username)} · ${num(d.me.score)} points</span></span></div>` : ''}
      <div class="lb-list">${d.top.slice(0, 5).map((e, i) => row(e, i + 1, e.uid === uid)).join('') || '<p class="muted small">Personne n’est encore classé : sois le premier !</p>'}</div>
      ${d.top.length ? `<button class="btn ghost sm block" data-act="lb-open">Voir le top ${LEADERBOARD_SIZE}</button>` : ''}`;
  }
  return `<section class="card" id="lb-card">${head}${problem ? `<p class="small muted">${esc(problem)}</p>${cta}` : ''}${body}</section>`;
}

function fullList(): string {
  if (!cache?.data) return `<p class="muted">${esc(cache?.error ?? 'Chargement…')}</p>`;
  const d = cache.data;
  const uid = cloudUser()?.uid;
  const inTop = d.me && d.me.rank <= LEADERBOARD_SIZE;
  return `<p class="muted small">${num(d.total)} joueur${d.total > 1 ? 's' : ''} classé${d.total > 1 ? 's' : ''} dans le monde. Le score correspond aux points d’expérience gagnés en jouant.</p>
    <div class="lb-list full">${d.top.map((e, i) => row(e, i + 1, e.uid === uid)).join('')}</div>
    ${d.me && !inTop ? `<div class="lb-gap">⋯</div><div class="lb-list">${row(d.me, d.me.rank, true)}</div>` : ''}
    ${!d.me ? `<p class="small muted">${esc(rankingProblem(store.state) ?? '')}</p>` : ''}`;
}

on('lb-open', () => {
  openModal({ title: `🏆 Top ${LEADERBOARD_SIZE} mondial`, body: fullList(), className: 'lb-modal' });
  setTimeout(() => document.querySelector('.lb-modal .lb-row.me')?.scrollIntoView({ block: 'center' }), 50);
});

// ── Choix du nom de joueur ───────────────────────────────────

export function showUsernameModal(): void {
  if (document.querySelector('.username-modal')) return;
  const current = currentUsername();
  openModal({
    className: 'username-modal',
    title: current ? '✏️ Changer de nom de joueur' : '🏷️ Choisis ton nom de joueur',
    body: `<p class="muted">C’est le nom affiché dans le classement mondial. Il doit être unique : 3 à 16 caractères, lettres sans accent, chiffres, « - » ou « _ ».</p>
      <form class="cloud-form" data-cloud-form>
        <label for="lb-name-input">Nom de joueur</label>
        <input id="lb-name-input" type="text" maxlength="16" autocomplete="nickname" autocapitalize="off" spellcheck="false" placeholder="ex. RoiDuRayon" value="${esc(current ?? '')}" />
        <button class="btn primary" type="submit" data-act="lb-name-save">Valider</button>
        <p class="small neg cf-msg" role="alert"></p>
      </form>
      ${current ? '' : '<div class="welcome-skip"><button class="link small" type="button" data-act="modal-close">Plus tard</button><span class="small muted">Tu pourras le choisir dans Réglages.</span></div>'}`,
  });
  setTimeout(() => $<HTMLInputElement>('#lb-name-input')?.focus(), 250);
}

on('lb-username', () => showUsernameModal());
on('lb-name-save', (_a, el) => {
  const input = $<HTMLInputElement>('#lb-name-input');
  const msg = el.closest('form')?.querySelector('.cf-msg');
  if (!input || !msg) return;
  (el as HTMLButtonElement).disabled = true;
  msg.textContent = '';
  void chooseUsername(input.value, store.state).then((err) => {
    (el as HTMLButtonElement).disabled = false;
    if (err) { msg.textContent = err; sfx.error(); return; }
    closeModal();
    sfx.success();
    toast(`🏷️ Ton nom de joueur : ${esc(currentUsername() ?? '')}`, 'success');
    invalidateLeaderboard();
    store.commit();
  });
});

/** À la connexion : charger le profil et demander un nom s'il n'y en a pas. */
export function onSignedIn(): void {
  void loadProfile().then((name) => {
    invalidateLeaderboard();
    const uid = cloudUser()?.uid;
    const key = `ma-superette-nom-demande-${uid}`;
    let asked = true;
    try { asked = localStorage.getItem(key) === '1'; } catch { /* stockage indisponible */ }
    // On ne le demande automatiquement qu'une fois par compte et par appareil.
    if (!name && !asked && !ui.simRunning) {
      try { localStorage.setItem(key, '1'); } catch { /* stockage indisponible */ }
      setTimeout(showUsernameModal, 500);
    }
    store.commit();
  });
}
