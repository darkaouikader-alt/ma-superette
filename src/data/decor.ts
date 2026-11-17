// ────────────────────────────────────────────────────────────────
//  FAÇADE — éléments à gagner, statuts du magasin, succès.
//  Chaque élément a un « charme » qui attire des clients et améliore
//  la réputation. Un élément pensé pour un petit commerce devient
//  « démodé » quand le magasin grandit : il faut faire évoluer sa façade.
// ────────────────────────────────────────────────────────────────

export type DecorSlot = 'facade' | 'toit' | 'auvent' | 'enseigne' | 'porte' | 'vitrine' | 'sol' | 'deco' | 'eclairage';

export const DECOR_SLOTS: { id: DecorSlot; name: string; emoji: string }[] = [
  { id: 'facade', name: 'Façade', emoji: '🧱' },
  { id: 'toit', name: 'Toit', emoji: '🏠' },
  { id: 'auvent', name: 'Auvent', emoji: '⛱️' },
  { id: 'enseigne', name: 'Enseigne', emoji: '🪧' },
  { id: 'porte', name: 'Porte d’entrée', emoji: '🚪' },
  { id: 'vitrine', name: 'Vitrines', emoji: '🪟' },
  { id: 'sol', name: 'Sol et trottoir', emoji: '🟫' },
  { id: 'deco', name: 'Décoration', emoji: '🪴' },
  { id: 'eclairage', name: 'Éclairage', emoji: '💡' },
];

/** Statuts du magasin : l'architecture change à chaque statut. */
export const TIERS = [
  { tier: 1, name: 'Épicerie', minLevel: 1, emoji: '🏪' },
  { tier: 2, name: 'Supérette', minLevel: 3, emoji: '🏬' },
  { tier: 3, name: 'Mini-marché', minLevel: 5, emoji: '🏢' },
  { tier: 4, name: 'Supermarché', minLevel: 7, emoji: '🛒' },
];
export const tierOf = (level: number) => [...TIERS].reverse().find((t) => level >= t.minLevel)!.tier;
export const tierName = (tier: number) => TIERS[tier - 1].name;
/** « une épicerie », « un supermarché »… */
export const tierWithArticle = (tier: number) => `${tier <= 2 ? 'une' : 'un'} ${TIERS[tier - 1].name.toLowerCase()}`;

export const THEMES: Record<string, { name: string; emoji: string }> = {
  classique: { name: 'Classique', emoji: '🟩' },
  bio: { name: 'Bio & nature', emoji: '🌿' },
  provence: { name: 'Provence', emoji: '🌻' },
  chic: { name: 'Épicerie fine', emoji: '🍷' },
  bonbon: { name: 'Bonbon', emoji: '🍬' },
  neon: { name: 'Néon de nuit', emoji: '🌃' },
  retro: { name: 'Rétro sixties', emoji: '📻' },
  chalet: { name: 'Chalet d’hiver', emoji: '❄️' },
  moderne: { name: 'Moderne', emoji: '🏙️' },
};

/** Comment gagner un élément. */
export type Unlock =
  | { kind: 'start' }
  | { kind: 'level'; level: number }
  | { kind: 'objective'; id: string }
  | { kind: 'milestone'; id: string };

/** Succès (en plus des objectifs) qui font gagner des éléments de façade. */
export interface MilestoneDef { id: string; label: string; emoji: string; metric: 'customers' | 'daysPlayed' | 'promos' | 'campaigns' | 'noWasteStreak' | 'revenue'; target: number }
export const MILESTONES: MilestoneDef[] = [
  { id: 'jours7', label: 'Tenir ta boutique 7 jours', emoji: '📅', metric: 'daysPlayed', target: 7 },
  { id: 'jours30', label: 'Tenir ta boutique 30 jours', emoji: '🗓️', metric: 'daysPlayed', target: 30 },
  { id: 'jours60', label: 'Tenir ta boutique 60 jours', emoji: '🏅', metric: 'daysPlayed', target: 60 },
  { id: 'clients500', label: 'Servir 500 clients', emoji: '🧑‍🤝‍🧑', metric: 'customers', target: 500 },
  { id: 'clients3000', label: 'Servir 3 000 clients', emoji: '👨‍👩‍👧', metric: 'customers', target: 3000 },
  { id: 'promos5', label: 'Lancer 5 promotions', emoji: '🏷️', metric: 'promos', target: 5 },
  { id: 'campagnes3', label: 'Lancer 3 campagnes de pub', emoji: '📣', metric: 'campaigns', target: 3 },
  { id: 'zeroGaspi', label: '5 jours de suite sans produit périmé', emoji: '♻️', metric: 'noWasteStreak', target: 5 },
  { id: 'ca50k', label: '50 000 € de chiffre d’affaires cumulé', emoji: '💶', metric: 'revenue', target: 50000 },
];
export const MILESTONE_BY_ID = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

/** Paramètres de dessin (utilisés par ui/storefront.ts). */
export interface DecorLook {
  wall?: string; wall2?: string; texture?: 'plain' | 'brick' | 'wood' | 'stone' | 'tiles' | 'glass' | 'metal';
  roof?: string; roofStyle?: 'flat' | 'tiles' | 'wood' | 'green' | 'slate' | 'metal' | 'snow' | 'neon';
  aw1?: string; aw2?: string; awStyle?: 'stripes' | 'scallop' | 'solid' | 'canopy';
  sign?: string; signText?: string; signStyle?: 'board' | 'wood' | 'lightbox' | 'gold' | 'neon' | 'retro' | 'letters' | 'candy';
  door?: string; doorStyle?: 'wood' | 'glass' | 'arch' | 'double' | 'sliding' | 'revolving' | 'candy' | 'chalet';
  frame?: string; glass?: string; winStyle?: 'small' | 'shutters' | 'large' | 'arched' | 'neon' | 'full' | 'wood' | 'retro';
  pave?: string; road?: string; solStyle?: 'asphalt' | 'cobble' | 'terracotta' | 'checker' | 'deck' | 'snow' | 'marble' | 'parking';
  decoStyle?: 'none' | 'plants' | 'crates' | 'lavender' | 'candy' | 'snowman' | 'bench' | 'jukebox' | 'fountain' | 'carts' | 'flags' | 'palms';
  lightStyle?: 'none' | 'garland' | 'lanterns' | 'neon' | 'spots' | 'fairy';
  sky?: [string, string];
}

export interface DecorPart {
  id: string;
  slot: DecorSlot;
  name: string;
  emoji: string;
  theme: string;
  /** Statut pour lequel l'élément est conçu (1 = épicerie … 4 = supermarché). */
  tier: number;
  /** Points de charme (attractivité). */
  charm: number;
  unlock: Unlock;
  look: DecorLook;
}

const start: Unlock = { kind: 'start' };
const lvl = (level: number): Unlock => ({ kind: 'level', level });
const obj = (id: string): Unlock => ({ kind: 'objective', id });
const ms = (id: string): Unlock => ({ kind: 'milestone', id });

function D(id: string, slot: DecorSlot, name: string, emoji: string, theme: string, tier: number, charm: number, unlock: Unlock, look: DecorLook): DecorPart {
  return { id, slot, name, emoji, theme, tier, charm, unlock, look };
}

export const DECOR_PARTS: DecorPart[] = [
  // ── Façade ──
  D('f_creme', 'facade', 'Crépi crème', '🧱', 'classique', 1, 1, start, { wall: '#fff6e6', wall2: '#f6e7cb', texture: 'plain' }),
  D('f_brique', 'facade', 'Briques rouges', '🧱', 'classique', 1, 2, lvl(2), { wall: '#c8654a', wall2: '#b85a42', texture: 'brick' }),
  D('f_bois', 'facade', 'Bardage en bois clair', '🪵', 'bio', 1, 2, ms('jours7'), { wall: '#e2c393', wall2: '#d3b07c', texture: 'wood' }),
  D('f_ocre', 'facade', 'Enduit ocre de Provence', '🌞', 'provence', 2, 3, lvl(3), { wall: '#f6d49a', wall2: '#efc57e', texture: 'plain' }),
  D('f_pierre', 'facade', 'Pierre de taille', '🪨', 'chic', 2, 3, obj('rep30'), { wall: '#ddd3c2', wall2: '#cbbfaa', texture: 'stone' }),
  D('f_rose', 'facade', 'Façade guimauve', '🍥', 'bonbon', 2, 3, ms('promos5'), { wall: '#ffe3ef', wall2: '#ffd0e4', texture: 'plain' }),
  D('f_carreaux', 'facade', 'Carrelage turquoise', '🟦', 'retro', 3, 4, lvl(5), { wall: '#7fc8c0', wall2: '#9fd8d0', texture: 'tiles' }),
  D('f_chalet', 'facade', 'Rondins de chalet', '🛖', 'chalet', 3, 4, ms('jours30'), { wall: '#8a5c3b', wall2: '#9b6a45', texture: 'wood' }),
  D('f_nuit', 'facade', 'Façade nuit violette', '🌌', 'neon', 3, 4, obj('rep60'), { wall: '#2b2540', wall2: '#352d52', texture: 'plain', sky: ['#1b1440', '#4a2a73'] }),
  D('f_verre', 'facade', 'Mur rideau en verre', '🏙️', 'moderne', 4, 5, lvl(7), { wall: '#cfe3ee', wall2: '#b9d3e2', texture: 'glass' }),
  D('f_metal', 'facade', 'Bardage métal anthracite', '⬛', 'moderne', 4, 6, obj('cash10k'), { wall: '#4a5260', wall2: '#5a6372', texture: 'metal' }),

  // ── Toit ──
  D('t_plat', 'toit', 'Toit plat', '▬', 'classique', 1, 1, start, { roof: '#c96f4a', roofStyle: 'flat' }),
  D('t_tuiles', 'toit', 'Tuiles romaines', '🏠', 'provence', 1, 2, lvl(2), { roof: '#d36b3c', roofStyle: 'tiles' }),
  D('t_bois', 'toit', 'Bardeaux de bois', '🪵', 'chalet', 2, 3, ms('clients500'), { roof: '#6d4a30', roofStyle: 'wood' }),
  D('t_vegetal', 'toit', 'Toit végétalisé', '🌱', 'bio', 2, 3, obj('assort40'), { roof: '#5e9b4a', roofStyle: 'green' }),
  D('t_ardoise', 'toit', 'Ardoises', '⬛', 'chic', 3, 4, lvl(5), { roof: '#3f4652', roofStyle: 'slate' }),
  D('t_neige', 'toit', 'Toit enneigé', '🏔️', 'chalet', 3, 4, ms('zeroGaspi'), { roof: '#5a3a26', roofStyle: 'snow', sky: ['#a9c7e6', '#eef5fb'] }),
  D('t_neon', 'toit', 'Corniche néon', '🟪', 'neon', 3, 4, ms('campagnes3'), { roof: '#17122b', roofStyle: 'neon' }),
  D('t_metal', 'toit', 'Toiture acier', '🏗️', 'moderne', 4, 5, lvl(7), { roof: '#6b7380', roofStyle: 'metal' }),

  // ── Auvent ──
  D('a_vert', 'auvent', 'Rayures vertes', '🟩', 'classique', 1, 1, start, { aw1: '#2fa36b', aw2: '#ffffff', awStyle: 'stripes' }),
  D('a_rouge', 'auvent', 'Rayures rouges', '🟥', 'classique', 1, 2, lvl(2), { aw1: '#d64545', aw2: '#ffffff', awStyle: 'stripes' }),
  D('a_bleu', 'auvent', 'Bleu et jaune', '🟦', 'provence', 2, 3, lvl(3), { aw1: '#2f6db5', aw2: '#ffd34d', awStyle: 'stripes' }),
  D('a_bio', 'auvent', 'Toile de lin vert', '🌿', 'bio', 2, 3, lvl(4), { aw1: '#6b8f3a', aw2: '#e8dcc0', awStyle: 'solid' }),
  D('a_feston', 'auvent', 'Festons rose et menthe', '🍬', 'bonbon', 2, 3, obj('team'), { aw1: '#ff7eb6', aw2: '#c8f7e1', awStyle: 'scallop' }),
  D('a_chalet', 'auvent', 'Rouge chalet', '🎿', 'chalet', 2, 3, ms('jours30'), { aw1: '#b23a3a', aw2: '#ffffff', awStyle: 'scallop' }),
  D('a_bordeaux', 'auvent', 'Bordeaux et crème', '🍷', 'chic', 3, 4, lvl(6), { aw1: '#7a1f3d', aw2: '#f3e3c3', awStyle: 'solid' }),
  D('a_retro', 'auvent', 'Orange sixties', '🟧', 'retro', 3, 4, ms('clients3000'), { aw1: '#e76f51', aw2: '#f4f1de', awStyle: 'scallop' }),
  D('a_neon', 'auvent', 'Magenta électrique', '💗', 'neon', 3, 4, obj('rep60'), { aw1: '#ff3fa4', aw2: '#2a2440', awStyle: 'stripes' }),
  D('a_marquise', 'auvent', 'Marquise vitrée', '🔲', 'moderne', 4, 5, lvl(8), { aw1: '#9fb4c4', aw2: '#d9e6ef', awStyle: 'canopy' }),

  // ── Enseigne ──
  D('e_noire', 'enseigne', 'Panneau noir', '⬛', 'classique', 1, 1, start, { sign: '#2a2733', signText: '#ffffff', signStyle: 'board' }),
  D('e_bois', 'enseigne', 'Planche gravée', '🪵', 'bio', 1, 2, ms('jours7'), { sign: '#7a5a3a', signText: '#fdf6e3', signStyle: 'wood' }),
  D('e_lumineuse', 'enseigne', 'Caisson lumineux', '💡', 'classique', 2, 3, obj('rep30'), { sign: '#1d7a4e', signText: '#ffffff', signStyle: 'lightbox' }),
  D('e_bonbon', 'enseigne', 'Lettres sucre d’orge', '🍭', 'bonbon', 2, 3, ms('promos5'), { sign: '#7c4dff', signText: '#ffffff', signStyle: 'candy' }),
  D('e_doree', 'enseigne', 'Lettres dorées', '✨', 'chic', 3, 4, obj('cash2k'), { sign: '#1b1210', signText: '#e9c46a', signStyle: 'gold' }),
  D('e_retro', 'enseigne', 'Enseigne diner', '📻', 'retro', 3, 4, lvl(6), { sign: '#264653', signText: '#f4a261', signStyle: 'retro' }),
  D('e_neon', 'enseigne', 'Néon cyan', '🌀', 'neon', 3, 5, ms('campagnes3'), { sign: '#120e22', signText: '#49f2ff', signStyle: 'neon' }),
  D('e_lettres', 'enseigne', 'Lettres géantes sur le toit', '🔠', 'moderne', 4, 6, lvl(8), { sign: '#2fa36b', signText: '#ffffff', signStyle: 'letters' }),

  // ── Porte d'entrée ──
  D('p_bois', 'porte', 'Porte en bois', '🚪', 'classique', 1, 1, start, { door: '#9a6b43', doorStyle: 'wood' }),
  D('p_bonbon', 'porte', 'Porte bonbonnière', '🍬', 'bonbon', 1, 2, obj('first_order'), { door: '#ff7eb6', doorStyle: 'candy' }),
  D('p_verre', 'porte', 'Porte vitrée', '🔳', 'classique', 2, 2, lvl(3), { door: '#5b6470', doorStyle: 'glass' }),
  D('p_arche', 'porte', 'Porte en arche bleue', '⛩️', 'provence', 2, 3, ms('clients500'), { door: '#2f6db5', doorStyle: 'arch' }),
  D('p_chalet', 'porte', 'Porte de chalet', '🛖', 'chalet', 2, 3, lvl(4), { door: '#4a2f1d', doorStyle: 'chalet' }),
  D('p_double', 'porte', 'Double porte à moulures', '🚪', 'chic', 3, 4, obj('team'), { door: '#2a1c18', doorStyle: 'double' }),
  D('p_auto', 'porte', 'Portes automatiques', '↔️', 'moderne', 4, 5, lvl(7), { door: '#8a96a3', doorStyle: 'sliding' }),
  D('p_tambour', 'porte', 'Porte à tambour', '🔄', 'moderne', 4, 6, obj('rep80'), { door: '#6b7380', doorStyle: 'revolving' }),

  // ── Vitrines ──
  D('v_petite', 'vitrine', 'Petites vitrines', '🪟', 'classique', 1, 1, start, { frame: '#ffffff', glass: '#cdeaf9', winStyle: 'small' }),
  D('v_volets', 'vitrine', 'Fenêtres à volets', '🪟', 'provence', 1, 2, ms('jours7'), { frame: '#2f6db5', glass: '#d6ecff', winStyle: 'shutters' }),
  D('v_grande', 'vitrine', 'Grandes vitrines', '🖼️', 'classique', 2, 3, lvl(3), { frame: '#ffffff', glass: '#cdeaf9', winStyle: 'large' }),
  D('v_bois', 'vitrine', 'Cadres en bois brut', '🪵', 'bio', 2, 3, obj('fridge1'), { frame: '#a07a52', glass: '#e3f1dc', winStyle: 'wood' }),
  D('v_arcade', 'vitrine', 'Vitrines en arcades', '🏛️', 'chic', 3, 4, lvl(5), { frame: '#e9c46a', glass: '#f7e7b9', winStyle: 'arched' }),
  D('v_neon', 'vitrine', 'Vitrines néon', '🟦', 'neon', 3, 4, ms('clients3000'), { frame: '#49f2ff', glass: '#5ad7ff', winStyle: 'neon' }),
  D('v_retro', 'vitrine', 'Hublots chromés', '⭕', 'retro', 3, 4, ms('ca50k'), { frame: '#c9d2da', glass: '#fdf6e3', winStyle: 'retro' }),
  D('v_totale', 'vitrine', 'Baie vitrée intégrale', '🏙️', 'moderne', 4, 5, lvl(8), { frame: '#5b6470', glass: '#d6ecf7', winStyle: 'full' }),

  // ── Sol et trottoir ──
  D('s_bitume', 'sol', 'Trottoir en bitume', '⬛', 'classique', 1, 0, start, { pave: '#d9d2c4', road: '#8e8f99', solStyle: 'asphalt' }),
  D('s_paves', 'sol', 'Pavés anciens', '🧱', 'classique', 1, 2, lvl(2), { pave: '#c9bfae', road: '#8e8f99', solStyle: 'cobble' }),
  D('s_terre', 'sol', 'Tomettes en terre cuite', '🟧', 'provence', 2, 3, obj('profit100'), { pave: '#d98b5f', road: '#9a948a', solStyle: 'terracotta' }),
  D('s_terrasse', 'sol', 'Terrasse en bois', '🪵', 'bio', 2, 3, lvl(4), { pave: '#b88b5c', road: '#8a8a86', solStyle: 'deck' }),
  D('s_damier', 'sol', 'Damier noir et blanc', '🏁', 'retro', 2, 3, ms('zeroGaspi'), { pave: '#fdf6e3', road: '#8d8f97', solStyle: 'checker' }),
  D('s_neige', 'sol', 'Trottoir enneigé', '❄️', 'chalet', 2, 3, ms('jours60'), { pave: '#eef2f6', road: '#9aa3ad', solStyle: 'snow' }),
  D('s_marbre', 'sol', 'Parvis en marbre', '🤍', 'chic', 3, 5, obj('cash10k'), { pave: '#ece6dc', road: '#7d7b84', solStyle: 'marble' }),
  D('s_parking', 'sol', 'Grand parking', '🅿️', 'moderne', 4, 5, lvl(7), { pave: '#cfd3d8', road: '#6f737c', solStyle: 'parking' }),

  // ── Décoration ──
  D('d_aucune', 'deco', 'Aucune', '▫️', 'classique', 1, 0, start, { decoStyle: 'none' }),
  D('d_plantes', 'deco', 'Plantes en pot', '🪴', 'classique', 1, 2, lvl(2), { decoStyle: 'plants' }),
  D('d_cagettes', 'deco', 'Étal de cagettes', '🍎', 'bio', 1, 2, obj('first_order'), { decoStyle: 'crates' }),
  D('d_banc', 'deco', 'Banc et lampadaire', '🪑', 'classique', 2, 2, lvl(3), { decoStyle: 'bench' }),
  D('d_lavande', 'deco', 'Pots de lavande', '💜', 'provence', 2, 3, obj('rep30'), { decoStyle: 'lavender' }),
  D('d_sucettes', 'deco', 'Sucettes géantes', '🍭', 'bonbon', 2, 3, ms('promos5'), { decoStyle: 'candy' }),
  D('d_bonhomme', 'deco', 'Bonhomme de neige', '⛄', 'chalet', 2, 3, ms('jours30'), { decoStyle: 'snowman' }),
  D('d_jukebox', 'deco', 'Juke-box et scooter', '🛵', 'retro', 3, 4, ms('clients3000'), { decoStyle: 'jukebox' }),
  D('d_palmiers', 'deco', 'Palmiers lumineux', '🌴', 'neon', 3, 4, ms('ca50k'), { decoStyle: 'palms' }),
  D('d_drapeaux', 'deco', 'Mâts et drapeaux', '🚩', 'moderne', 3, 4, lvl(6), { decoStyle: 'flags' }),
  D('d_fontaine', 'deco', 'Fontaine', '⛲', 'chic', 3, 5, obj('rep80'), { decoStyle: 'fountain' }),
  D('d_chariots', 'deco', 'Abri à chariots', '🛒', 'moderne', 4, 5, lvl(7), { decoStyle: 'carts' }),

  // ── Éclairage ──
  D('l_aucun', 'eclairage', 'Aucun', '▫️', 'classique', 1, 0, start, { lightStyle: 'none' }),
  D('l_guirlande', 'eclairage', 'Guirlande d’ampoules', '💡', 'classique', 1, 2, ms('clients500'), { lightStyle: 'garland' }),
  D('l_fees', 'eclairage', 'Guirlande féerique', '✨', 'bonbon', 2, 3, obj('team'), { lightStyle: 'fairy' }),
  D('l_lanternes', 'eclairage', 'Lanternes en laiton', '🏮', 'chic', 2, 3, lvl(4), { lightStyle: 'lanterns' }),
  D('l_neon', 'eclairage', 'Tubes néon', '🟣', 'neon', 3, 4, obj('rep60'), { lightStyle: 'neon' }),
  D('l_spots', 'eclairage', 'Projecteurs de façade', '🔦', 'moderne', 4, 5, lvl(8), { lightStyle: 'spots' }),
];

export const DECOR_BY_ID: Record<string, DecorPart> = Object.fromEntries(DECOR_PARTS.map((p) => [p.id, p]));
export const START_DECOR = Object.fromEntries(DECOR_SLOTS.map((s) => [s.id, DECOR_PARTS.find((p) => p.slot === s.id && p.unlock.kind === 'start')!.id])) as Record<DecorSlot, string>;

/** Effets de la façade (équilibrage). */
export const DECOR_BALANCE = {
  /** Un élément conçu pour un statut inférieur de 2 crans ou plus ne compte qu'à moitié. */
  OUTDATED_FACTOR: 0.5,
  /** Bonus de thème : nombre d'éléments du même thème → multiplicateur du charme. */
  THEME_BONUS: [[6, 1.3], [4, 1.15]] as [number, number][],
  /** Clients supplémentaires par point de charme, et plafond. */
  TRAFFIC_PER_CHARM: 0.003,
  TRAFFIC_MAX: 0.15,
  /** Réputation par jour par point de charme, et plafond. */
  REP_PER_CHARM: 0.022,
  REP_MAX: 1.2,
};
