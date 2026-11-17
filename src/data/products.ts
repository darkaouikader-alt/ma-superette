// Catalogue produits. Pour ajouter un produit : une ligne P(...) suffit (voir README).
import type { CategoryId, Product, Storage } from '../state/types';

interface Opt {
  size?: number;
  essential?: boolean;
  storage?: Storage;
  shelfLife?: number;
  tags?: string[];
  unlockBy?: string;
}

/** P(id, nom, emoji, catégorie, niveau, prix d'achat, prix du marché, demande de base, élasticité, options) */
function P(
  id: string, name: string, emoji: string, cat: CategoryId, level: number,
  cost: number, market: number, base: number, elasticity: number, o: Opt = {},
): Product {
  return {
    id, name, emoji, cat, level, cost, market, base, elasticity,
    size: o.size ?? 1,
    essential: !!o.essential,
    storage: o.storage ?? 'ambient',
    shelfLife: o.shelfLife,
    tags: o.tags ?? [],
    unlockBy: o.unlockBy,
  };
}

const E = { essential: true };
const frigo = (shelfLife: number, extra: Opt = {}): Opt => ({ storage: 'fridge', shelfLife, ...extra });
const congel = (extra: Opt = {}): Opt => ({ storage: 'freezer', ...extra });

export const PRODUCTS: Product[] = [
  // ── Boulangerie ─────────────────────────────────────────────
  P('baguette', 'Baguette', '🥖', 'boul', 1, 0.85, 1.10, 30, 0.5, { ...E, shelfLife: 2 }),
  P('pain_mie', 'Pain de mie', '🍞', 'boul', 2, 1.30, 1.70, 10, 0.7, { ...E, shelfLife: 6, size: 2 }),
  P('croissants', 'Croissants x4', '🥐', 'boul', 2, 1.55, 2.60, 8, 1.5, { shelfLife: 2 }),
  P('brioche', 'Brioche tressée', '🥯', 'boul', 3, 1.80, 3.10, 5, 1.6, { shelfLife: 5, size: 2 }),
  P('pain_campagne', 'Pain de campagne', '🫓', 'boul', 3, 1.50, 2.40, 6, 1.2, { shelfLife: 3, size: 2 }),
  P('tartelette', 'Tartelettes aux fruits', '🥧', 'boul', 4, 1.90, 3.60, 4, 2.0, { shelfLife: 2 }),

  // ── Produits laitiers ───────────────────────────────────────
  P('lait_uht', 'Lait UHT 1 L', '🥛', 'lait', 1, 0.90, 1.15, 16, 0.6, { ...E, size: 2 }),
  P('oeufs', 'Œufs x6', '🥚', 'lait', 1, 1.70, 2.20, 10, 0.6, { ...E, shelfLife: 14, size: 2 }),
  P('beurre', 'Beurre doux', '🧈', 'lait', 2, 2.00, 2.60, 9, 0.7, frigo(20, E)),
  P('yaourt', 'Yaourts nature x4', '🥣', 'lait', 2, 1.25, 1.60, 9, 0.8, frigo(10, { ...E, size: 2 })),
  P('emmental', 'Emmental râpé', '🧀', 'lait', 2, 1.55, 2.30, 7, 1.0, frigo(14)),
  P('creme', 'Crème fraîche', '🍶', 'lait', 3, 1.05, 1.60, 5, 1.0, frigo(10)),
  P('camembert', 'Camembert', '🫕', 'lait', 3, 1.80, 2.90, 5, 1.3, frigo(12)),
  P('dessert', 'Crèmes dessert x4', '🍮', 'lait', 3, 1.35, 2.40, 6, 1.6, frigo(12, { size: 2 })),
  P('lait_frais', 'Lait frais bio', '🐄', 'lait', 4, 1.25, 1.95, 5, 1.4, frigo(5, { size: 2 })),

  // ── Fruits et légumes ───────────────────────────────────────
  P('pommes', 'Pommes 1 kg', '🍎', 'fl', 3, 1.85, 2.40, 9, 0.8, { ...E, shelfLife: 7, size: 2 }),
  P('bananes', 'Bananes 1 kg', '🍌', 'fl', 3, 1.45, 1.90, 9, 0.8, { ...E, shelfLife: 5, size: 2 }),
  P('tomates', 'Tomates 1 kg', '🍅', 'fl', 3, 2.00, 2.90, 8, 0.9, { shelfLife: 5, size: 2 }),
  P('salade', 'Salade', '🥬', 'fl', 3, 0.80, 1.20, 7, 0.9, { shelfLife: 3, size: 2 }),
  P('carottes', 'Carottes 1 kg', '🥕', 'fl', 3, 1.15, 1.50, 6, 0.7, { ...E, shelfLife: 9, size: 2 }),
  P('pdt', 'Pommes de terre 2 kg', '🥔', 'fl', 3, 1.75, 2.30, 7, 0.6, { ...E, shelfLife: 12, size: 3 }),
  P('oranges', 'Oranges 1 kg', '🍊', 'fl', 4, 1.60, 2.50, 6, 1.0, { shelfLife: 8, size: 2 }),
  P('fraises', 'Fraises 250 g', '🍓', 'fl', 4, 1.90, 3.50, 5, 1.9, { shelfLife: 3 }),
  P('avocats', 'Avocats x2', '🥑', 'fl', 5, 1.50, 2.80, 5, 1.8, { shelfLife: 5 }),
  P('pasteque', 'Pastèque', '🍉', 'fl', 5, 2.10, 3.90, 4, 1.8, { shelfLife: 6, size: 3, tags: ['froid'] }),

  // ── Viandes et poissons (licence + réfrigérateur) ───────────
  P('poulet', 'Blanc de poulet', '🍗', 'viande', 4, 4.00, 5.20, 7, 0.8, frigo(4, E)),
  P('steak', 'Steaks hachés x2', '🥩', 'viande', 4, 3.15, 4.10, 7, 0.8, frigo(4, E)),
  P('jambon', 'Jambon blanc x4', '🥓', 'viande', 4, 2.25, 2.90, 9, 0.8, frigo(8, E)),
  P('saucisses', 'Saucisses barbecue', '🌭', 'viande', 4, 2.60, 4.20, 5, 1.5, frigo(5, { tags: ['bbq'] })),
  P('saumon', 'Pavé de saumon', '🐟', 'viande', 5, 4.20, 7.20, 4, 1.8, frigo(3)),
  P('crevettes', 'Crevettes', '🦐', 'viande', 6, 3.60, 6.50, 4, 2.0, frigo(3, { tags: ['apero'] })),
  P('entrecote', 'Entrecôte', '🍖', 'viande', 7, 6.20, 11.50, 3, 2.2, frigo(4, { tags: ['bbq'] })),

  // ── Épicerie ────────────────────────────────────────────────
  P('pates', 'Pâtes 500 g', '🍝', 'epic', 1, 0.92, 1.20, 12, 0.6, E),
  P('riz', 'Riz 1 kg', '🍚', 'epic', 1, 1.45, 1.90, 8, 0.6, E),
  P('farine', 'Farine 1 kg', '🌾', 'epic', 2, 0.78, 1.00, 6, 0.6, E),
  P('sucre', 'Sucre 1 kg', '🧂', 'epic', 2, 1.08, 1.40, 6, 0.6, E),
  P('huile', 'Huile de tournesol', '🫗', 'epic', 2, 1.85, 2.40, 5, 0.7, { ...E, size: 2 }),
  P('sauce_tomate', 'Sauce tomate', '🥫', 'epic', 2, 0.95, 1.50, 8, 1.0),
  P('haricots', 'Haricots verts (conserve)', '🫛', 'epic', 3, 0.85, 1.30, 6, 0.9),
  P('thon', 'Thon en boîte', '🐠', 'epic', 3, 1.40, 2.20, 6, 1.1),
  P('soupe', 'Soupe en brique', '🍲', 'epic', 4, 1.30, 2.10, 5, 1.2, { size: 2, tags: ['chaud'] }),
  P('huile_olive', "Huile d'olive extra", '🫒', 'epic', 5, 4.10, 7.50, 4, 1.8, { size: 2 }),
  P('epices', "Coffret d'épices", '🌶️', 'epic', 6, 2.60, 5.20, 3, 2.0),

  // ── Petit-déjeuner ──────────────────────────────────────────
  P('cafe', 'Café moulu', '☕', 'pdj', 1, 2.50, 3.60, 6, 1.0, { tags: ['chaud'] }),
  P('biscottes', 'Biscottes', '🍘', 'pdj', 2, 1.00, 1.50, 5, 0.9, { size: 2 }),
  P('cereales', 'Céréales', '🥣', 'pdj', 2, 1.90, 3.00, 7, 1.3, { size: 2, tags: ['scolaire'] }),
  P('confiture', 'Confiture de fraise', '🍯', 'pdj', 2, 1.40, 2.30, 5, 1.4),
  P('the', 'Thé vert', '🍵', 'pdj', 3, 1.45, 2.60, 4, 1.5, { tags: ['chaud'] }),
  P('pate_tartiner', 'Pâte à tartiner', '🌰', 'pdj', 3, 2.20, 3.80, 6, 1.6, { tags: ['scolaire'] }),
  P('miel', 'Miel de fleurs', '🐝', 'pdj', 4, 2.90, 5.20, 3, 1.8),

  // ── Boissons ────────────────────────────────────────────────
  P('eau', 'Eau 6 × 1,5 L', '💧', 'boisson', 1, 1.85, 2.40, 14, 0.5, { ...E, size: 3, tags: ['froid'] }),
  P('cola', 'Cola 1,5 L', '🥤', 'boisson', 1, 1.20, 1.90, 10, 1.5, { size: 2, tags: ['froid', 'apero'] }),
  P('jus', "Jus d'orange 1 L", '🧃', 'boisson', 2, 1.35, 2.20, 8, 1.3, { size: 2, tags: ['scolaire'] }),
  P('eau_gaz', 'Eau pétillante', '🫧', 'boisson', 3, 0.62, 1.00, 7, 1.0, { size: 2, tags: ['froid'] }),
  P('limonade', 'Limonade artisanale', '🍋', 'boisson', 3, 1.25, 2.40, 5, 1.7, { size: 2, tags: ['froid'] }),
  P('the_glace', 'Thé glacé', '🧋', 'boisson', 3, 1.05, 1.90, 6, 1.6, { size: 2, tags: ['froid'] }),
  P('biere', 'Bières x6', '🍺', 'boisson', 4, 3.30, 5.60, 6, 1.6, { size: 3, tags: ['bbq', 'apero'] }),
  P('energy', 'Boisson énergisante', '⚡', 'boisson', 4, 0.95, 1.90, 5, 1.8),
  P('vin', 'Vin rouge', '🍷', 'boisson', 5, 3.60, 6.90, 5, 1.9, { size: 2, tags: ['apero'] }),
  P('champagne', 'Champagne', '🍾', 'boisson', 5, 14.00, 27.00, 2, 2.4, { size: 2, unlockBy: 'rep60' }),
  P('smoothie', 'Smoothie premium', '🍹', 'boisson', 7, 1.85, 3.60, 5, 2.2, frigo(6, { tags: ['froid'] })),

  // ── Snacks et confiserie ────────────────────────────────────
  P('chips', 'Chips nature', '🍟', 'snack', 1, 1.05, 1.80, 8, 1.6, { size: 2, tags: ['apero', 'bbq'] }),
  P('chocolat', 'Tablette de chocolat', '🍫', 'snack', 1, 1.20, 2.00, 7, 1.6),
  P('bonbons', 'Bonbons', '🍬', 'snack', 2, 0.95, 1.80, 6, 1.9),
  P('biscuits', 'Biscuits fourrés', '🍪', 'snack', 2, 1.05, 1.80, 7, 1.5, { tags: ['scolaire'] }),
  P('cacahuetes', 'Cacahuètes', '🥜', 'snack', 3, 1.15, 2.10, 5, 1.7, { tags: ['apero'] }),
  P('sucettes', 'Sucettes', '🍭', 'snack', 3, 0.85, 1.70, 4, 2.0),
  P('barres', 'Barres de céréales', '🍡', 'snack', 3, 1.35, 2.40, 5, 1.6, { tags: ['scolaire'] }),
  P('popcorn', 'Pop-corn', '🍿', 'snack', 4, 0.95, 1.90, 4, 1.9, { size: 2, tags: ['apero'] }),
  P('chocolats_fins', 'Chocolats fins', '🎀', 'snack', 6, 4.90, 9.50, 3, 2.4),

  // ── Surgelés (licence + congélateur) ────────────────────────
  P('legumes_surg', 'Légumes surgelés', '🥦', 'surg', 5, 1.55, 2.00, 7, 0.7, congel({ ...E, size: 2 })),
  P('frites', 'Frites surgelées', '🧊', 'surg', 5, 1.50, 1.95, 7, 0.8, congel({ ...E, size: 2 })),
  P('pizza', 'Pizza surgelée', '🍕', 'surg', 5, 1.90, 3.20, 7, 1.3, congel({ size: 2 })),
  P('poisson_pane', 'Poisson pané', '🐡', 'surg', 5, 2.30, 3.70, 5, 1.2, congel({ size: 2 })),
  P('glace', 'Crème glacée', '🍨', 'surg', 5, 2.10, 3.80, 5, 1.8, congel({ size: 2, tags: ['froid'] })),
  P('esquimaux', 'Bâtonnets glacés x6', '🍦', 'surg', 6, 2.30, 4.30, 4, 2.0, congel({ size: 2, tags: ['froid'] })),
  P('plat_cuisine', 'Plat cuisiné surgelé', '🍱', 'surg', 6, 2.50, 4.40, 5, 1.6, congel({ size: 2 })),

  // ── Hygiène ─────────────────────────────────────────────────
  P('pq', 'Papier toilette x6', '🧻', 'hyg', 1, 2.70, 3.50, 6, 0.5, { ...E, size: 3 }),
  P('savon', 'Gel douche', '🧼', 'hyg', 2, 1.35, 1.75, 5, 0.7, E),
  P('dentifrice', 'Dentifrice', '🪥', 'hyg', 2, 1.45, 1.90, 5, 0.7, E),
  P('shampoing', 'Shampoing', '🧴', 'hyg', 3, 1.95, 3.20, 4, 1.2),
  P('mouchoirs', 'Mouchoirs', '🤧', 'hyg', 3, 0.95, 1.40, 5, 0.8, { size: 2 }),
  P('deodorant', 'Déodorant', '💨', 'hyg', 4, 1.90, 3.40, 4, 1.5),
  P('rasoirs', 'Rasoirs x4', '🪒', 'hyg', 5, 2.60, 4.90, 3, 1.6),
  P('parfum', 'Eau de toilette', '🌸', 'hyg', 7, 7.80, 15.00, 2, 2.3),

  // ── Entretien maison ────────────────────────────────────────
  P('lessive', 'Lessive', '🧺', 'entr', 4, 4.30, 5.60, 5, 0.7, { ...E, size: 3 }),
  P('vaisselle', 'Liquide vaisselle', '🍽️', 'entr', 4, 1.22, 1.60, 5, 0.7, E),
  P('sacs_poubelle', 'Sacs poubelle', '🗑️', 'entr', 4, 1.45, 1.90, 5, 0.6, E),
  P('eponges', 'Éponges x3', '🧽', 'entr', 4, 0.85, 1.50, 4, 1.1),
  P('nettoyant', 'Nettoyant multi-usages', '🧹', 'entr', 4, 1.55, 2.70, 4, 1.3, { size: 2 }),
  P('bougie', 'Bougie parfumée', '🕯️', 'entr', 6, 2.85, 5.50, 3, 2.2),

  // ── Bébé (licence) ──────────────────────────────────────────
  P('couches', 'Couches x30', '👶', 'bebe', 5, 6.90, 8.90, 4, 0.6, { ...E, size: 3 }),
  P('lait_bebe', 'Lait infantile', '🍼', 'bebe', 5, 8.50, 11.00, 3, 0.5, { ...E, size: 2 }),
  P('petits_pots', 'Petits pots x2', '🥄', 'bebe', 5, 1.25, 2.00, 5, 1.0),
  P('lingettes', 'Lingettes bébé', '🧷', 'bebe', 5, 1.15, 1.90, 4, 1.1),

  // ── Animaux (licence) ───────────────────────────────────────
  P('croq_chat', 'Croquettes chat', '🐈', 'anim', 6, 3.15, 4.10, 5, 0.7, { ...E, size: 3 }),
  P('croq_chien', 'Croquettes chien', '🐕', 'anim', 6, 4.15, 5.40, 4, 0.7, { ...E, size: 3 }),
  P('litiere', 'Litière', '🪨', 'anim', 6, 2.30, 3.50, 4, 0.9, { size: 3 }),
  P('friandises', 'Friandises animaux', '🦴', 'anim', 6, 1.45, 2.80, 4, 1.9),

  // ── Bazar / saisonnier ──────────────────────────────────────
  P('piles', 'Piles x4', '🔋', 'bazar', 6, 2.00, 3.90, 4, 1.4),
  P('cahiers', 'Cahiers et stylos', '📓', 'bazar', 6, 1.55, 3.00, 3, 1.5, { tags: ['scolaire'] }),
  P('charbon', 'Charbon de bois', '🔥', 'bazar', 6, 3.10, 5.50, 3, 1.5, { size: 3, tags: ['bbq'] }),
  P('ampoules', 'Ampoules LED', '💡', 'bazar', 6, 1.90, 3.50, 3, 1.2),
  P('parapluie', 'Parapluie', '☂️', 'bazar', 6, 4.40, 8.50, 1.5, 2.0, { size: 2, tags: ['pluie'] }),
  P('creme_solaire', 'Crème solaire', '🏖️', 'bazar', 6, 4.10, 8.00, 2, 1.8, { tags: ['froid'] }),
  P('jouet', 'Petit jouet', '🧸', 'bazar', 7, 3.35, 6.50, 3, 2.0),
  P('fleurs', 'Bouquet de fleurs', '💐', 'bazar', 7, 4.40, 8.50, 3, 2.1, { shelfLife: 4, size: 2 }),
  P('panier_garni', 'Panier garni du terroir', '🧺', 'bazar', 5, 13.00, 25.00, 1.5, 2.3, { size: 3, unlockBy: 'cash10k' }),
];

export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
