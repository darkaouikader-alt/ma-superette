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
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Petite épicerie', xp: 0, slots: 20, warehouse: 400, traffic: 1.0, rent: 15 },
  { level: 2, name: 'Épicerie de quartier', xp: 700, slots: 24, warehouse: 600, traffic: 1.15, rent: 24 },
  { level: 3, name: 'Supérette de quartier', xp: 3000, slots: 30, warehouse: 900, traffic: 1.3, rent: 36 },
  { level: 4, name: 'Supérette +', xp: 8000, slots: 36, warehouse: 1300, traffic: 1.5, rent: 55 },
  { level: 5, name: 'Mini-marché', xp: 18000, slots: 44, warehouse: 1800, traffic: 1.7, rent: 80 },
  { level: 6, name: 'Mini-marché premium', xp: 40000, slots: 52, warehouse: 2500, traffic: 1.9, rent: 115 },
  { level: 7, name: 'Supermarché de proximité', xp: 80000, slots: 62, warehouse: 3300, traffic: 2.15, rent: 160 },
  { level: 8, name: 'Grand supermarché', xp: 140000, slots: 72, warehouse: 4200, traffic: 2.4, rent: 220 },
];

export const MAX_LEVEL = LEVELS.length;
export const levelDef = (level: number): LevelDef => LEVELS[Math.min(Math.max(level, 1), MAX_LEVEL) - 1];
