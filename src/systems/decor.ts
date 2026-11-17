// Façade : éléments gagnés, équipement, charme et effets sur la partie.
// Ne dépend que des données et de l'état (pas d'import d'economy.ts : pas de cycle).
import {
  DECOR_BALANCE, DECOR_BY_ID, DECOR_PARTS, DECOR_SLOTS, MILESTONES, MILESTONE_BY_ID, START_DECOR, THEMES,
  tierName, tierOf, type DecorLook, type DecorPart, type DecorSlot, type MilestoneDef, type Unlock,
} from '../data/decor';
import { OBJECTIVE_BY_ID } from '../data/objectives';
import type { GameState } from '../state/types';

export function freshDecor(): GameState['decor'] {
  return { owned: DECOR_PARTS.filter((p) => p.unlock.kind === 'start').map((p) => p.id), equipped: { ...START_DECOR }, seen: [] };
}

export const ownsPart = (state: GameState, id: string) => state.decor.owned.includes(id);
export const equippedPart = (state: GameState, slot: DecorSlot): DecorPart => DECOR_BY_ID[state.decor.equipped[slot]] ?? DECOR_BY_ID[START_DECOR[slot]];

export function milestoneValue(state: GameState, m: MilestoneDef): number {
  switch (m.metric) {
    case 'customers': return state.totals.customers;
    case 'daysPlayed': return state.day - 1;
    case 'promos': return state.totals.promosLaunched ?? 0;
    case 'campaigns': return state.totals.campaignsLaunched ?? 0;
    case 'noWasteStreak': return state.totals.noWasteStreak ?? 0;
    case 'revenue': return state.totals.revenue;
  }
}

export function unlockMet(state: GameState, u: Unlock): boolean {
  switch (u.kind) {
    case 'start': return true;
    case 'level': return state.level >= u.level;
    case 'objective': return state.objectives.longDone.includes(u.id);
    case 'milestone': {
      const m = MILESTONE_BY_ID[u.id];
      return !!m && milestoneValue(state, m) >= m.target;
    }
  }
}

/** Texte « comment le gagner ». */
export function unlockText(u: Unlock): string {
  switch (u.kind) {
    case 'start': return 'Disponible dès le départ';
    case 'level': return `Atteindre le niveau ${u.level}`;
    case 'objective': return `Objectif : ${OBJECTIVE_BY_ID[u.id]?.label(0) ?? u.id}`;
    case 'milestone': return `Succès : ${MILESTONE_BY_ID[u.id]?.label ?? u.id}`;
  }
}

/** Progression vers un élément verrouillé (0..1), si mesurable. */
export function unlockProgress(state: GameState, u: Unlock): number | null {
  if (u.kind === 'level') return Math.min(1, state.level / u.level);
  if (u.kind === 'milestone') {
    const m = MILESTONE_BY_ID[u.id];
    return m ? Math.min(1, milestoneValue(state, m) / m.target) : null;
  }
  return null;
}

/** Ajoute les éléments dont la condition est remplie. Retourne les nouveaux. */
export function checkDecorUnlocks(state: GameState): DecorPart[] {
  const fresh: DecorPart[] = [];
  for (const p of DECOR_PARTS) {
    if (!state.decor.owned.includes(p.id) && unlockMet(state, p.unlock)) {
      state.decor.owned.push(p.id);
      fresh.push(p);
    }
  }
  return fresh;
}

export function canEquip(state: GameState, id: string): string | null {
  const p = DECOR_BY_ID[id];
  if (!p) return 'Élément inconnu.';
  if (!ownsPart(state, id)) return `Pas encore gagné : ${unlockText(p.unlock)}.`;
  if (p.tier > tierOf(state.level)) return `Réservé au statut « ${tierName(p.tier)} ».`;
  return null;
}

export function equipPart(state: GameState, id: string): string | null {
  const err = canEquip(state, id);
  if (err) return err;
  const p = DECOR_BY_ID[id];
  state.decor.equipped[p.slot] = id;
  if (!state.decor.seen.includes(id)) state.decor.seen.push(id);
  return null;
}

/** Équipe tous les éléments gagnés et compatibles d'un thème. Retourne le nombre posé. */
export function applyTheme(state: GameState, theme: string): number {
  let n = 0;
  for (const s of DECOR_SLOTS) {
    const best = DECOR_PARTS.filter((p) => p.slot === s.id && p.theme === theme && !canEquip(state, p.id)).sort((a, b) => b.tier - a.tier || b.charm - a.charm)[0];
    if (best) { state.decor.equipped[s.id] = best.id; n++; }
  }
  return n;
}

/** Un élément conçu pour un statut trop petit est « démodé » et compte moins. */
export function isOutdated(state: GameState, p: DecorPart): boolean {
  return tierOf(state.level) - p.tier >= 2;
}

export function partCharm(state: GameState, p: DecorPart): number {
  return p.charm * (isOutdated(state, p) ? DECOR_BALANCE.OUTDATED_FACTOR : 1);
}

export interface CharmSummary {
  base: number;
  themeCounts: { theme: string; count: number }[];
  bestTheme: { theme: string; count: number; mult: number } | null;
  total: number;
  traffic: number;
  rep: number;
  outdated: DecorPart[];
}

export function charmSummary(state: GameState): CharmSummary {
  const parts = DECOR_SLOTS.map((s) => equippedPart(state, s.id));
  const base = parts.reduce((s, p) => s + partCharm(state, p), 0);
  const counts = new Map<string, number>();
  for (const p of parts) if (p.charm > 0) counts.set(p.theme, (counts.get(p.theme) ?? 0) + 1);
  const themeCounts = [...counts.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
  let bestTheme: CharmSummary['bestTheme'] = null;
  if (themeCounts[0]) {
    const mult = DECOR_BALANCE.THEME_BONUS.find(([n]) => themeCounts[0].count >= n)?.[1] ?? 1;
    bestTheme = { ...themeCounts[0], mult };
  }
  const total = Math.round(base * (bestTheme?.mult ?? 1) * 10) / 10;
  return {
    base, themeCounts, bestTheme, total,
    traffic: Math.min(DECOR_BALANCE.TRAFFIC_MAX, total * DECOR_BALANCE.TRAFFIC_PER_CHARM),
    rep: Math.min(DECOR_BALANCE.REP_MAX, Math.round(total * DECOR_BALANCE.REP_PER_CHARM * 100) / 100),
    outdated: parts.filter((p) => p.charm > 0 && isOutdated(state, p)),
  };
}

/** Multiplicateur d'affluence dû à la façade. */
export const decorTraffic = (state: GameState) => 1 + charmSummary(state).traffic;

/** Apparence complète à dessiner (éléments équipés, éventuellement avec un aperçu). */
export function decorLook(state: GameState, preview?: string): DecorLook {
  const look: DecorLook = {};
  for (const s of DECOR_SLOTS) {
    const p = preview && DECOR_BY_ID[preview]?.slot === s.id ? DECOR_BY_ID[preview] : equippedPart(state, s.id);
    Object.assign(look, p.look);
  }
  return look;
}

export const themeName = (id: string) => THEMES[id]?.name ?? id;
export const decorCount = () => DECOR_PARTS.length;
export { MILESTONES };
