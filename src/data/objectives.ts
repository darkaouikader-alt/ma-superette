// Objectifs. `metric` est évalué par systems/progression.ts (voir metricValue).
// `target` et `label` peuvent dépendre du niveau du magasin pour rester pertinents.
import { FINAL_GOAL } from './constants';

export type ObjectiveScope = 'daily' | 'weekly' | 'long';

export interface ObjectiveDef {
  id: string;
  scope: ObjectiveScope;
  emoji: string;
  metric: string;
  target: (level: number) => number;
  label: (target: number) => string;
  reward: { cash?: (level: number) => number; xp?: (level: number) => number; unlock?: string };
  minLevel?: number;
  final?: boolean;
}

const scale = (level: number) => [1, 1.6, 2.6, 4.5, 7.5, 11, 15, 20][Math.min(level, 8) - 1];
const round5 = (v: number) => Math.round(v / 5) * 5;
const cash = (base: number) => (l: number) => round5(base * Math.sqrt(scale(l)));
const xp = (base: number) => (l: number) => round5(base * scale(l));
const fixed = (v: number) => () => v;

export const OBJECTIVES: ObjectiveDef[] = [
  // ── Objectifs du jour (2 tirés chaque matin) ────────────────
  { id: 'd_profit', scope: 'daily', emoji: '💶', metric: 'profit', target: (l) => round5(30 * scale(l)),
    label: (t) => `${t} € de bénéfice aujourd'hui`, reward: { cash: cash(25), xp: xp(20) } },
  { id: 'd_revenue', scope: 'daily', emoji: '🧾', metric: 'revenue', target: (l) => round5(170 * scale(l)),
    label: (t) => `${t} € de chiffre d'affaires aujourd'hui`, reward: { cash: cash(20), xp: xp(20) } },
  { id: 'd_served', scope: 'daily', emoji: '🧑‍🤝‍🧑', metric: 'served', target: (l) => Math.round(26 * Math.pow(scale(l), 0.55)),
    label: (t) => `Servir ${t} clients aujourd'hui`, reward: { cash: cash(20), xp: xp(15) } },
  { id: 'd_noess', scope: 'daily', emoji: '✅', metric: 'noEssStockout', target: fixed(1),
    label: () => 'Aucune rupture sur les essentiels aujourd\'hui', reward: { cash: cash(20), xp: xp(25) } },
  { id: 'd_nowaste', scope: 'daily', emoji: '♻️', metric: 'noWaste', target: fixed(1),
    label: () => 'Ne jeter aucun produit périmé aujourd\'hui', reward: { cash: cash(15), xp: xp(15) } },
  { id: 'd_happy', scope: 'daily', emoji: '😊', metric: 'fewDisappointed', target: fixed(1),
    label: () => 'Moins de 10 % de clients déçus aujourd\'hui', reward: { cash: cash(20), xp: xp(20) } },

  // ── Objectifs de la semaine (2 tirés chaque lundi) ──────────
  { id: 'w_revenue', scope: 'weekly', emoji: '📈', metric: 'weekRevenue', target: (l) => round5(1300 * scale(l)),
    label: (t) => `${t} € de chiffre d'affaires cette semaine`, reward: { cash: cash(80), xp: xp(80) } },
  { id: 'w_profit', scope: 'weekly', emoji: '💰', metric: 'weekProfit', target: (l) => round5(260 * scale(l)),
    label: (t) => `${t} € de bénéfice cette semaine`, reward: { cash: cash(90), xp: xp(80) } },
  { id: 'w_streak', scope: 'weekly', emoji: '🛡️', metric: 'essStreak', target: fixed(3),
    label: () => 'Zéro rupture sur les essentiels pendant 3 jours de suite', reward: { cash: cash(70), xp: xp(90) } },
  { id: 'w_served', scope: 'weekly', emoji: '🚶', metric: 'weekServed', target: (l) => Math.round(200 * Math.pow(scale(l), 0.55)),
    label: (t) => `Servir ${t} clients cette semaine`, reward: { cash: cash(70), xp: xp(70) } },

  // ── Objectifs à long terme ──────────────────────────────────
  { id: 'first_order', scope: 'long', emoji: '🚚', metric: 'ordersPlaced', target: fixed(1),
    label: () => 'Passer une première commande fournisseur', reward: { cash: fixed(30), xp: fixed(20) } },
  { id: 'profit100', scope: 'long', emoji: '💶', metric: 'bestProfit', target: fixed(100),
    label: () => '100 € de bénéfice en une journée', reward: { cash: fixed(60), xp: fixed(80) } },
  { id: 'fridge1', scope: 'long', emoji: '🧊', metric: 'upgrade:fridge', target: fixed(1),
    label: () => 'Installer un premier réfrigérateur', reward: { cash: fixed(50), xp: fixed(60) }, minLevel: 2 },
  { id: 'rep30', scope: 'long', emoji: '⭐', metric: 'reputation', target: fixed(30),
    label: () => 'Atteindre 30 de réputation', reward: { cash: fixed(80), xp: fixed(100) } },
  { id: 'rep60', scope: 'long', emoji: '🌟', metric: 'reputation', target: fixed(60),
    label: () => 'Atteindre 60 de réputation', reward: { cash: fixed(200), xp: fixed(300), unlock: 'champagne' } },
  { id: 'rep80', scope: 'long', emoji: '🏅', metric: 'reputation', target: fixed(80),
    label: () => 'Atteindre 80 de réputation', reward: { cash: fixed(500), xp: fixed(800) } },
  { id: 'team', scope: 'long', emoji: '🧑‍💼', metric: 'employees', target: fixed(2),
    label: () => 'Embaucher un caissier et un employé de rayon', reward: { cash: fixed(100), xp: fixed(150) }, minLevel: 2 },
  { id: 'viande', scope: 'long', emoji: '🥩', metric: 'licence:viande', target: fixed(1),
    label: () => 'Ouvrir le rayon Viandes et poissons', reward: { cash: fixed(120), xp: fixed(200) }, minLevel: 4 },
  { id: 'surgeles', scope: 'long', emoji: '❄️', metric: 'licence:surg', target: fixed(1),
    label: () => 'Débloquer les surgelés', reward: { cash: fixed(200), xp: fixed(400) }, minLevel: 5 },
  { id: 'assort40', scope: 'long', emoji: '🛒', metric: 'assortment', target: fixed(40),
    label: () => 'Proposer 40 produits différents en rayon', reward: { cash: fixed(300), xp: fixed(400) }, minLevel: 3 },
  { id: 'cash2k', scope: 'long', emoji: '🏦', metric: 'cash', target: fixed(2000),
    label: () => '2 000 € de trésorerie', reward: { xp: fixed(200) } },
  { id: 'cash10k', scope: 'long', emoji: '💎', metric: 'cash', target: fixed(10000),
    label: () => '10 000 € de trésorerie', reward: { xp: fixed(1000), unlock: 'panier_garni' } },
  { id: 'final', scope: 'long', emoji: '🏆', metric: 'final', target: fixed(1), final: true,
    label: () => `Objectif final : devenir un Mini-marché avec ${FINAL_GOAL.cash.toLocaleString('fr-FR')} € de trésorerie`,
    reward: { xp: fixed(5000) } },
];

export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o]));
