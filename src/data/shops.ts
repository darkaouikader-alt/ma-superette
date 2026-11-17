// Magasins gérés : de vrais magasins (rayons, stock, prix, commandes, améliorations propres),
// à la différence des succursales qui ne font que verser un revenu.
// Dès 2 magasins possédés, on peut confier la gestion de l'un d'eux à un gérant.

export interface ShopDef {
  id: string;
  name: string;
  emoji: string;
  city: string;
  minLevel: number;
  cost: number;
}

/** Le magasin de départ. */
export const MAIN_SHOP: ShopDef = { id: 'main', name: 'Magasin principal', emoji: '🏪', city: 'Ton quartier', minLevel: 1, cost: 0 };

export const SHOPS: ShopDef[] = [
  { id: 'tilleuls', name: 'Supérette des Tilleuls', emoji: '🌳', city: 'Quartier des Tilleuls', minLevel: 6, cost: 25000 },
  { id: 'port', name: 'Épicerie du Port', emoji: '⚓', city: 'Le Port', minLevel: 9, cost: 150000 },
  { id: 'marche', name: 'Marché de la Gare', emoji: '🚉', city: 'Quartier de la Gare', minLevel: 12, cost: 800000 },
  { id: 'colline', name: 'Supermarché de la Colline', emoji: '⛰️', city: 'La Colline', minLevel: 15, cost: 4000000 },
  { id: 'riviera', name: 'Hypermarché Riviera', emoji: '🌊', city: 'Riviera', minLevel: 17, cost: 12000000 },
  { id: 'capitale', name: 'Grand magasin de la Capitale', emoji: '🏙️', city: 'La Capitale', minLevel: 19, cost: 40000000 },
];

export const SHOP_DEF_BY_ID: Record<string, ShopDef> = Object.fromEntries([MAIN_SHOP, ...SHOPS].map((s) => [s.id, s]));

/** Nombre minimal de magasins possédés pour pouvoir en confier un à un gérant. */
export const MIN_SHOPS_TO_DELEGATE = 2;

export type ManagerId = 'junior' | 'confirme' | 'expert';

export interface ManagerDef {
  id: ManagerId;
  name: string;
  emoji: string;
  /** Rendement du magasin par rapport à une gestion parfaite (multiplie les clients et la demande). */
  efficiency: number;
  /** Salaire quotidien de base, multiplié par l'affluence du niveau (le métier grandit avec l'enseigne). */
  salary: number;
  /** Achats d'équipement : aucun, équipe et froid seulement, ou tout. */
  equips: 'none' | 'team' | 'all';
  desc: string;
}

export const MANAGERS: ManagerDef[] = [
  { id: 'junior', name: 'Gérant débutant', emoji: '🧑‍💼', efficiency: 0.82, salary: 120, equips: 'none',
    desc: 'Fixe les prix, commande et range les rayons. N’achète aucun équipement.' },
  { id: 'confirme', name: 'Gérante confirmée', emoji: '👩‍💼', efficiency: 0.92, salary: 450, equips: 'team',
    desc: 'Gère mieux, et embauche caissiers et équipe de rayon, installe le froid.' },
  { id: 'expert', name: 'Directeur expert', emoji: '🕴️', efficiency: 1, salary: 1400, equips: 'all',
    desc: 'Aussi bon que toi : investit dans tout l’équipement du magasin.' },
];

export const MANAGER_BY_ID = Object.fromEntries(MANAGERS.map((m) => [m.id, m])) as Record<ManagerId, ManagerDef>;
