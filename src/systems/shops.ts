// Magasins gérés : achat, changement de magasin affiché, délégation à un gérant et gestion automatique.
//
// Fonctionnement : les champs propres à un magasin (SHOP_KEYS : rayons, stock, prix, commandes,
// améliorations, réputation…) sont dans l'état pour le magasin affiché ; ceux des autres magasins sont
// rangés dans `state.shops.list[i].data`. Changer de magasin échange ces champs : tout le reste du jeu
// (écrans, simulation, fournisseurs) travaille donc toujours sur « le magasin courant », sans le savoir.
// La trésorerie, le niveau, l'XP, les licences, la façade et les objectifs sont communs à l'enseigne.
import { UPGRADE_BY_ID } from '../data/upgrades';
import { MAIN_SHOP, MANAGER_BY_ID, MIN_SHOPS_TO_DELEGATE, SHOP_DEF_BY_ID, SHOPS, type ManagerId, type ShopDef } from '../data/shops';
import { PRODUCTS } from '../data/products';
import { SHOP_KEYS, type GameState, type ShopData, type ShopEntry } from '../state/types';
import { expectedDemand, roundPrice, round2, suggestedPrice, up } from './economy';
import { buyUpgrade, sellableProducts, upgradeCost } from './progression';
import { autoArrange, syncSlots, totalQty } from './stock';
import { autoReorder, cartView, fastestSupplier, inTransit, placeOrders, setCartLots } from './suppliers';

/** Magasins possédés (le principal compris), dans l'ordre d'achat. */
export function shopList(state: GameState): ShopEntry[] {
  return state.shops?.list ?? [{ id: MAIN_SHOP.id, manager: null, data: null }];
}

export const shopCount = (state: GameState) => shopList(state).length;
export const activeShopIndex = (state: GameState) => state.shops?.active ?? 0;
export const shopDef = (id: string): ShopDef => SHOP_DEF_BY_ID[id] ?? MAIN_SHOP;
export const activeShop = (state: GameState): ShopEntry => shopList(state)[activeShopIndex(state)];
export const ownsShop = (state: GameState, id: string) => shopList(state).some((s) => s.id === id);

function ensureShops(state: GameState): { active: number; list: ShopEntry[] } {
  state.shops ??= { active: 0, list: [{ id: MAIN_SHOP.id, manager: null, data: null }] };
  return state.shops;
}

const takeData = (state: GameState): ShopData =>
  Object.fromEntries(SHOP_KEYS.map((k) => [k, state[k]])) as unknown as ShopData;

/** Affiche (et rend « courant ») le magasin n° `index`. */
export function switchShop(state: GameState, index: number): void {
  const shops = state.shops;
  if (!shops || index === shops.active || !shops.list[index]?.data) return;
  shops.list[shops.active].data = takeData(state);
  // Champ par champ : un champ absent (perdu à la sauvegarde, ex. `buyer: undefined`) doit être vidé,
  // pas hérité du magasin précédent.
  const data = shops.list[index].data as Partial<ShopData>;
  const target = state as unknown as Record<string, unknown>;
  for (const k of SHOP_KEYS) target[k] = data[k];
  shops.list[index].data = null;
  shops.active = index;
  syncSlots(state);
}

/** Exécute `fn` sur chaque magasin tour à tour, puis revient au magasin affiché. */
export function forEachShop(state: GameState, fn: (index: number, entry: ShopEntry) => void): void {
  const list = shopList(state);
  if (list.length === 1) { fn(0, list[0]); return; }
  const back = activeShopIndex(state);
  try {
    for (let i = 0; i < list.length; i++) {
      switchShop(state, i);
      fn(i, list[i]);
    }
  } finally {
    switchShop(state, back);
  }
}

/** Données d'un magasin tout neuf : rayons vides, prix du marché, pas d'équipement. */
function freshShopData(state: GameState): ShopData {
  return {
    prices: Object.fromEntries(PRODUCTS.map((p) => [p.id, p.market])),
    stock: {}, slots: [], orders: [], cart: [], upgrades: {}, promos: [], campaigns: [],
    history: [], salesHistory: {}, demandHistory: {}, productStats: {}, buyer: undefined,
    // La renommée de l'enseigne donne un petit élan au nouveau magasin.
    reputation: Math.min(30, Math.round(state.reputation / 3)),
  };
}

export function buyShop(state: GameState, id: string): string | null {
  const def = SHOPS.find((s) => s.id === id);
  if (!def) return 'Magasin inconnu.';
  if (ownsShop(state, id)) return 'Tu possèdes déjà ce magasin.';
  if (state.level < def.minLevel) return `Niveau ${def.minLevel} requis.`;
  if (state.cash < def.cost) return 'Trésorerie insuffisante.';
  state.cash = round2(state.cash - def.cost);
  ensureShops(state).list.push({ id, manager: null, data: freshShopData(state) });
  return null;
}

/** Magasins gérés par le joueur lui-même. */
export const selfManagedCount = (state: GameState) => shopList(state).filter((s) => !s.manager).length;

/** Peut-on confier ce magasin à un gérant ? (null = oui, sinon la raison) */
export function delegateBlock(state: GameState, index: number): string | null {
  const list = shopList(state);
  if (list.length < MIN_SHOPS_TO_DELEGATE) return `Possède au moins ${MIN_SHOPS_TO_DELEGATE} magasins pour en confier un à un gérant.`;
  const entry = list[index];
  if (!entry) return 'Magasin inconnu.';
  if (!entry.manager && selfManagedCount(state) <= 1) return 'Garde au moins un magasin que tu gères toi-même.';
  return null;
}

/** Confie le magasin à un gérant (ou change de gérant). */
export function delegateShop(state: GameState, index: number, manager: ManagerId): string | null {
  const err = delegateBlock(state, index);
  if (err) return err;
  if (!MANAGER_BY_ID[manager]) return 'Gérant inconnu.';
  const entry = ensureShops(state).list[index];
  const first = !entry.manager;
  entry.manager = manager;
  // Le nouveau gérant se met au travail tout de suite (prix, commandes, rayons), sans attendre demain.
  if (first) {
    const back = activeShopIndex(state);
    switchShop(state, index);
    try { manageShop(state, manager); } finally { switchShop(state, back); }
  }
  return null;
}

/** Reprend la gestion du magasin. */
export function takeBackShop(state: GameState, index: number): void {
  const entry = state.shops?.list[index];
  if (entry) entry.manager = null;
}

/** Trésorerie que les gérants laissent toujours en caisse. */
export const managerReserve = (state: GameState) => Math.max(500, Math.round(state.cash * 0.1));

const TEAM_UPGRADES = ['cashier', 'stocker', 'fridge', 'freezer', 'buyer'];
const ALL_UPGRADES = [...TEAM_UPGRADES, 'shelves', 'warehouse', 'logistics', 'express', 'sign', 'billboard', 'deco'];

/**
 * Gestion automatique d'un magasin par son gérant (chaque matin, magasin courant) :
 * équipement selon son grade, prix du marché, commandes, rangement des rayons.
 */
export function manageShop(state: GameState, managerId: ManagerId): { ordered: number; bought: string[] } {
  const m = MANAGER_BY_ID[managerId];
  const bought: string[] = [];
  // 1. Équipement : seulement si l'achat reste petit devant la trésorerie de l'enseigne.
  if (m.equips !== 'none') {
    for (const id of m.equips === 'all' ? ALL_UPGRADES : TEAM_UPGRADES) {
      const def = UPGRADE_BY_ID[id];
      const cost = upgradeCost(state, id);
      if (!def || cost === null || state.level < def.minLevel) continue;
      if (cost <= (state.cash - managerReserve(state)) * 0.15 && buyUpgrade(state, id) === null) bought.push(id);
    }
  }
  // 2. Prix : ceux du marché.
  for (const p of sellableProducts(state)) state.prices[p.id] = roundPrice(suggestedPrice(p, state));
  // 3. Commandes, sans entamer la réserve (la caisse est commune à toute l'enseigne).
  const reserve = managerReserve(state);
  state.cash -= reserve;
  let ordered = 0;
  try {
    ordered += autoReorder(state, 'all');
    for (const p of sellableProducts(state)) {
      if (p.essential || totalQty(state, p.id) > 0 || inTransit(state, p.id) > 0 || state.salesHistory[p.id]) continue;
      if (p.storage !== 'ambient' && up(state, p.storage) === 0) continue;
      const sup = fastestSupplier(p, state);
      if (!sup) continue;
      setCartLots(state, sup.id, p.id, Math.max(1, Math.ceil((expectedDemand(state, p) * 2) / sup.lotSize)));
      const cv = cartView(state);
      if (cv.overCash || cv.overCapacity) setCartLots(state, sup.id, p.id, 0);
      else ordered++;
    }
    if (placeOrders(state)) state.cart = [];
  } finally {
    state.cash = round2(state.cash + reserve);
  }
  // 4. Rayons.
  autoArrange(state);
  return { ordered, bought };
}

