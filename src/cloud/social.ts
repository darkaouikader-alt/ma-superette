// Nom de joueur (unique) et classement mondial.
//
// Firestore :
//   usernames/{nom en minuscules} → { uid, name }   réservation, garantit l'unicité
//   profiles/{uid}                → { username }
//   leaderboard/{uid}             → { username, score, level, day, revenue, reputation, updatedAt }
// Score = points d'expérience de la partie (gagnés avec le chiffre d'affaires et la réputation).
import {
  collection, doc, getCount, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, where,
} from 'firebase/firestore/lite';
import type { GameState } from '../state/types';
import { cloudDb, cloudUser, explain, onUploaded } from './sync';

export const LEADERBOARD_SIZE = 100;
export const USERNAME_RULE = /^[A-Za-z0-9_-]{3,16}$/;

export interface LeaderEntry { uid: string; username: string; score: number; level: number; day: number; revenue: number; reputation: number }
export interface Leaderboard { top: LeaderEntry[]; me: (LeaderEntry & { rank: number }) | null; total: number }

let username: string | null = null;
let profileLoaded = false;
const listeners: (() => void)[] = [];
export const currentUsername = () => username;
export const profileReady = () => profileLoaded;
export const onProfileChange = (fn: () => void) => { listeners.push(fn); };
const notify = () => listeners.forEach((fn) => fn());

/** Lit le nom de joueur du compte connecté. */
export async function loadProfile(): Promise<string | null> {
  const db = cloudDb(), u = cloudUser();
  profileLoaded = false;
  username = null;
  if (!db || !u) { notify(); return null; }
  try {
    const snap = await getDoc(doc(db, 'profiles', u.uid));
    username = snap.exists() ? (snap.get('username') as string) : null;
  } catch { /* hors ligne : on réessaiera */ }
  profileLoaded = true;
  notify();
  return username;
}

export function forgetProfile(): void { username = null; profileLoaded = false; notify(); }

/** Vérifie le format avant d'interroger la base. */
export function usernameProblem(name: string): string | null {
  if (name.length < 3) return 'Au moins 3 caractères.';
  if (name.length > 16) return '16 caractères maximum.';
  if (!USERNAME_RULE.test(name)) return 'Lettres sans accent, chiffres, « - » et « _ » uniquement.';
  return null;
}

/** Réserve un nom de joueur (unique, sans tenir compte des majuscules). */
export async function chooseUsername(name: string, state: GameState): Promise<string | null> {
  const db = cloudDb(), u = cloudUser();
  if (!db || !u) return 'Connecte-toi d’abord.';
  const clean = name.trim();
  const problem = usernameProblem(clean);
  if (problem) return problem;
  const key = clean.toLowerCase();
  const previous = username;
  try {
    const err = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'usernames', key);
      const taken = await tx.get(ref);
      if (taken.exists() && taken.get('uid') !== u.uid) return 'Ce nom est déjà pris : choisis-en un autre.';
      tx.set(ref, { uid: u.uid, name: clean });
      tx.set(doc(db, 'profiles', u.uid), { username: clean });
      if (previous && previous.toLowerCase() !== key) tx.delete(doc(db, 'usernames', previous.toLowerCase()));
      return null;
    });
    if (err) return err;
  } catch (e) {
    return explain(e);
  }
  username = clean;
  profileLoaded = true;
  notify();
  await publishScore(state).catch(() => undefined);
  return null;
}

/** La partie peut-elle apparaître au classement ? */
export function rankingProblem(state: GameState): string | null {
  if (!cloudUser()) return 'Crée un compte pour apparaître dans le classement.';
  if (!username) return 'Choisis un nom de joueur pour apparaître dans le classement.';
  if (state.cheated) return 'Partie modifiée avec l’ancien mode debug : elle n’apparaît pas dans le classement.';
  return null;
}

const published: (() => void)[] = [];
/** Appelé après chaque mise à jour réussie de la ligne du joueur (le classement affiché se recharge). */
export const onScorePublished = (fn: () => void) => { published.push(fn); };
let lastPublished = '';

/** Ligne du joueur telle qu'elle est en ce moment dans sa partie (toujours à jour, contrairement à la base). */
export function liveEntry(state: GameState, uid: string): LeaderEntry {
  return {
    uid, username: username ?? '', score: Math.round(state.xp), level: state.level, day: state.day,
    revenue: Math.round(state.totals.revenue), reputation: Math.round(state.reputation),
  };
}

/**
 * Met à jour la ligne du joueur dans le classement. Indépendant de la sauvegarde en ligne :
 * un conflit entre appareils ou une sauvegarde refusée ne fige plus le classement.
 */
export async function publishScore(state: GameState): Promise<void> {
  const db = cloudDb(), u = cloudUser();
  if (!db || !u || rankingProblem(state)) return;
  const e = liveEntry(state, u.uid);
  const key = `${u.uid}:${e.score}:${e.level}:${e.day}`;
  if (key === lastPublished) return;
  await setDoc(doc(db, 'leaderboard', u.uid), {
    username, score: e.score, level: e.level, day: e.day, revenue: e.revenue, reputation: e.reputation, updatedAt: serverTimestamp(),
  });
  lastPublished = key;
  published.forEach((fn) => fn());
}

/** Top 100 mondial + la position du joueur s'il est plus loin. */
export async function fetchLeaderboard(state: GameState): Promise<Leaderboard> {
  const db = cloudDb();
  if (!db) throw new Error('Classement indisponible ici.');
  const col = collection(db, 'leaderboard');
  const snap = await getDocs(query(col, orderBy('score', 'desc'), limit(LEADERBOARD_SIZE)));
  let top = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<LeaderEntry, 'uid'>) }));
  let total = (await getCount(col)).data().count;
  const u = cloudUser();
  let me: Leaderboard['me'] = null;
  if (u && !rankingProblem(state)) {
    // Sa propre ligne : les valeurs de la partie en cours (la base peut avoir quelques secondes de retard).
    const live = liveEntry(state, u.uid);
    const wasListed = top.some((e) => e.uid === u.uid);
    const others = top.filter((e) => e.uid !== u.uid);
    const ahead = others.filter((e) => e.score > live.score).length;
    if (ahead < LEADERBOARD_SIZE) {
      top = [...others.slice(0, ahead), live, ...others.slice(ahead)].slice(0, LEADERBOARD_SIZE);
      me = { ...live, rank: ahead + 1 };
    } else {
      top = others;
      // Au-delà du top : joueurs devant soi dans la base (sa propre ligne, plus ancienne, n'est pas devant).
      const n = (await getCount(query(col, where('score', '>', live.score)))).data().count;
      me = { ...live, rank: n + 1 };
    }
    total = Math.max(total, me.rank);
  }
  return { top, me, total };
}

// Après chaque envoi de la partie, on met à jour le classement (sans bloquer la sauvegarde).
onUploaded((state) => { void publishScore(state).catch(() => undefined); });
