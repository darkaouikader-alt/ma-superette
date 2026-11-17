// Magasin affiché / simulé en ce moment et son gérant (sans dépendances : utilisé par economy.ts).
import { levelDef } from '../data/levels';
import { MANAGER_BY_ID, type ManagerDef } from '../data/shops';
import type { GameState } from '../state/types';

/** Gérant du magasin courant (null : géré par le joueur). */
export function currentManager(state: Pick<GameState, 'shops'>): ManagerDef | null {
  const s = state.shops;
  const id = s?.list[s.active]?.manager;
  return id ? MANAGER_BY_ID[id] ?? null : null;
}

/** Rendement du magasin courant (1 sans gérant). */
export const managerEfficiency = (state: Pick<GameState, 'shops'>) => currentManager(state)?.efficiency ?? 1;

export const managerSalary = (m: ManagerDef, level: number) => Math.round(m.salary * levelDef(level).traffic);
