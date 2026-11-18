import { describe, expect, it } from 'vitest';
import { packSave, unpackSave } from '../src/cloud/sync';
import { FULL_HISTORY_DAYS } from '../src/state/history';
import { parseSave } from '../src/state/save';
import { createNewGame } from '../src/state/store';
import { runDay, startNextDay } from '../src/systems/simulation';

describe('sauvegarde légère', () => {
  it('seuls les derniers bilans gardent leur détail', () => {
    const s = createNewGame(1);
    runDay(s); startNextDay(s);
    const day1 = { revenue: s.history[0].revenue, sales: Object.keys(s.history[0].sales).length };
    expect(day1.sales).toBeGreaterThan(0); // kit de démarrage vendu le premier jour
    for (let d = 0; d < FULL_HISTORY_DAYS + 4; d++) { runDay(s); startNextDay(s); }
    const old = s.history[0], recent = s.history[s.history.length - 1];
    expect(Object.keys(old.sales)).toHaveLength(0);
    expect(old.repDetails).toHaveLength(0);
    expect(old.revenue).toBe(day1.revenue); // les montants restent pour les statistiques
    expect(recent.repDetails.length).toBeGreaterThan(0);
    expect(s.history.filter((h) => h.repDetails.length > 0)).toHaveLength(FULL_HISTORY_DAYS);
  });

  it('les anciennes sauvegardes sont allégées au chargement', () => {
    const s = createNewGame(1);
    for (let d = 0; d < FULL_HISTORY_DAYS + 3; d++) { runDay(s); startNextDay(s); }
    const raw = JSON.parse(JSON.stringify(s));
    raw.history[0].sales = { pates: { units: 1, revenue: 1 } };
    const loaded = parseSave(createNewGame(2), JSON.stringify(raw))!;
    expect(Object.keys(loaded.history[0].sales)).toHaveLength(0);
  });

  it('une grosse partie est compressée pour l’envoi en ligne, et se relit à l’identique', async () => {
    const small = JSON.stringify({ a: 1 });
    expect(await packSave(small)).toEqual({ data: small });
    const big = JSON.stringify({ x: 'Supérette 🏪 '.repeat(80_000) });
    const packed = await packSave(big);
    expect('z' in packed).toBe(true);
    expect((packed as { z: string }).z.length).toBeLessThan(big.length / 10);
    expect(await unpackSave(packed)).toBe(big);
    expect(await unpackSave({ data: small })).toBe(small);
  });
});
