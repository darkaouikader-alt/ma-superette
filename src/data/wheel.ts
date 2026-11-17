// Roue de la fortune : un tour par heure (temps réel), récompenses instantanées ou temporaires.
export type BoostKind = 'traffic' | 'xp' | 'supplier' | 'price' | 'express' | 'rep';

export interface WheelPrize {
  id: string;
  label: string;
  short: string;
  emoji: string;
  color: string;
  /** Chance relative d'être tiré. */
  weight: number;
  /** Récompense instantanée : argent selon le niveau du magasin. */
  cash?: (level: number) => number;
  /** Bonus temporaire : type, valeur et durée en heures réelles. */
  boost?: { kind: BoostKind; value: number; hours: number };
  desc: string;
}

const smallPot = (level: number) => Math.round((40 + level * level * 18) / 5) * 5;

export const WHEEL_PRIZES: WheelPrize[] = [
  { id: 'cash', label: 'Petite cagnotte', short: 'Cagnotte', emoji: '💶', color: '#2fa36b', weight: 22, cash: smallPot,
    desc: 'Un peu d’argent versé tout de suite dans ta caisse.' },
  { id: 'traffic', label: 'Affluence +15 %', short: 'Affluence', emoji: '🧑‍🤝‍🧑', color: '#4dabf7', weight: 16,
    boost: { kind: 'traffic', value: 0.15, hours: 3 }, desc: '15 % de clients en plus pendant 3 heures.' },
  { id: 'xp', label: 'Expérience ×1,5', short: 'XP ×1,5', emoji: '⭐', color: '#8b5cf6', weight: 14,
    boost: { kind: 'xp', value: 0.5, hours: 2 }, desc: 'L’expérience gagnée en fin de journée est multipliée par 1,5 pendant 2 heures.' },
  { id: 'supplier', label: 'Fournisseurs −10 %', short: 'Achats −10%', emoji: '🏷️', color: '#ff9f43', weight: 14,
    boost: { kind: 'supplier', value: 0.1, hours: 4 }, desc: 'Tous les prix d’achat baissent de 10 % pendant 4 heures.' },
  { id: 'price', label: 'Clients généreux', short: 'Prix +8%', emoji: '😊', color: '#ef6f6c', weight: 12,
    boost: { kind: 'price', value: 0.08, hours: 3 }, desc: 'Les clients acceptent des prix 8 % plus élevés sans bouder, pendant 3 heures.' },
  { id: 'express', label: 'Livraison accélérée', short: 'Livr. rapide', emoji: '🚀', color: '#20c997', weight: 10,
    boost: { kind: 'express', value: 1, hours: 12 }, desc: 'Les commandes arrivent un jour plus tôt (minimum le lendemain) pendant 12 heures.' },
  { id: 'rep', label: 'Bouche-à-oreille', short: '+1 rép/jour', emoji: '🌟', color: '#e8a400', weight: 8,
    boost: { kind: 'rep', value: 1, hours: 48 }, desc: '+1 point de réputation à chaque fin de journée, pendant 2 jours.' },
  { id: 'jackpot', label: 'JACKPOT', short: 'Jackpot !', emoji: '💎', color: '#d6336c', weight: 4, cash: (level) => smallPot(level) * 6,
    desc: 'La grosse cagnotte, versée tout de suite !' },
];

export const WHEEL_COOLDOWN_MS = 60 * 60 * 1000;

export const BOOST_LABEL: Record<BoostKind, string> = {
  traffic: '🧑‍🤝‍🧑 +15 % de clients', xp: '⭐ Expérience ×1,5', supplier: '🏷️ Achats −10 %', price: '😊 Clients généreux',
  express: '🚀 Livraison accélérée', rep: '🌟 Bouche-à-oreille',
};
