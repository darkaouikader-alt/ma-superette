// Succursales : achat et revenus quotidiens.
import { BRANCHES, BRANCH_BY_ID, type BranchDef } from '../data/branches';
import type { GameState } from '../state/types';
import { round2 } from './economy';

export const ownedBranches = (state: GameState): BranchDef[] => (state.branches ?? []).map((id) => BRANCH_BY_ID[id]).filter(Boolean);
export const ownsBranch = (state: GameState, id: string) => (state.branches ?? []).includes(id);

/** La réputation du magasin principal rejaillit sur toute l'enseigne. */
export const branchRepFactor = (reputation: number) => 0.7 + 0.6 * Math.min(100, Math.max(0, reputation)) / 100;

export function branchIncomeOf(def: BranchDef, state: GameState): number {
  return round2(def.income * branchRepFactor(state.reputation));
}

/** Revenu total des succursales pour la journée. */
export function dailyBranchIncome(state: GameState): number {
  return round2(ownedBranches(state).reduce((s, b) => s + branchIncomeOf(b, state), 0));
}

export function buyBranch(state: GameState, id: string): string | null {
  const def = BRANCH_BY_ID[id];
  if (!def) return 'Succursale inconnue.';
  if (ownsBranch(state, id)) return 'Tu possèdes déjà cette succursale.';
  if (state.level < def.minLevel) return `Niveau ${def.minLevel} requis.`;
  if (state.cash < def.cost) return 'Trésorerie insuffisante.';
  state.cash = round2(state.cash - def.cost);
  (state.branches ??= []).push(id);
  return null;
}

export { BRANCHES };
