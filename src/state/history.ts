// Historique des bilans : on garde le détail complet des derniers jours seulement.
// Les bilans plus anciens ne servent qu'aux statistiques (montants et compteurs) : leurs listes
// détaillées (ventes par produit, périmés, détail de réputation…) sont réduites pour que la
// sauvegarde reste légère (Firestore refuse les documents de plus de 1 Mo, et chaque magasin a la sienne).
import type { DayReport } from './types';

/** Nombre de bilans récents gardés en entier (le panneau « historique » détaille les 7 derniers jours). */
export const FULL_HISTORY_DAYS = 7;

export function compactReport(r: DayReport): void {
  r.sales = {};
  r.shops = undefined;
  r.essentialStockouts = [];
  r.expired = [];
  r.repDetails = [];
  r.objectivesDone = [];
  r.stockouts = [];
  r.decorUnlocked = undefined;
  if (r.lostSales) r.lostSales.top = [];
}

/** Réduit les bilans plus anciens que les FULL_HISTORY_DAYS derniers. */
export function compactHistory(history: DayReport[]): void {
  for (let i = 0; i < history.length - FULL_HISTORY_DAYS; i++) compactReport(history[i]);
}
