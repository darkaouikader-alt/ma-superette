// État d'interface (non sauvegardé) : écran courant, filtres, tris.
export type ScreenId = 'dashboard' | 'shelves' | 'prices' | 'orders' | 'stock' | 'upgrades' | 'decor' | 'stats' | 'settings';

export const ui = {
  screen: 'dashboard' as ScreenId,
  /** true juste après une navigation (pour l'animation d'entrée). */
  entering: true,
  price: { cat: 'all', essential: false, rupture: false, sort: 'cat', dir: 1, bulkCat: 'all', bulkPct: 5 },
  supplier: 'dupont',
  /** Panier ouvert (feuille du bas sur mobile). */
  cartOpen: false,
  decorSlot: 'facade',
  /** Élément affiché en aperçu sur la façade (non équipé). */
  decorPreview: null as string | null,
  priceTab: 'prices' as 'prices' | 'promos',
  promoPct: 20,
  promoDays: 3,
  orderCat: 'all',
  stockSort: 'days',
  statsTab: 'days' as 'days' | 'best' | 'margins',
  objTab: 'daily' as 'daily' | 'weekly' | 'long',
  pickerSlot: -1,
  simRunning: false,
  debug: false,
};
