// Campagnes publicitaires : un coût immédiat, un bonus d'affluence pendant quelques jours.
export interface CampaignDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  minLevel: number;
  /** Coût selon le niveau du magasin. */
  cost: (level: number) => number;
  days: number;
  /** Multiplicateur de clients potentiels pendant la campagne. */
  traffic: number;
  /** Points de réputation par jour (optionnel). */
  rep?: number;
}

const scaled = (base: number) => (level: number) => Math.round((base * (1 + 0.45 * (level - 1))) / 5) * 5;

export const CAMPAIGNS: CampaignDef[] = [
  { id: 'prospectus', name: 'Prospectus', emoji: '📰', minLevel: 1, cost: scaled(35), days: 3, traffic: 1.15,
    desc: 'Des prospectus dans les boîtes aux lettres du quartier.' },
  { id: 'degustation', name: 'Dégustation gratuite', emoji: '🧀', minLevel: 2, cost: scaled(50), days: 1, traffic: 1.12, rep: 1.5,
    desc: 'Un stand de dégustation à l’entrée : les clients adorent.' },
  { id: 'radio', name: 'Annonce radio locale', emoji: '📻', minLevel: 3, cost: scaled(120), days: 2, traffic: 1.3,
    desc: 'Un spot sur la radio du coin, matin et soir.' },
  { id: 'reseaux', name: 'Campagne réseaux sociaux', emoji: '📱', minLevel: 4, cost: scaled(150), days: 5, traffic: 1.18,
    desc: 'Des publicités ciblées pour les habitants du quartier.' },
];

export const CAMPAIGN_BY_ID = Object.fromEntries(CAMPAIGNS.map((c) => [c.id, c]));
