// @vitest-environment happy-dom
// Synchronisation entre appareils, avec une fausse base en ligne (Firebase simulé).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const g = globalThis as unknown as { __docs: Record<string, Doc>; __authCb: (u: unknown) => void };
g.__docs = {};

vi.mock('../src/cloud/config', () => ({
  FIREBASE_CONFIG: { apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' },
  CLOUD_HOSTS: ['localhost'],
}));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  initializeAuth: () => ({}), indexedDBLocalPersistence: {}, browserLocalPersistence: {},
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => { g.__authCb = cb; },
  signInWithEmailAndPassword: async (_a: unknown, email: string) => { g.__authCb({ uid: 'joueur1', email }); },
  createUserWithEmailAndPassword: async (_a: unknown, email: string) => { g.__authCb({ uid: 'joueur1', email }); },
  signOut: async () => { g.__authCb(null); },
  sendPasswordResetEmail: async () => undefined,
}));
vi.mock('firebase/firestore/lite', () => {
  const snap = (ref: { path: string }) => ({ exists: () => !!g.__docs[ref.path], get: (k: string) => g.__docs[ref.path]?.[k] });
  return {
    getFirestore: () => ({}),
    doc: (_db: unknown, c: string, id: string) => ({ path: `${c}/${id}` }),
    getDoc: async (ref: { path: string }) => snap(ref),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({ get: async (ref: { path: string }) => snap(ref), set: (ref: { path: string }, data: Doc) => { g.__docs[ref.path] = data; } }),
    serverTimestamp: () => ({ toDate: () => new Date() }),
  };
});

/** Simule un appareil : stockage local vide, modules rechargés, une partie en mémoire. */
async function device(seed: number) {
  localStorage.clear();
  vi.resetModules();
  const sync = await import('../src/cloud/sync');
  const { createNewGame } = await import('../src/state/store');
  const save = await import('../src/state/save');
  const sim = await import('../src/systems/simulation');
  let state = createNewGame(seed);
  const conflicts: unknown[] = [];
  sync.initCloud({
    getState: () => state,
    applyState: (s) => { state = s; },
    onConflict: (c) => conflicts.push(c),
    onChange: () => undefined,
    busy: () => false,
  });
  const playDay = () => { sim.runDay(state); sim.startNextDay(state); save.saveGame(state); };
  const settle = () => new Promise((r) => setTimeout(r, 20));
  return { sync, get state() { return state; }, conflicts, playDay, settle };
}

describe('synchronisation entre appareils', () => {
  beforeEach(() => { g.__docs = {}; });

  it('premier appareil : la partie est envoyée en ligne à la connexion', async () => {
    const a = await device(1);
    a.playDay(); a.playDay();
    await a.sync.signIn('moi@exemple.fr', 'secret1');
    await a.settle();
    expect(g.__docs['saves/joueur1'].day).toBe(3);
    expect(g.__docs['saves/joueur1'].rev).toBe(1);
    expect(a.sync.cloudStatus()).toBe('synced');
  });

  it('second appareil neuf : il récupère automatiquement la partie en ligne', async () => {
    const a = await device(1);
    a.playDay(); a.playDay(); a.playDay();
    await a.sync.signIn('moi@exemple.fr', 'secret1');
    await a.settle();
    const b = await device(2);
    expect(b.state.day).toBe(1);
    await b.sync.signIn('moi@exemple.fr', 'secret1');
    await b.settle();
    expect(b.state.day).toBe(4);
    expect(b.conflicts).toHaveLength(0);
  });

  it('les changements d’un appareil sont envoyés, puis repris par l’autre', async () => {
    const a = await device(1);
    await a.sync.signIn('moi@exemple.fr', 'secret1'); await a.settle();
    a.playDay();
    await a.sync.flush();
    expect(g.__docs['saves/joueur1'].day).toBe(2);
    expect(g.__docs['saves/joueur1'].rev).toBe(2);
  });

  it('conflit : si les deux appareils ont avancé, le joueur choisit', async () => {
    const a = await device(1);
    a.playDay();
    await a.sync.signIn('moi@exemple.fr', 'secret1'); await a.settle(); // en ligne : jour 2
    const b = await device(3);
    b.playDay(); b.playDay(); b.playDay(); b.playDay(); // partie différente, jour 5
    await b.sync.signIn('moi@exemple.fr', 'secret1'); await b.settle();
    expect(b.sync.cloudStatus()).toBe('conflict');
    expect(b.conflicts).toHaveLength(1);
    await b.sync.resolveConflict('local');
    await b.settle();
    expect(g.__docs['saves/joueur1'].day).toBe(5);
    expect(g.__docs['saves/joueur1'].rev).toBe(2);
  });

  it('n’écrase jamais une partie envoyée entre-temps par un autre appareil', async () => {
    const a = await device(1);
    await a.sync.signIn('moi@exemple.fr', 'secret1'); await a.settle(); // rev 1
    // un autre appareil envoie la révision 2 pendant que A joue
    g.__docs['saves/joueur1'] = { ...g.__docs['saves/joueur1'], rev: 2, day: 9 };
    a.playDay();
    await a.sync.flush();
    expect(g.__docs['saves/joueur1'].day).toBe(9);
    expect(a.sync.cloudStatus()).toBe('conflict');
  });
});
