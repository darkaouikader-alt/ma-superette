import type { CategoryId } from '../state/types';

export interface SupplierDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  categories: CategoryId[];
  /** Délai de livraison en jours (1 = le lendemain matin). */
  delay: number;
  /** Unités par lot (quantité minimale de commande). */
  lotSize: number;
  /** Multiplicateur appliqué au prix d'achat de référence. */
  priceFactor: number;
  /** Remise accordée à partir de N lots d'un même produit. */
  discountLots: number;
  discountPct: number;
}

const SEC: CategoryId[] = ['epic', 'pdj', 'boisson', 'snack', 'hyg', 'entr', 'bebe', 'anim', 'bazar'];
const FRAIS: CategoryId[] = ['boul', 'lait', 'fl', 'viande'];

export const SUPPLIERS: SupplierDef[] = [
  {
    id: 'dupont', name: 'Grossiste Dupont', emoji: '🚚',
    desc: 'Généraliste fiable. Livre tout le sec dès le lendemain.',
    categories: [...SEC, 'lait', 'boul'], delay: 1, lotSize: 6, priceFactor: 1.0, discountLots: 5, discountPct: 0.05,
  },
  {
    id: 'fraicheur', name: 'Fraîcheur Express', emoji: '🥬',
    desc: 'Produits frais livrés chaque matin, petits lots.',
    categories: FRAIS, delay: 1, lotSize: 4, priceFactor: 1.0, discountLots: 6, discountPct: 0.04,
  },
  {
    id: 'discount', name: 'Cash Éco', emoji: '🏭',
    desc: 'Prix cassés, gros lots, mais 3 jours de délai.',
    categories: SEC, delay: 3, lotSize: 12, priceFactor: 0.88, discountLots: 4, discountPct: 0.06,
  },
  {
    id: 'terroir', name: 'Ferme & Terroir', emoji: '🚜',
    desc: 'Frais en direct des producteurs, moins cher, 2 jours.',
    categories: FRAIS, delay: 2, lotSize: 8, priceFactor: 0.91, discountLots: 4, discountPct: 0.05,
  },
  {
    id: 'givre', name: 'Givré Surgelés', emoji: '❄️',
    desc: 'Camion frigorifique, livraison en 2 jours.',
    categories: ['surg'], delay: 2, lotSize: 6, priceFactor: 1.0, discountLots: 4, discountPct: 0.06,
  },
];

export const SUPPLIER_BY_ID = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));
