import { describe, expect, it } from 'vitest';
import { DECOR_BY_ID, DECOR_PARTS, DECOR_SLOTS, START_DECOR, tierOf } from '../src/data/decor';
import { OBJECTIVE_BY_ID } from '../src/data/objectives';
import { loadGame, saveGame, type StorageLike } from '../src/state/save';
import { createNewGame } from '../src/state/store';
import { applyTheme, charmSummary, checkDecorUnlocks, equipPart, isOutdated } from '../src/systems/decor';
import { potentialCustomers } from '../src/systems/economy';
import { addXp } from '../src/systems/progression';
import { runDay } from '../src/systems/simulation';

describe('catalogue de façade', () => {
  it('chaque élément a un emplacement, un objectif existant et un élément de départ par emplacement', () => {
    expect(DECOR_PARTS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(DECOR_PARTS.map((p) => p.id)).size).toBe(DECOR_PARTS.length);
    for (const s of DECOR_SLOTS) expect(DECOR_BY_ID[START_DECOR[s.id]].slot).toBe(s.id);
    for (const p of DECOR_PARTS) if (p.unlock.kind === 'objective') expect(OBJECTIVE_BY_ID[p.unlock.id], p.id).toBeTruthy();
  });
});

describe('éléments à gagner', () => {
  it('une nouvelle partie ne possède que les éléments de départ', () => {
    const s = createNewGame(1);
    expect(s.decor.owned.every((id) => DECOR_BY_ID[id].unlock.kind === 'start')).toBe(true);
    expect(equipPart(s, 'f_brique')).toMatch(/Pas encore gagné/);
  });
  it('monter de niveau fait gagner des éléments', () => {
    const s = createNewGame(1);
    addXp(s, 100000);
    const won = checkDecorUnlocks(s).map((p) => p.id);
    expect(won).toContain('f_brique');
    expect(won).toContain('p_auto');
    expect(won).not.toContain('f_metal'); // objectif « 10 000 € » non atteint
  });
  it('un élément de supermarché ne peut pas être posé sur une épicerie', () => {
    const s = createNewGame(1);
    s.decor.owned.push('p_auto');
    expect(equipPart(s, 'p_auto')).toMatch(/Supermarché/);
    s.level = 7;
    expect(equipPart(s, 'p_auto')).toBeNull();
  });
  it('les succès (clients servis…) font gagner des éléments', () => {
    const s = createNewGame(1);
    s.totals.customers = 600;
    expect(checkDecorUnlocks(s).map((p) => p.id)).toContain('t_bois');
  });
});

describe('effets sur la partie', () => {
  it('une plus belle façade attire plus de clients et rapporte de la réputation', () => {
    const a = createNewGame(5), b = createNewGame(5);
    b.level = a.level = 2;
    b.decor.owned.push('f_brique', 't_tuiles', 'a_rouge', 's_paves', 'd_plantes', 'l_guirlande');
    for (const id of ['f_brique', 't_tuiles', 'a_rouge', 's_paves', 'd_plantes', 'l_guirlande']) equipPart(b, id);
    expect(charmSummary(b).total).toBeGreaterThan(charmSummary(a).total);
    expect(potentialCustomers(b)).toBeGreaterThan(potentialCustomers(a));
    const rb = runDay(b).report;
    expect(rb.repDetails.find((d) => d.label === 'Façade attrayante')!.delta).toBeGreaterThan(0);
  });
  it('les éléments trop modestes deviennent démodés quand le magasin grandit', () => {
    const s = createNewGame(1);
    s.decor.owned.push('f_brique');
    equipPart(s, 'f_brique');
    const charmEpicerie = charmSummary(s).total;
    s.level = 7; // supermarché
    expect(tierOf(s.level)).toBe(4);
    expect(isOutdated(s, DECOR_BY_ID.f_brique)).toBe(true);
    expect(charmSummary(s).total).toBeLessThan(charmEpicerie);
    expect(charmSummary(s).outdated.map((p) => p.id)).toContain('f_brique');
  });
  it('porter un thème complet donne un bonus de charme', () => {
    const s = createNewGame(1);
    s.level = 8;
    s.decor.owned.push(...DECOR_PARTS.filter((p) => p.theme === 'moderne').map((p) => p.id));
    const before = charmSummary(s).total;
    expect(applyTheme(s, 'moderne')).toBeGreaterThanOrEqual(6);
    const after = charmSummary(s);
    expect(after.bestTheme?.mult).toBeGreaterThan(1);
    expect(after.total).toBeGreaterThan(before * 3);
    expect(after.traffic).toBeLessThanOrEqual(0.15);
  });
});

describe('sauvegarde de la façade', () => {
  it('conserve les éléments gagnés et équipés ; une ancienne sauvegarde reçoit la façade de départ', () => {
    const data: Record<string, string> = {};
    const storage: StorageLike = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
    const s = createNewGame(2);
    s.level = 2; s.decor.owned.push('f_brique'); equipPart(s, 'f_brique');
    saveGame(s, storage);
    expect(loadGame(createNewGame(1), storage)!.decor.equipped.facade).toBe('f_brique');
    const old = JSON.parse(data['ma-superette-save-v1']);
    delete old.decor;
    data['ma-superette-save-v1'] = JSON.stringify(old);
    expect(loadGame(createNewGame(1), storage)!.decor.equipped.facade).toBe('f_creme');
  });
});
