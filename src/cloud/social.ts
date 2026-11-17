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
  if (state.cheated) return 'Partie modifiée avec le mode debug : elle n’apparaît pas dans le classement.';
  return null;
}

/** Met à jour la ligne du joueur dans le classement. */
export async function publishScore(state: GameState): Promise<void> {
  const db = cloudDb(), u = cloudUser();
  if (!db || !u || rankingProblem(state)) return;
  await setDoc(doc(db, 'leaderboard', u.uid), {
    username, score: Math.round(state.xp), level: state.level, day: state.day,
    revenue: Math.round(state.totals.revenue), reputation: Math.round(state.reputation), updatedAt: serverTimestamp(),
  });
}

/** Top 100 mondial + la position du joueur s'il est plus loin. */
export async function fetchLeaderboard(state: GameState): Promise<Leaderboard> {
  const db = cloudDb();
  if (!db) throw new Error('Classement indisponible ici.');
  const col = collection(db, 'leaderboard');
  const snap = await getDocs(query(col, orderBy('score', 'desc'), limit(LEADERBOARD_SIZE)));
  const top = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<LeaderEntry, 'uid'>) }));
  const total = (await getCount(col)).data().count;
  const u = cloudUser();
  let me: Leaderboard['me'] = null;
  if (u && !rankingProblem(state)) {
    const i = top.findIndex((e) => e.uid === u.uid);
    if (i >= 0) me = { ...top[i], rank: i + 1 };
    else {
      const score = Math.round(state.xp);
      const ahead = (await getCount(query(col, where('score', '>', score)))).data().count;
      me = { uid: u.uid, username: username!, score, level: state.level, day: state.day, revenue: Math.round(state.totals.revenue), reputation: Math.round(state.reputation), rank: ahead + 1 };
    }
  }
  return { top, me, total };
}

// Après chaque envoi de la partie, on met à jour le classement (sans bloquer la sauvegarde).
onUploaded((state) => { void publishScore(state).catch(() => undefined); });
