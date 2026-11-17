// Modèle de données du jeu. Tout l'état sauvegardé tient dans GameState (JSON pur).

export type CategoryId =
  | 'boul' | 'lait' | 'fl' | 'viande' | 'epic' | 'pdj' | 'boisson'
  | 'snack' | 'surg' | 'hyg' | 'entr' | 'bebe' | 'anim' | 'bazar';

export type Storage = 'ambient' | 'fridge' | 'freezer';

export interface Product {
  id: string;
  name: string;
  emoji: string;
  cat: CategoryId;
  /** Niveau de magasin requis. */
  level: number;
  /** Prix d'achat de référence (fournisseur standard). */
  cost: number;
  /** Prix du marché (référence client). */
  market: number;
  /** Demande de base : unités/jour pour un magasin de niveau 1, tous facteurs à 1. */
  base: number;
  elasticity: number;
  /** Volume occupé en rayon et en entrepôt, par unité. */
  size: number;
  essential: boolean;
  storage: Storage;
  /** Durée de vie en jours (jour de livraison inclus). Absent = non périssable. */
  shelfLife?: number;
  tags: string[];
  /** Identifiant d'objectif qui débloque ce produit (en plus du niveau). */
  unlockBy?: string;
}

export interface Batch { qty: number; exp: number | null; cost: number }
export interface Slot { productId: string | null; qty: number }
export interface OrderLine { productId: string; qty: number; unitCost: number }
export interface Order {
  id: number; supplierId: string; lines: OrderLine[];
  orderedDay: number; arrivalDay: number; total: number;
}
export interface CartLine { supplierId: string; productId: string; lots: number }
export interface ActiveEvent { id: string; startDay: number; endDay: number }
export interface Loan { remaining: number; daily: number; interestDaily: number }

export interface RepDetail { label: string; delta: number }
export interface ObjectiveDone { id: string; label: string; cash: number; xp: number; unlock?: string }

export interface DayReport {
  day: number;
  revenue: number;
  cogs: number;
  rent: number;
  electricity: number;
  salaries: number;
  waste: number;
  interest: number;
  /** Ventes manquées : articles voulus mais non vendus (rupture, prix trop élevé, file d'attente). */
  lostSales?: { stock: number; price: number; queue: number; value: number; top: { productId: string; units: number; value: number }[] };
  /** Revenus des succursales ce jour-là. */
  branchIncome?: number;
  /** Autres magasins gérés : résultat de leur journée (déjà compté dans le bénéfice net). */
  shops?: { id: string; manager: ShopEntry['manager']; revenue: number; profit: number; customers: number; repAfter?: number; disappointed?: number }[];
  /** Magasin détaillé dans ce bilan (le magasin affiché) et son bénéfice propre, avant succursales, prêt et autres magasins. */
  shopId?: string;
  shopProfit?: number;
  shopManager?: ShopEntry['manager'];
  profit: number;
  cashEnd: number;
  customersPotential: number;
  customersServed: number;
  disappointedStock: number;
  disappointedPrice: number;
  queueLost: number;
  unitsSold: number;
  stockouts: string[];
  essentialStockouts: string[];
  expired: { productId: string; qty: number; value: number }[];
  repBefore: number;
  repAfter: number;
  repDetails: RepDetail[];
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  objectivesDone: ObjectiveDone[];
  /** Éléments de façade gagnés pendant la journée. */
  decorUnlocked?: string[];
  sales: Record<string, { units: number; revenue: number }>;
  eventIds: string[];
  weather: string;
}

export interface BuyerReport { day: number; products: number; total: number; saved: number; skipped: number }
export interface Settings { speed: number; sound: boolean; dark: boolean; /** Animations du décor : auto (coupées sur écran tactile), complètes ou réduites. */ fx?: 'auto' | 'full' | 'reduced' }
/** Promotion sur un produit : −pct % sur le prix de vente, du jour startDay au jour endDay inclus. */
export interface Promo { productId: string; pct: number; startDay: number; endDay: number }
/** Campagne publicitaire en cours (prospectus, radio…). */
export interface Campaign { id: string; endDay: number }

/** Champs propres à chaque magasin géré (échangés quand on change de magasin). */
export const SHOP_KEYS = [
  'prices', 'stock', 'slots', 'orders', 'cart', 'upgrades', 'promos', 'campaigns',
  'history', 'salesHistory', 'demandHistory', 'productStats', 'buyer', 'reputation',
] as const;
export type ShopKey = (typeof SHOP_KEYS)[number];
export type ShopData = Pick<GameState, ShopKey>;

export interface ShopEntry {
  id: string;
  /** Gérant à qui la gestion est confiée (null : géré par le joueur). */
  manager: 'junior' | 'confirme' | 'expert' | null;
  /** Données du magasin quand il n'est pas affiché (null pour le magasin affiché : elles sont dans l'état). */
  data: ShopData | null;
  /** Résultat de la dernière journée (affiché dans la liste des magasins). */
  last?: { day: number; revenue: number; profit: number; customers: number };
}

export interface GameState {
  version: number;
  seed: number;
  day: number;
  phase: 'morning' | 'report';
  cash: number;
  reputation: number;
  xp: number;
  level: number;
  prices: Record<string, number>;
  stock: Record<string, Batch[]>;
  slots: Slot[];
  orders: Order[];
  nextOrderId: number;
  cart: CartLine[];
  upgrades: Record<string, number>;
  licences: CategoryId[];
  unlockedSpecial: string[];
  /** Jour à partir duquel chaque produit est devenu vendable (délai de grâce des essentiels). */
  sellableSince: Record<string, number>;
  events: ActiveEvent[];
  promos: Promo[];
  campaigns: Campaign[];
  loan: Loan | null;
  history: DayReport[];
  /** Unités vendues par jour (14 derniers jours). */
  salesHistory: Record<string, number[]>;
  /** Demande réelle (ventes + ruptures) par jour, sert au réassort. */
  demandHistory: Record<string, number[]>;
  productStats: Record<string, { units: number; revenue: number; cogs: number }>;
  objectives: {
    longDone: string[];
    daily: { day: number; ids: string[]; done: string[] };
    weekly: { week: number; ids: string[]; done: string[] };
    essentialStreak: number;
  };
  totals: {
    revenue: number; profit: number; customers: number; waste: number; bestProfit: number; ordersPlaced: number;
    promosLaunched: number; campaignsLaunched: number; noWasteStreak: number;
  };
  /** Façade : éléments gagnés, équipés, et déjà vus (badge « Nouveau »). */
  decor: { owned: string[]; equipped: Record<string, string>; seen: string[] };
  morningNews: string[];
  pendingLevelUps: number[];
  finalDone: boolean;
  tutorialOff: boolean;
  /** Roue de la fortune : dernier tour (horodatage réel) et bonus temporaires en cours. */
  wheel?: { lastSpin: number; boosts: { kind: 'traffic' | 'xp' | 'supplier' | 'price' | 'express' | 'rep'; value: number; untilDay: number }[] };
  /** Succursales achetées. */
  branches?: string[];
  /** Magasins gérés (absent tant qu'on n'a que le magasin principal). `active` = magasin affiché. */
  shops?: { active: number; list: ShopEntry[] };
  /** Acheteur automatique (amélioration « Responsable des achats »). */
  buyer?: { enabled: boolean; coverDays: number; reserve: number; last?: BuyerReport };
  /** Partie modifiée avec l'ancien mode debug (+€ / +XP, retiré) : exclue du classement mondial. */
  cheated?: boolean;
  lastReport: DayReport | null;
  settings: Settings;
}
