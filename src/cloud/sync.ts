// Compte joueur et synchronisation de la partie entre appareils (Firebase).
//
// Principe : chaque compte a UN document `saves/{uid}` contenant la partie et un numéro de
// révision `rev`. Chaque appareil retient la révision en ligne sur laquelle il est basé
// (`meta.rev`) et s'il a des changements pas encore envoyés (`meta.dirty`).
//  - en ligne plus récent et rien à envoyer      → on reprend la partie en ligne ;
//  - en ligne inchangé et changements locaux      → on envoie (rev + 1) ;
//  - les deux ont changé                          → conflit : le joueur choisit.
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence, createUserWithEmailAndPassword, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type Auth, type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp, type Firestore, type Timestamp } from 'firebase/firestore/lite';
import { onGameSaved, parseSave, saveGame } from '../state/save';
import { createNewGame } from '../state/store';
import type { GameState } from '../state/types';
import { CLOUD_HOSTS, FIREBASE_CONFIG } from './config';

export type CloudStatus = 'off' | 'unavailable' | 'signedOut' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error' | 'conflict';

export interface SaveSummary { day: number; level: number; cash: number; when?: Date }
export interface Conflict { local: SaveSummary; cloud: SaveSummary }

interface Meta { uid: string | null; rev: number; dirty: boolean; lastSync: number | null }
const META_KEY = 'ma-superette-cloud';
const UPLOAD_DELAY_MS = 4000;

interface Hooks {
  getState: () => GameState;
  /** Remplace la partie en cours par celle téléchargée. */
  applyState: (state: GameState) => void;
  /** Le joueur doit choisir entre deux parties. */
  onConflict: (c: Conflict) => void;
  onChange: () => void;
  /** La simulation d'une journée est en cours (on attend la fin). */
  busy: () => boolean;
}

let auth: Auth | null = null;
let db: Firestore | null = null;
let hooks: Hooks | null = null;
let user: User | null = null;
let status: CloudStatus = 'off';
let lastError = '';
let timer: ReturnType<typeof setTimeout> | null = null;
let applying = false;
let authResolved = false;
const authWaiters: (() => void)[] = [];
/** Appelle `fn` dès que l'on sait si un joueur est connecté sur cet appareil. */
export function whenAuthResolved(fn: () => void): void { if (authResolved) fn(); else authWaiters.push(fn); }
let pendingConflict: { cloudRev: number; cloudData: string } | null = null;

function readMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
    if (m && typeof m.rev === 'number') return m;
  } catch { /* stockage indisponible */ }
  return { uid: null, rev: 0, dirty: false, lastSync: null };
}
function writeMeta(m: Meta): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* stockage indisponible */ }
}

function setStatus(s: CloudStatus, err = ''): void {
  status = s;
  lastError = err;
  hooks?.onChange();
}

export const cloudStatus = () => status;
/** Accès à la base pour les autres modules (profil, classement). */
export const cloudDb = () => db;
let afterUpload: ((state: GameState) => void) | null = null;
/** Appelé après chaque envoi réussi de la partie (mise à jour du classement). */
export const onUploaded = (fn: (state: GameState) => void) => { afterUpload = fn; };
export const cloudError = () => lastError;
export const cloudUser = () => user;
export const lastSyncTime = () => readMeta().lastSync;

/** Le jeu peut-il proposer la synchronisation ici ? */
export function cloudConfigured(): boolean { return FIREBASE_CONFIG !== null; }
export function cloudAvailableHere(): boolean {
  return cloudConfigured() && location.protocol.startsWith('http') && CLOUD_HOSTS.includes(location.hostname);
}

const summary = (s: GameState): SaveSummary => ({ day: s.day, level: s.level, cash: s.cash });
/** Une partie « vierge » (jour 1, rien vendu) peut être remplacée sans demander. */
const isFresh = (s: GameState) => s.day === 1 && s.history.length === 0 && s.totals.ordersPlaced === 0;

export function initCloud(h: Hooks): void {
  hooks = h;
  if (!cloudConfigured()) return setStatus('off');
  if (!cloudAvailableHere()) return setStatus('unavailable');
  try {
    const app = initializeApp(FIREBASE_CONFIG!);
    auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    db = getFirestore(app);
  } catch (e) {
    return setStatus('error', explain(e));
  }
  setStatus('signedOut');
  onAuthStateChanged(auth, (u) => {
    user = u;
    if (!authResolved) { authResolved = true; authWaiters.splice(0).forEach((fn) => fn()); }
    if (!u) return setStatus('signedOut');
    const meta = readMeta();
    // Autre compte que la dernière fois : on repart de zéro côté synchronisation.
    if (meta.uid !== u.uid) writeMeta({ uid: u.uid, rev: 0, dirty: true, lastSync: null });
    void reconcile();
  });
  onGameSaved(() => {
    if (applying || !user) return;
    const meta = readMeta();
    if (!meta.dirty) writeMeta({ ...meta, dirty: true });
    if (status === 'synced') setStatus('pending');
    schedule();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });
  window.addEventListener('online', () => { if (user) void reconcile(); });
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void flush(); }, UPLOAD_DELAY_MS);
}

// ── Compression des grosses parties ─────────────────────────
// Firestore refuse les documents de plus de 1 Mo. Au-delà de PACK_FROM caractères, la partie est
// compressée (gzip intégré au navigateur, puis base64) dans le champ `z` au lieu de `data`.
// Les petites parties restent en clair : lisibles aussi par les anciennes versions du jeu.
const PACK_FROM = 600_000;
const canPack = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzipBase64(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Champs à écrire pour la partie : `data` (texte) ou `z` (compressée). */
export async function packSave(json: string): Promise<{ data: string } | { z: string }> {
  return json.length >= PACK_FROM && canPack() ? { z: await gzipBase64(json) } : { data: json };
}

/** Texte de la partie depuis les champs du document en ligne. */
export async function unpackSave(fields: { data?: unknown; z?: unknown }): Promise<string> {
  if (typeof fields.z === 'string') {
    if (!canPack()) throw new Error('Mets à jour ton navigateur pour lire cette partie en ligne.');
    return gunzipBase64(fields.z);
  }
  return typeof fields.data === 'string' ? fields.data : '';
}

/** Compare la partie locale et la partie en ligne, puis télécharge ou envoie. */
export async function reconcile(): Promise<void> {
  if (!user || !db || !hooks) return;
  if (hooks.busy()) { setTimeout(() => { void reconcile(); }, 1500); return; }
  setStatus('syncing');
  try {
    const snap = await getDoc(doc(db, 'saves', user.uid));
    const meta = readMeta();
    const local = hooks.getState();
    if (!snap.exists()) {
      await upload(true);
      return;
    }
    const cloudRev = snap.get('rev') as number;
    const cloudData = await unpackSave({ data: snap.get('data'), z: snap.get('z') });
    if (cloudRev === meta.rev) {
      if (meta.dirty) await upload(); else markSynced(cloudRev);
      return;
    }
    if (!meta.dirty || isFresh(local)) {
      applyCloud(cloudRev, cloudData);
      return;
    }
    askConflict(cloudRev, cloudData, snap.get('updatedAt') as Timestamp | undefined);
  } catch (e) {
    fail(e);
  }
}

/** Envoie la partie locale si elle a changé. */
export async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!user || !db || !hooks || status === 'conflict' || status === 'syncing') return;
  if (!readMeta().dirty) return;
  if (hooks.busy()) { schedule(); return; }
  setStatus('syncing');
  try {
    await upload();
  } catch (e) {
    fail(e);
  }
}

/**
 * Écrit la partie en ligne. Si une autre partie a été envoyée entre-temps (révision différente),
 * on n'écrase rien et on passe en conflit — sauf `force` (choix explicite du joueur).
 */
async function upload(force = false): Promise<void> {
  if (!user || !db || !hooks) return;
  const ref = doc(db, 'saves', user.uid);
  const state = hooks.getState();
  const packed = await packSave(JSON.stringify(state));
  const meta = readMeta();
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cloudRev = snap.exists() ? (snap.get('rev') as number) : 0;
    if (snap.exists() && cloudRev !== meta.rev && !force) {
      return { conflict: true as const, cloudRev, raw: { data: snap.get('data'), z: snap.get('z') }, when: snap.get('updatedAt') as Timestamp | undefined };
    }
    const rev = cloudRev + 1;
    tx.set(ref, {
      rev, ...packed, day: state.day, level: state.level, cash: Math.round(state.cash * 100) / 100,
      updatedAt: serverTimestamp(), device: deviceName(),
    });
    return { conflict: false as const, rev };
  });
  if (result.conflict) {
    askConflict(result.cloudRev, await unpackSave(result.raw), result.when);
    return;
  }
  markSynced(result.rev);
  afterUpload?.(state);
}

function markSynced(rev: number): void {
  writeMeta({ uid: user?.uid ?? null, rev, dirty: false, lastSync: Date.now() });
  setStatus('synced');
}

function applyCloud(rev: number, data: string): void {
  if (!hooks) return;
  const state = parseSave(createNewGame(), data);
  if (!state) return setStatus('error', 'La partie en ligne est illisible.');
  applying = true;
  try {
    hooks.applyState(state);
    saveGame(state);
  } finally {
    applying = false;
  }
  markSynced(rev);
}

function askConflict(cloudRev: number, cloudData: string, when?: Timestamp): void {
  if (!hooks) return;
  const cloudState = parseSave(createNewGame(), cloudData);
  if (!cloudState) return setStatus('error', 'La partie en ligne est illisible.');
  pendingConflict = { cloudRev, cloudData };
  setStatus('conflict');
  hooks.onConflict({ local: summary(hooks.getState()), cloud: { ...summary(cloudState), when: when?.toDate?.() } });
}

/** Choix du joueur en cas de conflit. */
export async function resolveConflict(keep: 'local' | 'cloud'): Promise<void> {
  const c = pendingConflict;
  pendingConflict = null;
  if (!c) return;
  if (keep === 'cloud') return applyCloud(c.cloudRev, c.cloudData);
  setStatus('syncing');
  try {
    await upload(true);
  } catch (e) {
    fail(e);
  }
}

function fail(e: unknown): void {
  const offline = !navigator.onLine || /network|unavailable|offline/i.test(String((e as { code?: string })?.code ?? e));
  setStatus(offline ? 'offline' : 'error', explain(e));
}

// ── Compte ──────────────────────────────────────────────────

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!auth) return 'La synchronisation n’est pas disponible ici.';
  try { await createUserWithEmailAndPassword(auth, email.trim(), password); return null; } catch (e) { return explain(e); }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!auth) return 'La synchronisation n’est pas disponible ici.';
  try { await signInWithEmailAndPassword(auth, email.trim(), password); return null; } catch (e) { return explain(e); }
}

export async function resetPassword(email: string): Promise<string | null> {
  if (!auth) return 'La synchronisation n’est pas disponible ici.';
  try { await sendPasswordResetEmail(auth, email.trim()); return null; } catch (e) { return explain(e); }
}

/** Déconnexion : envoie d'abord les derniers changements. La partie reste sur l'appareil. */
export async function logOut(): Promise<void> {
  if (!auth) return;
  await flush().catch(() => undefined);
  await signOut(auth);
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Navigateur';
}

/** Messages d'erreur Firebase traduits pour le joueur. */
export function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/missing-email': 'Indique ton adresse e-mail.',
    'auth/missing-password': 'Indique ton mot de passe.',
    'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : utilise « Se connecter ».',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse : utilise « Créer un compte ».',
    'auth/too-many-requests': 'Trop d’essais : patiente quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion internet.',
    'auth/operation-not-allowed': 'La connexion par e-mail n’est pas activée dans Firebase (étape 2 du guide).',
    'auth/unauthorized-domain': 'Ce site n’est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Identifiants Firebase incorrects dans la configuration du jeu.',
    'auth/invalid-api-key': 'Identifiants Firebase incorrects dans la configuration du jeu.',
    'auth/configuration-not-found': 'La connexion par e-mail n’est pas activée dans Firebase (étape 2 du guide).',
    'permission-denied': 'Accès refusé par la base : vérifie les règles Firestore (étape 3 du guide).',
    'unavailable': 'Serveur injoignable : la partie sera envoyée plus tard.',
  };
  return map[code] ?? `Erreur de synchronisation${code ? ` (${code})` : ''}.`;
}
