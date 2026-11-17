import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/data/constants';
import { clearSave, loadGame, saveGame, type StorageLike } from '../src/state/save';
import { createNewGame } from '../src/state/store';
import { buyUpgrade } from '../src/systems/progression';
import { runDay, startNextDay } from '../src/systems/simulation';

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

describe('sauvegarde', () => {
  it('restaure exactement la partie après quelques jours de jeu', () => {
    const storage = memoryStorage();
    const s = createNewGame(99);
    runDay(s); startNextDay(s);
    buyUpgrade(s, 'deco');
    s.prices.chips = 2.15;
    expect(saveGame(s, storage)).toBe(true);
    const loaded = loadGame(createNewGame(1), storage);
    expect(loaded).toEqual(s);
    expect(loaded!.day).toBe(2);
    expect(loaded!.upgrades.deco).toBe(1);
    expect(loaded!.history.length).toBe(1);
  });
  it('une partie rechargée se poursuit de façon identique (déterminisme)', () => {
    const storage = memoryStorage();
    const a = createNewGame(5);
    saveGame(a, storage);
    const b = loadGame(createNewGame(1), storage)!;
    expect(runDay(a).report).toEqual(runDay(b).report);
  });
  it('retourne null sans sauvegarde, ou si elle est corrompue ou d’une autre version', () => {
    const storage = memoryStorage();
    expect(loadGame(createNewGame(1), storage)).toBeNull();
    storage.setItem(SAVE_KEY, '{pas du json');
    expect(loadGame(createNewGame(1), storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createNewGame(1), version: 0 }));
    expect(loadGame(createNewGame(1), storage)).toBeNull();
  });
  it('complète les champs manquants et retire les produits inconnus', () => {
    const storage = memoryStorage();
    const s = createNewGame(3) as unknown as Record<string, unknown>;
    delete s.tutorialOff;
    (s.slots as { productId: string | null; qty: number }[])[0] = { productId: 'produit_supprime', qty: 4 };
    storage.setItem(SAVE_KEY, JSON.stringify(s));
    const loaded = loadGame(createNewGame(1), storage)!;
    expect(loaded.tutorialOff).toBe(false);
    expect(loaded.slots[0]).toEqual({ productId: null, qty: 0 });
  });
  it('« Réinitialiser » efface la sauvegarde', () => {
    const storage = memoryStorage();
    saveGame(createNewGame(1), storage);
    clearSave(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
