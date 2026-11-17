export interface UpgradeDef {
  id: string;
  name: string;
  emoji: string;
  group: 'Espace' | 'Froid' | 'Image' | 'Équipe' | 'Logistique';
  desc: string;
  /** Effet affiché pour chaque niveau acheté. */
  effect: string;
  minLevel: number;
  /** Coût de chaque niveau successif. */
  costs: number[];
  /** Salaire quotidien par niveau (employés). */
  salary?: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'shelves', name: 'Rayons supplémentaires', emoji: '🗄️', group: 'Espace', minLevel: 1,
    desc: 'Installe de nouvelles étagères dans le magasin.', effect: '+4 emplacements de rayon',
    costs: [120, 250, 500, 900, 1500, 2400, 3800, 5500, 8000, 11000, 15000, 20000] },
  { id: 'warehouse', name: 'Entrepôt agrandi', emoji: '📦', group: 'Espace', minLevel: 1,
    desc: 'Plus de place en réserve pour commander en gros.', effect: '+300 de volume en entrepôt',
    costs: [100, 220, 450, 800, 1400, 2200, 3500, 5000, 7500, 10000, 14000, 19000] },
  { id: 'fridge', name: 'Réfrigérateurs', emoji: '🧊', group: 'Froid', minLevel: 2,
    desc: 'Obligatoires pour vendre les produits frais (beurre, yaourts, viande…).', effect: '+4 emplacements réfrigérés',
    costs: [180, 400, 800, 1500, 2600, 4000, 6000, 9000] },
  { id: 'freezer', name: 'Congélateurs', emoji: '❄️', group: 'Froid', minLevel: 5,
    desc: 'Obligatoires pour vendre les surgelés.', effect: '+4 emplacements surgelés',
    costs: [350, 700, 1300, 2400, 4000, 6500] },
  { id: 'sign', name: 'Enseigne lumineuse', emoji: '🪧', group: 'Image', minLevel: 1,
    desc: 'Une belle enseigne attire les passants.', effect: '+3 de réputation, +4 % de clients',
    costs: [150, 500, 1500, 4000, 9000] },
  { id: 'deco', name: 'Décoration', emoji: '🪴', group: 'Image', minLevel: 1,
    desc: 'Plantes, éclairage chaleureux, sol refait à neuf.', effect: '+2 de réputation, +0,3 / jour',
    costs: [100, 350, 1000, 2500] },
  { id: 'billboard', name: 'Panneau publicitaire', emoji: '📣', group: 'Image', minLevel: 2,
    desc: 'Une affiche à l’entrée du quartier.', effect: '+8 % de clients potentiels',
    costs: [200, 600, 1600, 4000, 9000] },
  { id: 'stocker', name: 'Employé de rayon', emoji: '🧑‍🔧', group: 'Équipe', minLevel: 2, salary: 18,
    desc: 'Remplit les rayons chaque matin et les regarnit pendant la journée.', effect: 'Placement automatique',
    costs: [200] },
  { id: 'cashier', name: 'Caissier', emoji: '🧑‍💼', group: 'Équipe', minLevel: 2, salary: 22,
    desc: 'Sans caissier, la file d’attente fait fuir les clients au-delà de 70 par jour.', effect: 'Plus de clients encaissés par jour',
    costs: [150, 400, 900, 1800, 3500, 6000, 9500, 14000] },
  { id: 'buyer', name: 'Responsable des achats', emoji: '🧑‍💼', group: 'Équipe', minLevel: 5, salary: 40,
    desc: 'Passe les commandes chaque matin à ta place, chez le fournisseur le moins cher qui livre à temps.', effect: 'Achats automatiques au meilleur prix',
    costs: [1500] },
  { id: 'logistics', name: 'Entrepôt logistique', emoji: '🏭', group: 'Espace', minLevel: 8,
    desc: 'Un grand entrepôt en périphérie, relié au magasin par navette.', effect: '+2 500 de volume en entrepôt',
    costs: [20000, 45000, 90000] },
  { id: 'express', name: 'Livraison express', emoji: '⚡', group: 'Logistique', minLevel: 3,
    desc: 'Contrat prioritaire avec les transporteurs.', effect: '−1 jour de délai (min. 1) et immunité aux grèves',
    costs: [500] },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
