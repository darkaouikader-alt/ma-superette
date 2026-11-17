// ────────────────────────────────────────────────────────────────
//  ÉQUILIBRAGE — toutes les constantes du jeu sont ici.
//  Modifie ces valeurs pour ajuster la difficulté sans toucher au code.
// ────────────────────────────────────────────────────────────────
import type { CategoryId } from '../state/types';

export const SAVE_KEY = 'ma-superette-save-v1';
export const SAVE_VERSION = 1;

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const BALANCE = {
  // Départ
  START_CASH: 500,
  START_REPUTATION: 0,
  /** Jours de ventes offerts dans le kit de démarrage. */
  STARTER_KIT_DAYS: 1.3,

  // Rayons
  /** Volume d'un emplacement de rayon (unités × taille). */
  SLOT_VOLUME: 40,
  /** Emplacements réfrigérés / surgelés ajoutés par niveau d'équipement. */
  COLD_SLOTS_PER_LEVEL: 4,
  SHELF_UPGRADE_SLOTS: 4,
  WAREHOUSE_UPGRADE_VOLUME: 300,

  // Demande
  /** Multiplicateur global de la demande (levier principal de difficulté). */
  DEMAND_SCALE: 1.25,
  ESSENTIAL_WEIGHT: 1.2,
  DEMAND_NOISE: 0.1,
  PRICE_FACTOR_MIN: 0,
  PRICE_FACTOR_MAX: 2,
  /** Au-delà de ce ratio prix/marché, les clients fuient (chute linéaire jusqu'à 0). */
  ABUSE_RATIO_START: 1.5,
  ABUSE_RATIO_END: 2.0,
  REP_FACTOR_AT_0: 0.75,
  REP_FACTOR_AT_100: 1.5,
  /** Clients potentiels par jour, magasin niveau 1, tous facteurs à 1. */
  BASE_CUSTOMERS: 55,
  /** Lundi → dimanche. */
  WEEKDAY_FACTORS: [0.8, 0.9, 0.95, 1.0, 1.1, 1.35, 1.2],
  /** Variations par catégorie et par jour (index 0 = lundi). */
  CATEGORY_WEEKDAY: {
    boisson: { 4: 1.1, 5: 1.25 },
    viande: { 5: 1.25, 6: 1.15 },
    boul: { 5: 1.1, 6: 1.3 },
    snack: { 2: 1.1, 4: 1.15, 5: 1.2 },
    fl: { 5: 1.15, 6: 1.1 },
    surg: { 4: 1.15 },
    entr: { 0: 1.15 },
  } as Partial<Record<CategoryId, Record<number, number>>>,
  /** Variations par étiquette produit (barbecue le samedi, apéro en fin de semaine…). */
  TAG_WEEKDAY: {
    bbq: { 5: 1.5, 6: 1.25 },
    apero: { 4: 1.25, 5: 1.35 },
  } as Record<string, Record<number, number>>,

  /** Jours de grâce avant que les clients n'exigent un essentiel nouvellement débloqué. */
  ESSENTIAL_GRACE_DAYS: 2,

  // Affluence
  /** Image prix : au-delà de ce ratio moyen prix/marché, des clients boudent le magasin. */
  PRICE_IMAGE_START: 1.1,
  /** Part de clients perdue par point de ratio au-delà du seuil (1,3 → −40 %). */
  PRICE_IMAGE_SLOPE: 2,
  PRICE_IMAGE_MIN: 0.4,
  /** Clients encaissables par jour selon le niveau de caissier (0 = le gérant seul). */
  CHECKOUT_CAPACITY: [70, 130, 220, 340, 520],
  SIGN_TRAFFIC: 0.04,
  BILLBOARD_TRAFFIC: 0.08,
  /** L'employé de rayon regarnit les rayons à ces moments de la journée (0..1). */
  STOCKER_REFILLS: [0.3, 0.55, 0.8],

  // Charges
  ELECTRICITY_BASE: 4,
  ELECTRICITY_PER_SLOT: 0.1,
  ELECTRICITY_PER_FRIDGE: 2.5,
  ELECTRICITY_PER_FREEZER: 4,

  // Prêt d'urgence
  LOAN_TRIGGER_CASH: 40,
  LOAN_BASE: 300,
  LOAN_PER_LEVEL: 150,
  LOAN_INTEREST: 0.15,
  LOAN_DAYS: 10,
  /** Nombre maximal de prêts cumulés. */
  LOAN_MAX_STACK: 3,

  // Prix
  VERDICT_CHEAP: 0.93,
  VERDICT_FAIR: 1.08,
  VERDICT_HIGH: 1.25,

  // Réputation (points par jour)
  REP_ESS_FULL: 2.5,      // essentiels tous servis
  REP_ESS_WORST: -4,      // ≤ 50 % des essentiels servis
  /** Courbe « niveau de prix moyen → points » (interpolation linéaire). */
  REP_PRICE_CURVE: [[0.9, 1.5], [1.0, 1.0], [1.1, 0], [1.2, -2], [1.3, -4], [1.6, -7]] as [number, number][],
  REP_NO_WASTE: 0.3,
  REP_WASTE_MAX: -1.5,
  REP_EMPTY_TOLERANCE: 0.35,
  REP_EMPTY_MAX: -2,
  REP_QUEUE_MAX: -2,
  REP_MISSING_NONESS_MAX: -1,
  REP_DECO_DAILY: 0.3,
  REP_SIGN_INSTANT: 3,
  REP_DECO_INSTANT: 2,
  /** Les gains sont freinés quand la réputation est haute : gain × (1 − rép/REP_DAMPING). */
  REP_DAMPING: 135,

  // Progression
  XP_PER_EURO: 1,
  XP_PER_REP_POINT: 0.5,

  // Événements
  EVENT_FIRST_DAY: 4,
  EVENT_DAILY_CHANCE: 0.3,

  // Promotions
  /** Réductions proposées (%). */
  PROMO_PCTS: [10, 20, 30, 40],
  /** Durées proposées (jours). */
  PROMO_DAYS: [1, 3, 7],
  /** Bonus de visibilité : un produit en promo est davantage demandé (en plus de l'effet prix). */
  PROMO_VISIBILITY: 0.3,
  /** Clients supplémentaires attirés par chaque produit en promo… */
  PROMO_TRAFFIC_EACH: 0.03,
  /** … dans la limite de ce bonus total. */
  PROMO_TRAFFIC_MAX: 0.15,
  /** Nombre de promos simultanées : base + 1 tous les 2 niveaux. */
  PROMO_SLOTS_BASE: 2,
  /** Réputation par jour quand au moins un essentiel est en promo. */
  PROMO_REP_ESSENTIAL: 0.4,

  // Réassort automatique
  REORDER_COVER_DAYS: 2,
  REORDER_SAFETY: 1.15,

  // Simulation animée
  SIM_DURATION_MS: 8000,
  HISTORY_DAYS: 60,
};

/** Objectif final (fin de partie « soft »). */
export const FINAL_GOAL = { level: 5, cash: 50000 };
