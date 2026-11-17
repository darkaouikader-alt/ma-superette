import type { CategoryId } from '../state/types';

export interface EventDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** Durée en jours. */
  duration: number;
  /** Annoncé N jours à l'avance (0 = surprise du matin). */
  announce: number;
  /** Poids de tirage. */
  weight: number;
  minLevel?: number;
  /** Multiplicateurs de demande. */
  demand?: { all?: number; cats?: Partial<Record<CategoryId, number>>; tags?: Record<string, number> };
  /** Multiplicateur d'affluence. */
  traffic?: number;
  /** Multiplicateur du prix du marché (promo concurrente). */
  market?: number;
  /** Jours de délai ajoutés aux commandes passées pendant l'événement. */
  deliveryDelay?: number;
  /** Multiplicateur du prix d'achat fournisseur. */
  supplierCost?: number;
  /** Icône météo imposée. */
  weather?: string;
}

export const EVENTS: EventDef[] = [
  { id: 'canicule', name: 'Canicule', emoji: '🥵', duration: 3, announce: 1, weight: 3, weather: '🔥',
    desc: 'Il fait très chaud : boissons, glaces et produits rafraîchissants s’arrachent.',
    demand: { cats: { boisson: 1.5 }, tags: { froid: 1.6, chaud: 0.6 } }, traffic: 0.95 },
  { id: 'rentree', name: 'Rentrée scolaire', emoji: '🎒', duration: 3, announce: 2, weight: 2,
    desc: 'Les familles font le plein : goûters, céréales, fournitures.',
    demand: { cats: { pdj: 1.2 }, tags: { scolaire: 1.9 } }, traffic: 1.1 },
  { id: 'promo_concurrent', name: 'Promo chez le concurrent', emoji: '🏷️', duration: 2, announce: 0, weight: 3,
    desc: 'Le supermarché voisin casse ses prix : le prix du marché baisse de 12 %.',
    market: 0.88 },
  { id: 'greve', name: 'Grève des livraisons', emoji: '🚧', duration: 2, announce: 1, weight: 2,
    desc: 'Les commandes passées pendant la grève arrivent avec un jour de retard.',
    deliveryDelay: 1 },
  { id: 'fete', name: 'Fête locale', emoji: '🎉', duration: 1, announce: 2, weight: 3,
    desc: 'Le quartier est en fête : beaucoup de monde, apéro et barbecue à l’honneur.',
    demand: { cats: { boisson: 1.3, snack: 1.3 }, tags: { bbq: 1.5, apero: 1.3 } }, traffic: 1.35 },
  { id: 'hausse', name: 'Hausse des prix fournisseur', emoji: '📈', duration: 3, announce: 1, weight: 2,
    desc: 'Les fournisseurs augmentent leurs tarifs de 12 % pendant quelques jours.',
    supplierCost: 1.12 },
  { id: 'pluie', name: 'Pluies continues', emoji: '🌧️', duration: 2, announce: 1, weight: 3, weather: '🌧️',
    desc: 'Moins de passants dans la rue, mais les parapluies partent vite.',
    demand: { tags: { pluie: 4, chaud: 1.3 } }, traffic: 0.85 },
  { id: 'match', name: 'Soir de grand match', emoji: '⚽', duration: 1, announce: 1, weight: 3,
    desc: 'Tout le monde prépare l’apéro devant la télé.',
    demand: { cats: { snack: 1.5 }, tags: { apero: 1.6 } }, traffic: 1.1 },
  { id: 'froid', name: 'Vague de froid', emoji: '🥶', duration: 3, announce: 1, weight: 2, weather: '❄️',
    desc: 'Soupes, thé et café réchauffent les clients ; les boissons fraîches se vendent moins.',
    demand: { tags: { chaud: 1.7, froid: 0.7 } }, traffic: 0.95 },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Météo ordinaire (hors événement) : [icône, libellé, facteur d'affluence, poids]. */
export const WEATHERS: [string, string, number, number][] = [
  ['☀️', 'Ensoleillé', 1.04, 4],
  ['⛅', 'Nuageux', 1.0, 4],
  ['🌦️', 'Averses', 0.95, 2],
];
