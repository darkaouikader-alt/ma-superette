// Sauvegarde dans localStorage (ou tout stockage compatible, pour les tests).
import { compactHistory } from './history';
import { SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { PRODUCT_BY_ID } from '../data/products';
import type { GameState } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

type SaveListener = (state: GameState) => void;
const saveListeners: SaveListener[] = [];
/** Prévenu après chaque sauvegarde locale réussie (utilisé par la synchronisation en ligne). */
export const onGameSaved = (fn: SaveListener) => { saveListeners.push(fn); };

export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    if (storage === defaultStorage()) for (const fn of saveListeners) fn(state);
    return true;
  } catch {
    return false;
  }
}

/**
 * Charge une partie. `fresh` fournit les valeurs par défaut pour les champs
 * absents (sauvegardes plus anciennes). Retourne null si rien d'exploitable.
 */
export function loadGame(fresh: GameState, storage: StorageLike | null = defaultStorage()): GameState | null {
  if (!storage) return null;
  try {
    return parseSave(fresh, storage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** Lit une sauvegarde au format texte (stockage local ou copie en ligne). */
export function parseSave(fresh: GameState, raw: string | null): GameState | null {
  try {
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<GameState>;
    if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION) return null;
    if (typeof data.day !== 'number' || typeof data.cash !== 'number' || !Array.isArray(data.slots)) return null;
    const state: GameState = {
      ...fresh, ...data,
      objectives: { ...fresh.objectives, ...data.objectives },
      totals: { ...fresh.totals, ...data.totals },
      settings: { ...fresh.settings, ...data.settings },
    };
    // Nettoie les références à des produits retirés du catalogue.
    for (const s of state.slots) if (s.productId && !PRODUCT_BY_ID[s.productId]) { s.productId = null; s.qty = 0; }
    for (const pid of Object.keys(state.stock)) if (!PRODUCT_BY_ID[pid]) delete state.stock[pid];
    state.cart = state.cart.filter((c) => PRODUCT_BY_ID[c.productId]);
    // Anciennes sauvegardes : allège l'historique de chaque magasin.
    compactHistory(state.history);
    for (const e of state.shops?.list ?? []) if (e.data?.history) compactHistory(e.data.history);
    return state;
  } catch {
    return null;
  }
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch { /* stockage indisponible */ }
}
