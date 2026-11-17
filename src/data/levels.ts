export interface LevelDef {
  level: number;
  name: string;
  /** XP cumulée nécessaire. */
  xp: number;
  /** Emplacements de rayon de base. */
  slots: number;
  /** Volume d'entrepôt de base. */
  warehouse: number;
  /** Multiplicateur de clients potentiels. */
  traffic: number;
  /** Loyer quotidien. */
  rent: number;
  /** Panier moyen : multiplicateur des achats de chaque client (un grand magasin fait remplir le caddie). */
  basket: number;
  /** Remise de la centrale d'achat sur tous les prix fournisseurs (économies d'échelle), de 0 à 1. */
  buying: number;
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Petite épicerie', xp: 0, slots: 20, warehouse: 1000, traffic: 1, rent: 15, basket: 1, buying: 0 },
  { level: 2, name: 'Épicerie de quartier', xp: 700, slots: 24, warehouse: 1500, traffic: 1.15, rent: 24, basket: 1, buying: 0 },
  { level: 3, name: 'Supérette de quartier', xp: 3000, slots: 30, warehouse: 2200, traffic: 1.3, rent: 36, basket: 1, buying: 0 },
  { level: 4, name: 'Supérette +', xp: 8000, slots: 36, warehouse: 3200, traffic: 1.5, rent: 55, basket: 1, buying: 0 },
  { level: 5, name: 'Mini-marché', xp: 18000, slots: 44, warehouse: 4500, traffic: 1.7, rent: 80, basket: 1, buying: 0 },
  { level: 6, name: 'Mini-marché premium', xp: 40000, slots: 52, warehouse: 6200, traffic: 1.9, rent: 115, basket: 1, buying: 0 },
  { level: 7, name: 'Supermarché de proximité', xp: 80000, slots: 62, warehouse: 8200, traffic: 2.15, rent: 160, basket: 1, buying: 0 },
  { level: 8, name: 'Grand supermarché', xp: 140000, slots: 72, warehouse: 10500, traffic: 2.4, rent: 220, basket: 1.03, buying: 0.01 },
  // Fin de partie étendue : l'enseigne continue de grandir (voir aussi les succursales).
  { level: 9, name: 'Hypermarché de quartier', xp: 230000, slots: 84, warehouse: 15000, traffic: 2.7, rent: 280, basket: 1.06, buying: 0.02 },
  { level: 10, name: 'Hypermarché', xp: 370000, slots: 96, warehouse: 20000, traffic: 3, rent: 350, basket: 1.1, buying: 0.03 },
  { level: 11, name: 'Hypermarché régional', xp: 580000, slots: 110, warehouse: 26000, traffic: 3.35, rent: 430, basket: 1.14, buying: 0.04 },
  { level: 12, name: 'Centre commercial', xp: 900000, slots: 124, warehouse: 33000, traffic: 3.7, rent: 520, basket: 1.19, buying: 0.05 },
  { level: 13, name: 'Enseigne régionale', xp: 1400000, slots: 140, warehouse: 42000, traffic: 4.1, rent: 620, basket: 1.24, buying: 0.06 },
  { level: 14, name: 'Enseigne nationale', xp: 2200000, slots: 160, warehouse: 52000, traffic: 4.6, rent: 740, basket: 1.3, buying: 0.07 },
  // Économie évolutive : au-delà de l'enseigne nationale, l'empire (objectif : des millions d'euros).
  { level: 15, name: 'Groupe de distribution', xp: 4000000, slots: 180, warehouse: 70000, traffic: 5.1, rent: 900, basket: 1.38, buying: 0.08 },
  { level: 16, name: 'Leader national', xp: 7000000, slots: 200, warehouse: 90000, traffic: 5.7, rent: 1100, basket: 1.47, buying: 0.09 },
  { level: 17, name: 'Groupe européen', xp: 12000000, slots: 222, warehouse: 115000, traffic: 6.3, rent: 1350, basket: 1.57, buying: 0.1 },
  { level: 18, name: 'Leader européen', xp: 20000000, slots: 246, warehouse: 145000, traffic: 7, rent: 1650, basket: 1.68, buying: 0.11 },
  { level: 19, name: 'Multinationale', xp: 32000000, slots: 272, warehouse: 180000, traffic: 7.8, rent: 2000, basket: 1.8, buying: 0.12 },
  { level: 20, name: 'Empire mondial', xp: 50000000, slots: 300, warehouse: 220000, traffic: 8.7, rent: 2400, basket: 2, buying: 0.13 },
];

export const MAX_LEVEL = LEVELS.length;
export const levelDef = (level: number): LevelDef => LEVELS[Math.min(Math.max(level, 1), MAX_LEVEL) - 1];
