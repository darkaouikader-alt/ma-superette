// Store : état unique du jeu + notifications à l'interface.
import { BALANCE, SAVE_VERSION } from '../data/constants';
import { PRODUCTS } from '../data/products';
import { expectedDemand } from '../systems/economy';
import { checkDecorUnlocks, freshDecor } from '../systems/decor';
import type { DecorPart } from '../data/decor';
import { checkLongObjectives, ensureObjectives, refreshSellable } from '../systems/progression';
import { addStock, autoArrange, syncSlots } from '../systems/stock';
import { clearSave, loadGame, saveGame } from './save';
import type { GameState, ObjectiveDone, Settings } from './types';

export function createNewGame(seed = Math.floor(Math.random() * 1e9), settings?: Settings): GameState {
  const state: GameState = {
    version: SAVE_VERSION, seed, day: 1, phase: 'morning',
    cash: BALANCE.START_CASH, reputation: BALANCE.START_REPUTATION, xp: 0, level: 1,
    prices: Object.fromEntries(PRODUCTS.map((p) => [p.id, p.market])),
    stock: {}, slots: [], orders: [], nextOrderId: 1, cart: [],
    upgrades: {}, licences: [], unlockedSpecial: [], sellableSince: {},
    events: [], promos: [], campaigns: [], loan: null, history: [], salesHistory: {}, demandHistory: {}, productStats: {},
    objectives: { longDone: [], daily: { day: 0, ids: [], done: [] }, weekly: { week: -1, ids: [], done: [] }, essentialStreak: 0 },
    totals: { revenue: 0, profit: 0, customers: 0, waste: 0, bestProfit: 0, ordersPlaced: 0, promosLaunched: 0, campaignsLaunched: 0, noWasteStreak: 0 },
    decor: freshDecor(),
    morningNews: ['👋 Bienvenue ! Un kit de démarrage est déjà en rayon. Pense à commander pour demain.'],
    pendingLevelUps: [], finalDone: false, tutorialOff: false, lastReport: null,
    settings: { speed: 1, sound: true, dark: false, ...settings },
  };
  syncSlots(state);
  refreshSellable(state);
  // Kit de démarrage : un peu plus d'une journée de ventes des produits de base.
  for (const p of PRODUCTS.filter((x) => x.level === 1 && !x.unlockBy)) {
    addStock(state, p.id, Math.ceil(expectedDemand(state, p) * BALANCE.STARTER_KIT_DAYS), p.cost, state.day);
  }
  autoArrange(state);
  ensureObjectives(state);
  return state;
}

type Listener = () => void;

export const store = {
  state: null as unknown as GameState,
  listeners: [] as Listener[],
  /** Appelé quand des objectifs à long terme sont validés hors bilan. */
  onObjectives: null as ((done: ObjectiveDone[]) => void) | null,
  /** Appelé quand des éléments de façade sont gagnés hors bilan. */
  onDecor: null as ((parts: DecorPart[]) => void) | null,

  init(): void {
    this.state = loadGame(createNewGame()) ?? createNewGame();
    // Anciennes sauvegardes : accorde les éléments de façade déjà mérités.
    const parts = checkDecorUnlocks(this.state);
    this.state.decor.seen.push(...parts.map((p) => p.id));
  },
  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  },
  /** À appeler après toute modification : objectifs, sauvegarde, rendu. */
  commit(): void {
    const done = this.state.phase === 'morning' ? checkLongObjectives(this.state) : [];
    const parts = this.state.phase === 'morning' ? checkDecorUnlocks(this.state) : [];
    saveGame(this.state);
    if (done.length) this.onObjectives?.(done);
    if (parts.length) this.onDecor?.(parts);
    for (const fn of this.listeners) fn();
  },
  /** Nouvelle partie : conserve les réglages. */
  newGame(): void {
    this.state = createNewGame(undefined, this.state?.settings);
    this.commit();
  },
  /** Réinitialisation complète : efface aussi les réglages. */
  reset(): void {
    clearSave();
    this.state = createNewGame();
    this.commit();
  },
};
