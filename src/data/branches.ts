// Succursales : de nouveaux magasins achetés avec la trésorerie, qui rapportent chaque jour.
// Revenu réel = revenu de base × facteur de réputation (de ×0,7 à 0 de réputation, à ×1,3 à 100).
export interface BranchDef {
  id: string;
  name: string;
  emoji: string;
  city: string;
  minLevel: number;
  cost: number;
  /** Revenu net de base par jour. */
  income: number;
}

export const BRANCHES: BranchDef[] = [
  { id: 'gare', name: 'Boutique de gare', emoji: '🚉', city: 'Gare centrale', minLevel: 8, cost: 25000, income: 520 },
  { id: 'centre', name: 'Supérette de centre-ville', emoji: '🏙️', city: 'Centre-ville', minLevel: 9, cost: 60000, income: 1150 },
  { id: 'banlieue', name: 'Mini-marché de banlieue', emoji: '🏘️', city: 'Les Lilas', minLevel: 10, cost: 120000, income: 2100 },
  { id: 'zone', name: 'Supermarché de zone commerciale', emoji: '🛍️', city: 'Zone des Peupliers', minLevel: 11, cost: 250000, income: 4000 },
  { id: 'region', name: 'Hypermarché régional', emoji: '🏬', city: 'Capitale régionale', minLevel: 12, cost: 500000, income: 7400 },
  { id: 'phare', name: 'Magasin phare', emoji: '🗼', city: 'Paris', minLevel: 13, cost: 1000000, income: 14000 },
];

export const BRANCH_BY_ID = Object.fromEntries(BRANCHES.map((b) => [b.id, b]));
