import type { CategoryId } from '../state/types';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  emoji: string;
  /** Teinte HSL de la pastille. */
  hue: number;
  /** Coût de la licence pour vendre cette catégorie (optionnel). */
  licence?: number;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'boul', name: 'Boulangerie', emoji: '🥖', hue: 38 },
  { id: 'lait', name: 'Produits laitiers', emoji: '🥛', hue: 205 },
  { id: 'fl', name: 'Fruits et légumes', emoji: '🍎', hue: 105 },
  { id: 'viande', name: 'Viandes et poissons', emoji: '🥩', hue: 2, licence: 150 },
  { id: 'epic', name: 'Épicerie', emoji: '🍝', hue: 50 },
  { id: 'pdj', name: 'Petit-déjeuner', emoji: '☕', hue: 24 },
  { id: 'boisson', name: 'Boissons', emoji: '🥤', hue: 188 },
  { id: 'snack', name: 'Snacks et confiserie', emoji: '🍫', hue: 335 },
  { id: 'surg', name: 'Surgelés', emoji: '🧊', hue: 222, licence: 200 },
  { id: 'hyg', name: 'Hygiène', emoji: '🧼', hue: 165 },
  { id: 'entr', name: 'Entretien maison', emoji: '🧽', hue: 262 },
  { id: 'bebe', name: 'Bébé', emoji: '🍼', hue: 305, licence: 60 },
  { id: 'anim', name: 'Animaux', emoji: '🐾', hue: 18, licence: 60 },
  { id: 'bazar', name: 'Bazar / saisonnier', emoji: '🎁', hue: 282 },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryDef>;
