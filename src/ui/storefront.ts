// Vitrine illustrée (SVG) du tableau de bord.
// L'architecture dépend du statut du magasin (épicerie → supermarché) ;
// chaque élément de façade équipé (toit, porte, sol…) est dessiné par-dessus.
import { tierOf, type DecorLook } from '../data/decor';
import { PRODUCT_BY_ID } from '../data/products';
import type { GameState } from '../state/types';
import { decorLook } from '../systems/decor';
import { up } from '../systems/economy';
import { weatherFor } from '../systems/events';
import { assortment } from '../systems/stock';

const SKIES: Record<string, [string, string]> = {
  '☀️': ['#7cc8f8', '#dff3ff'], '⛅': ['#9cc9ea', '#eaf4fa'], '🌦️': ['#93adc2', '#dde7ee'],
  '🌧️': ['#7b8fa3', '#c5d0d9'], '🔥': ['#ffa95e', '#ffe6bf'], '❄️': ['#b4d2ee', '#f3f9fe'],
};
const SIGN_NAME = ['', 'MA PETITE ÉPICERIE', 'MA SUPÉRETTE', 'MA SUPÉRETTE ★', 'MON SUPERMARCHÉ'];
const W = 1200, H = 320, G = 262;
let uid = 0;

/** Géométrie du bâtiment selon le statut. */
function geometry(tier: number) {
  const bw = [0, 400, 580, 740, 1000][tier];
  const bx = (W - bw) / 2;
  const wallTop = [0, 126, 116, 112, 104][tier];
  const awY = [0, 168, 162, 160, 156][tier];
  const upperTop = tier === 3 ? 56 : 0;
  return { bw, bx, wallTop, awY, upperTop, roofY: tier === 3 ? upperTop - 14 : wallTop - 14 };
}

interface Geo { bw: number; bx: number; wallTop: number; awY: number; upperTop: number; roofY: number }

function texture(look: DecorLook, x: number, y: number, w: number, h: number, id: string): string {
  const t = look.texture ?? 'plain';
  const clip = `clip-path="url(#${id})"`;
  let s = '';
  if (t === 'brick') for (let r = 0; r * 12 < h; r++) for (let c = -1; c * 30 < w; c++) s += `<rect x="${x + c * 30 + (r % 2) * 15}" y="${y + r * 12}" width="28" height="10" rx="1.5" fill="${look.wall2}" opacity="0.65"/>`;
  if (t === 'wood') for (let c = 0; c * 16 < w; c++) s += `<rect x="${x + c * 16}" y="${y}" width="1.6" height="${h}" fill="#000" opacity="0.12"/>`;
  if (t === 'stone') for (let r = 0; r * 22 < h; r++) for (let c = -1; c * 46 < w; c++) s += `<rect x="${x + c * 46 + (r % 2) * 23}" y="${y + r * 22}" width="44" height="20" rx="3" fill="none" stroke="${look.wall2}" stroke-width="2"/>`;
  if (t === 'tiles') for (let r = 0; r * 14 < h; r++) for (let c = 0; c * 14 < w; c++) if ((r + c) % 2) s += `<rect x="${x + c * 14}" y="${y + r * 14}" width="14" height="14" fill="${look.wall2}" opacity="0.7"/>`;
  if (t === 'glass') {
    for (let c = 0; c * 60 < w; c++) s += `<rect x="${x + c * 60}" y="${y}" width="3" height="${h}" fill="#5b6470" opacity="0.6"/>`;
    for (let r = 1; r * 40 < h; r++) s += `<rect x="${x}" y="${y + r * 40}" width="${w}" height="2" fill="#5b6470" opacity="0.4"/>`;
    s += `<path d="M${x + 40} ${y} l60 0 l-90 ${h} l-60 0 z" fill="#fff" opacity="0.25"/><path d="M${x + w * 0.6} ${y} l30 0 l-90 ${h} l-30 0 z" fill="#fff" opacity="0.2"/>`;
  }
  if (t === 'metal') for (let c = 0; c * 10 < w; c++) s += `<rect x="${x + c * 10}" y="${y}" width="3" height="${h}" fill="${look.wall2}"/>`;
  return s ? `<g ${clip}>${s}</g>` : '';
}

function roof(look: DecorLook, g: Geo): string {
  const { bx, bw, roofY } = g;
  const c = look.roof ?? '#c96f4a';
  const x = bx - 10, w = bw + 20;
  switch (look.roofStyle) {
    case 'tiles': {
      let s = `<rect x="${x}" y="${roofY - 6}" width="${w}" height="22" rx="4" fill="${c}"/>`;
      for (let i = 0; i * 18 < w; i++) s += `<path d="M${x + i * 18} ${roofY + 16} a9 9 0 0 1 18 0" fill="#b5522a"/>`;
      return s;
    }
    case 'wood': {
      let s = `<rect x="${x}" y="${roofY - 6}" width="${w}" height="22" rx="3" fill="${c}"/>`;
      for (let r = 0; r < 2; r++) for (let i = 0; i * 22 < w; i++) s += `<rect x="${x + i * 22 + r * 11}" y="${roofY - 4 + r * 10}" width="20" height="9" rx="2" fill="#000" opacity="0.13"/>`;
      return s;
    }
    case 'green': {
      let s = `<rect x="${x}" y="${roofY}" width="${w}" height="16" rx="5" fill="#7a5a3a"/>`;
      for (let i = 0; i * 26 < w; i++) s += `<ellipse cx="${x + 13 + i * 26}" cy="${roofY + 1}" rx="17" ry="10" fill="${i % 2 ? c : '#79b85c'}"/>`;
      for (let i = 0; i < 6; i++) s += `<circle cx="${x + 30 + i * (w / 6)}" cy="${roofY - 6}" r="3.2" fill="${['#ffd166', '#ff7eb6', '#fff'][i % 3]}"/>`;
      return s;
    }
    case 'slate': {
      let s = `<path d="M${x} ${roofY + 16} L${x + 24} ${roofY - 14} L${x + w - 24} ${roofY - 14} L${x + w} ${roofY + 16} z" fill="${c}"/>`;
      for (let r = 0; r < 3; r++) s += `<rect x="${x + 16 - r * 6}" y="${roofY - 8 + r * 9}" width="${w - 32 + r * 12}" height="1.5" fill="#fff" opacity="0.18"/>`;
      return s;
    }
    case 'metal': {
      let s = `<rect x="${x}" y="${roofY - 4}" width="${w}" height="20" rx="2" fill="${c}"/>`;
      for (let i = 0; i * 12 < w; i++) s += `<rect x="${x + i * 12}" y="${roofY - 4}" width="3" height="20" fill="#fff" opacity="0.18"/>`;
      return s;
    }
    case 'snow': {
      let s = `<path d="M${x} ${roofY + 16} L${x + 20} ${roofY - 12} L${x + w - 20} ${roofY - 12} L${x + w} ${roofY + 16} z" fill="${c}"/>`;
      s += `<rect x="${x + 12}" y="${roofY - 18}" width="${w - 24}" height="11" rx="6" fill="#fff"/>`;
      for (let i = 0; i * 34 < w - 40; i++) s += `<ellipse cx="${x + 30 + i * 34}" cy="${roofY - 8}" rx="8" ry="${5 + (i % 3) * 3}" fill="#fff"/>`;
      s += `<rect x="${x - 2}" y="${roofY + 12}" width="${w + 4}" height="5" rx="2.5" fill="#fff"/>`;
      return s;
    }
    case 'neon':
      return `<rect x="${x}" y="${roofY - 2}" width="${w}" height="18" rx="4" fill="${c}"/><rect x="${x + 4}" y="${roofY + 2}" width="${w - 8}" height="4" rx="2" class="sf-neon" stroke="#ff3fa4" color="#ff3fa4"/>`;
    default:
      return `<rect x="${x + 4}" y="${roofY}" width="${w - 8}" height="16" rx="6" fill="${c}"/>`;
  }
}

function awning(look: DecorLook, g: Geo): string {
  const { bx, bw, awY } = g;
  const a1 = look.aw1 ?? '#2fa36b', a2 = look.aw2 ?? '#fff';
  const x = bx - 12, w = bw + 24;
  if (look.awStyle === 'canopy') {
    let s = `<rect x="${x}" y="${awY}" width="${w}" height="10" rx="3" fill="${a2}" opacity="0.85" stroke="${a1}" stroke-width="2"/>`;
    for (let i = 0; i < 6; i++) s += `<line x1="${x + 20 + i * ((w - 40) / 5)}" y1="${awY + 10}" x2="${x + 20 + i * ((w - 40) / 5)}" y2="${awY - 24}" stroke="${a1}" stroke-width="2"/>`;
    return s;
  }
  if (look.awStyle === 'solid') {
    return `<path d="M${x + 8} ${awY - 6} h${w - 16} l8 22 h-${w} z" fill="${a1}"/><rect x="${x}" y="${awY + 14}" width="${w}" height="6" rx="2" fill="${a2}"/>`;
  }
  const n = Math.round(w / 34);
  const sw = w / n;
  let s = '';
  if (look.awStyle === 'scallop') {
    s += `<rect x="${x}" y="${awY - 4}" width="${w}" height="16" fill="${a1}"/>`;
    for (let i = 0; i < n; i++) s += `<path d="M${x + i * sw} ${awY + 12} a${sw / 2} ${sw / 2.6} 0 0 0 ${sw} 0 z" fill="${i % 2 ? a2 : a1}"/>`;
    return s;
  }
  for (let i = 0; i < n; i++) s += `<path d="M${x + i * sw} ${awY} h${sw} v20 a${sw / 2} ${sw / 2.4} 0 0 1 -${sw} 0 z" fill="${i % 2 ? a2 : a1}"/>`;
  return s;
}

function sign(look: DecorLook, g: Geo, tier: number, lit: number): string {
  const { bx, bw, awY, wallTop, roofY } = g;
  const text = SIGN_NAME[tier];
  const fg = look.signText ?? '#fff', bg = look.sign ?? '#2a2733';
  const style = look.signStyle ?? 'board';
  if (style === 'letters' || (tier === 4 && style !== 'neon')) {
    // Grandes lettres posées sur le toit
    const fs = tier === 4 ? 40 : 30;
    let s = `<rect x="${W / 2 - 230}" y="${roofY - 6}" width="460" height="6" fill="#5b6470"/>`;
    for (let i = 0; i < 8; i++) s += `<rect x="${W / 2 - 210 + i * 60}" y="${roofY - 10}" width="4" height="10" fill="#5b6470"/>`;
    s += `<text x="${W / 2}" y="${roofY - 14}" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="${fs}" letter-spacing="3" fill="${style === 'letters' ? bg : bg}" stroke="#fff" stroke-width="1.5" paint-order="stroke" ${lit ? 'filter="drop-shadow(0 0 6px rgba(255,217,90,.9))"' : ''}>${text}</text>`;
    // Plaque d'entrée
    s += `<rect x="${W / 2 - 80}" y="${awY - 30}" width="160" height="24" rx="8" fill="${bg}"/><text x="${W / 2}" y="${awY - 13}" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="12" fill="${fg}">ENTRÉE</text>`;
    return s;
  }
  const sw = Math.min(bw - 50, [0, 300, 360, 420, 460][tier]);
  const sx = W / 2 - sw / 2;
  const sy = Math.max(wallTop + 6, awY - 40);
  const font = `font-family="Poppins, sans-serif" font-weight="700"`;
  let s = '';
  switch (style) {
    case 'wood':
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="32" rx="6" fill="${bg}"/><rect x="${sx}" y="${sy + 15}" width="${sw}" height="1.5" fill="#000" opacity="0.2"/><circle cx="${sx + 10}" cy="${sy + 16}" r="3" fill="#3d2a1a"/><circle cx="${sx + sw - 10}" cy="${sy + 16}" r="3" fill="#3d2a1a"/>`;
      break;
    case 'lightbox':
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="32" rx="6" fill="${bg}" filter="drop-shadow(0 0 8px rgba(255, 255, 210, .9))"/><rect x="${sx + 4}" y="${sy + 4}" width="${sw - 8}" height="24" rx="4" fill="#fff" opacity="0.14"/>`;
      break;
    case 'gold':
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="34" rx="10" fill="${bg}" stroke="#e9c46a" stroke-width="2.5"/>`;
      break;
    case 'neon':
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="34" rx="12" fill="${bg}"/><rect x="${sx - 5}" y="${sy - 5}" width="${sw + 10}" height="44" rx="15" class="sf-neon" stroke="#ff3fa4" color="#ff3fa4"/>`;
      break;
    case 'retro':
      s += `<path d="M${sx} ${sy + 34} q${sw / 2} -26 ${sw} 0 v-34 q-${sw / 2} -14 -${sw} 0 z" fill="${bg}" stroke="#f4a261" stroke-width="3"/>`;
      break;
    case 'candy':
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="34" rx="17" fill="${bg}" stroke="#fff" stroke-width="3" stroke-dasharray="10 8"/>`;
      break;
    default:
      s += `<rect x="${sx}" y="${sy}" width="${sw}" height="32" rx="10" fill="${bg}"/>`;
  }
  s += `<text x="${W / 2}" y="${sy + 22}" text-anchor="middle" ${font} font-size="${tier === 1 ? 15 : 17}" letter-spacing="2" fill="${fg}" ${style === 'neon' ? 'class="sf-neon-text"' : ''}>${text}</text>`;
  if (lit && style !== 'neon') for (let i = 0; i < 9; i++) s += `<circle cx="${sx + 14 + i * ((sw - 28) / 8)}" cy="${sy - 4}" r="${2 + lit * 0.6}" class="sf-bulb" style="animation-delay:${i * 0.15}s"/>`;
  return s;
}

function windows(look: DecorLook, g: Geo, tier: number, doorW: number, pick: (i: number) => string): string {
  const { bx, bw, awY } = g;
  const gy = awY + 22, gh = G - gy - 10;
  const frame = look.frame ?? '#fff', glass = look.glass ?? '#cdeaf9';
  const style = look.winStyle ?? 'small';
  const sideW = (bw - doorW - 50) / 2;
  const zones = [bx + 18, W / 2 + doorW / 2 + 7];
  // Nombre de vitres par côté selon la taille du magasin et le style
  const per = style === 'full' ? 1 : style === 'large' ? Math.max(1, Math.round(sideW / 170)) : Math.max(1, Math.round(sideW / 110));
  let s = '';
  zones.forEach((zx, side) => {
    const ww = (sideW - (per - 1) * 10) / per;
    for (let k = 0; k < per; k++) {
      const x = zx + k * (ww + 10);
      const small = style === 'small' || style === 'shutters' || style === 'retro';
      const y = small ? gy + 8 : gy;
      const h = small ? gh - 22 : gh;
      if (style === 'arched') {
        const r = Math.min(ww / 2, h * 0.4);
        s += `<path d="M${x} ${y + h} v-${h - r} a${ww / 2} ${r} 0 0 1 ${ww} 0 v${h - r} z" fill="${glass}" stroke="${frame}" stroke-width="4"/>`;
      }
      else if (style === 'retro') s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="${Math.min(ww, h) / 2}" fill="${glass}" stroke="${frame}" stroke-width="6"/>`;
      else s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="${style === 'full' ? 2 : 7}" fill="${glass}" stroke="${frame}" stroke-width="${style === 'wood' ? 7 : style === 'neon' ? 3 : 4}" ${style === 'neon' ? `class="sf-neon" color="${frame}"` : ''}/>`;
      if (style === 'neon') s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="7" fill="${glass}" opacity="0.55"/>`;
      // Étagères et produits
      const rows = h > 70 ? 2 : 1;
      const cols = Math.max(1, Math.floor(ww / 34));
      for (let r = 0; r < rows; r++) {
        const sy = y + 34 + r * 32;
        s += `<rect x="${x + 6}" y="${sy}" width="${ww - 12}" height="4" rx="2" class="sf-shelf"/>`;
        for (let c = 0; c < cols; c++) s += `<text x="${x + 6 + (c + 0.5) * ((ww - 12) / cols)}" y="${sy - 3}" font-size="19" text-anchor="middle">${pick(side * 40 + k * 10 + r * cols + c)}</text>`;
      }
      s += `<path d="M${x + 10} ${y + 6} l22 0 l-18 ${h - 12} l-10 0 z" class="sf-shine"/>`;
      if (style === 'shutters') {
        for (const sx of [x - 16, x + ww + 2]) {
          s += `<rect x="${sx}" y="${y - 2}" width="14" height="${h + 4}" rx="2" fill="${frame}"/>`;
          for (let i = 0; i < 6; i++) s += `<rect x="${sx + 2}" y="${y + 4 + i * ((h - 6) / 6)}" width="10" height="2" fill="#000" opacity="0.15"/>`;
        }
      }
    }
  });
  return s;
}

function door(look: DecorLook, g: Geo, tier: number): { svg: string; w: number } {
  const { awY } = g;
  const style = look.doorStyle ?? 'wood';
  const c = look.door ?? '#9a6b43';
  const w = style === 'sliding' || style === 'revolving' || style === 'double' ? (tier >= 4 ? 120 : 92) : 60;
  const x = W / 2 - w / 2, y = awY + 22, h = G - y;
  const open = `<rect x="${W / 2 - 22}" y="${y + 8}" width="44" height="14" rx="4" class="sf-open"/><text x="${W / 2}" y="${y + 18.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff" font-family="Poppins, sans-serif">OUVERT</text>`;
  let s = '';
  switch (style) {
    case 'glass':
      s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c}"/><rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 5}" rx="3" class="sf-glass"/><rect x="${x + w - 14}" y="${y + h / 2}" width="4" height="18" rx="2" fill="#dfe6ec"/>`;
      break;
    case 'arch':
      s = `<path d="M${x} ${G} v-${h - w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - w / 2} z" fill="${c}"/><path d="M${x + 8} ${G - 30} v-${h - w / 2 - 22} a${w / 2 - 8} ${w / 2 - 8} 0 0 1 ${w - 16} 0 v${h - w / 2 - 22} z" class="sf-glass"/><circle cx="${x + w - 12}" cy="${y + h / 1.7}" r="3" fill="#f5c451"/>`;
      break;
    case 'double':
      s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/><rect x="${W / 2 - 1}" y="${y}" width="2" height="${h}" fill="#000" opacity="0.4"/>`;
      for (const px of [x + 6, W / 2 + 4]) s += `<rect x="${px}" y="${y + 6}" width="${w / 2 - 10}" height="${h * 0.45}" rx="3" class="sf-glass"/><rect x="${px + 4}" y="${y + h * 0.58}" width="${w / 2 - 18}" height="${h * 0.32}" rx="3" fill="none" stroke="#e9c46a" stroke-width="1.5"/>`;
      s += `<circle cx="${W / 2 - 8}" cy="${y + h * 0.55}" r="2.6" fill="#e9c46a"/><circle cx="${W / 2 + 8}" cy="${y + h * 0.55}" r="2.6" fill="#e9c46a"/>`;
      break;
    case 'sliding':
      s = `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 8}" rx="4" fill="${c}"/>`;
      s += `<rect x="${x}" y="${y}" width="${w / 2 - 2}" height="${h}" class="sf-glass" opacity="0.9"/><rect x="${W / 2 + 2}" y="${y}" width="${w / 2 - 2}" height="${h}" class="sf-glass" opacity="0.9"/>`;
      s += `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="8" fill="#2fa36b"/><text x="${W / 2}" y="${y - 1.5}" text-anchor="middle" font-size="7" fill="#fff" font-family="Poppins, sans-serif" font-weight="700">← AUTO →</text>`;
      return { svg: s, w: w + 16 };
    case 'revolving':
      s = `<path d="M${x - 6} ${G} v-${h - 10} a${w / 2 + 6} 18 0 0 1 ${w + 12} 0 v${h - 10} z" fill="${c}"/><rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" rx="4" class="sf-glass"/>`;
      s += `<line x1="${W / 2}" y1="${y + 6}" x2="${W / 2}" y2="${G}" stroke="${c}" stroke-width="3"/><line x1="${x + 10}" y1="${y + 20}" x2="${x + w - 10}" y2="${G - 6}" stroke="${c}" stroke-width="2.5"/><line x1="${x + w - 10}" y1="${y + 20}" x2="${x + 10}" y2="${G - 6}" stroke="${c}" stroke-width="2.5"/>`;
      return { svg: s + open.replace(`y="${y + 8}"`, `y="${y - 10}"`).replace(`y="${y + 18.5}"`, `y="${y - 0.5}"`), w: w + 12 };
    case 'candy':
      s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2.4}" fill="${c}"/><rect x="${x + 7}" y="${y + 24}" width="${w - 14}" height="${h - 34}" rx="${w / 3}" class="sf-glass"/>`;
      for (let i = 0; i < 4; i++) s += `<circle cx="${x + 10 + i * ((w - 20) / 3)}" cy="${y + 10}" r="4" fill="#fff"/>`;
      break;
    case 'chalet':
      s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/>`;
      for (let i = 1; i < 4; i++) s += `<rect x="${x + i * (w / 4)}" y="${y}" width="1.5" height="${h}" fill="#000" opacity="0.25"/>`;
      s += `<path d="M${x + 6} ${y + 30} l${w - 12} ${h - 44} M${x + w - 6} ${y + 30} l-${w - 12} ${h - 44}" stroke="#000" stroke-opacity="0.25" stroke-width="3"/><rect x="${x + w / 2 - 12}" y="${y + 6}" width="24" height="18" rx="9" class="sf-glass"/>`;
      break;
    default:
      s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${c}"/><rect x="${x + 7}" y="${y + 26}" width="${w - 14}" height="${h - 50}" rx="4" class="sf-glass"/><rect x="${x + w - 14}" y="${y + h / 2}" width="4" height="14" rx="2" fill="#f5c451"/>`;
  }
  return { svg: s + open, w };
}

function ground(look: DecorLook, tier: number): string {
  const pave = look.pave ?? '#d9d2c4', road = look.road ?? '#8e8f99';
  const style = look.solStyle ?? 'asphalt';
  let s = `<rect y="${G}" width="${W}" height="${H - G}" fill="${pave}"/>`;
  const band = (fn: (x: number, i: number) => string, step: number) => Array.from({ length: Math.ceil(W / step) + 1 }, (_, i) => fn(i * step, i)).join('');
  if (style === 'cobble') s += band((x, i) => `<rect x="${x + (i % 2) * 6}" y="${G + 3}" width="18" height="8" rx="4" fill="#000" opacity="0.08"/><rect x="${x + 9}" y="${G + 13}" width="18" height="8" rx="4" fill="#000" opacity="0.08"/>`, 24);
  if (style === 'terracotta') s += band((x) => `<rect x="${x + 1}" y="${G + 1}" width="20" height="20" fill="#c97a4f"/>`, 22);
  if (style === 'checker') s += band((x, i) => `<rect x="${x}" y="${G}" width="12" height="11" fill="${i % 2 ? '#2a2733' : '#fdf6e3'}"/><rect x="${x}" y="${G + 11}" width="12" height="11" fill="${i % 2 ? '#fdf6e3' : '#2a2733'}"/>`, 12);
  if (style === 'deck') s += band((x) => `<rect x="${x}" y="${G}" width="2" height="22" fill="#000" opacity="0.15"/>`, 26) + `<rect y="${G + 10}" width="${W}" height="1.5" fill="#000" opacity="0.1"/>`;
  if (style === 'snow') s += band((x, i) => `<ellipse cx="${x}" cy="${G + 2}" rx="${30 + (i % 3) * 10}" ry="6" fill="#fff"/>`, 70);
  if (style === 'marble') s += band((x) => `<path d="M${x} ${G + 4} q20 8 40 2 t40 10" stroke="#cbbfb0" stroke-width="1.2" fill="none"/>`, 80);
  s += `<rect y="${G + 22}" width="${W}" height="${H - G - 22}" fill="${road}"/>`;
  if (style === 'parking' || tier === 4) {
    s += band((x) => `<rect x="${x}" y="${G + 26}" width="3" height="28" fill="#fff" opacity="0.8"/>`, 70);
    const cars = ['🚗', '🚙', '🚕', '🚐'];
    for (let i = 0; i < (style === 'parking' ? 7 : 3); i++) s += `<text x="${80 + i * 150}" y="${G + 50}" font-size="26" text-anchor="middle">${cars[i % 4]}</text>`;
  } else {
    s += Array.from({ length: 12 }, (_, i) => `<rect x="${i * 110 + 20}" y="${G + 38}" width="54" height="5" rx="2" class="sf-roadline"/>`).join('');
  }
  return s;
}

function decoration(look: DecorLook, g: Geo, doorW: number): string {
  const { bx, bw } = g;
  const L = bx - 46, R = bx + bw + 46;
  const dl = W / 2 - doorW / 2 - 26, dr = W / 2 + doorW / 2 + 26;
  const e = (x: number, emoji: string, size = 28) => `<text x="${x}" y="${G - 2}" font-size="${size}" text-anchor="middle">${emoji}</text>`;
  switch (look.decoStyle) {
    case 'plants': return e(dl, '🪴') + e(dr, '🪴');
    case 'crates': {
      const crate = (x: number, fruit: string) => `<g transform="translate(${x - 23} ${G - 30})"><rect width="46" height="30" rx="3" fill="#c79a62"/><rect y="9" width="46" height="4" fill="#a87b48"/><rect y="20" width="46" height="4" fill="#a87b48"/><text x="23" y="2" font-size="18" text-anchor="middle">${fruit}${fruit}</text></g>`;
      return crate(L + 10, '🍎') + crate(L - 42, '🥕') + crate(R - 10, '🍋') + crate(R + 42, '🥬');
    }
    case 'bench': return `<g transform="translate(${L - 50} ${G - 26})"><rect width="64" height="7" rx="3" fill="#b9825a"/><rect x="6" y="7" width="5" height="19" fill="#7c5a40"/><rect x="53" y="7" width="5" height="19" fill="#7c5a40"/><rect y="-14" width="64" height="6" rx="3" fill="#b9825a"/></g><rect x="${R}" y="${G - 120}" width="5" height="120" rx="2" fill="#5b6470"/><circle cx="${R + 2.5}" cy="${G - 124}" r="9" fill="#ffe08a"/>`;
    case 'lavender': {
      let s = '';
      for (const x of [dl - 6, dr + 6]) {
        s += `<rect x="${x - 14}" y="${G - 22}" width="28" height="22" rx="4" fill="#c96f4a"/>`;
        for (let k = 0; k < 7; k++) s += `<ellipse cx="${x - 12 + k * 4}" cy="${G - 34 - (k % 3) * 5}" rx="3" ry="9" fill="#9b7fd4"/>`;
      }
      return s + e(L, '🌻', 30) + e(R, '🌻', 30);
    }
    case 'candy': {
      let s = '';
      for (const [x, c] of [[L, '#ff7eb6'], [R, '#7c4dff']] as [number, string][]) {
        s += `<rect x="${x - 2}" y="${G - 70}" width="4" height="70" fill="#fff" stroke="#e6d6e0"/><circle cx="${x}" cy="${G - 80}" r="18" fill="${c}"/><path d="M${x - 12} ${G - 80} a12 12 0 0 1 24 0" fill="none" stroke="#fff" stroke-width="4"/>`;
      }
      return s + e(dr, '🍬', 22);
    }
    case 'snowman': return e(R, '⛄', 40) + `<ellipse cx="${L}" cy="${G + 2}" rx="60" ry="9" fill="#fff"/>` + e(L, '🎄', 40);
    case 'jukebox': return e(R + 10, '🛵', 36) + e(L - 6, '📻', 30) + e(dr, '🥤', 22);
    case 'fountain': return `<g transform="translate(${L - 10} ${G})"><ellipse cx="0" cy="-6" rx="44" ry="10" fill="#dcd3c4"/><rect x="-40" y="-14" width="80" height="10" rx="4" fill="#cfc4b2"/><rect x="-5" y="-48" width="10" height="36" fill="#cfc4b2"/><path d="M0 -50 q-14 -20 -24 8 M0 -50 q14 -20 24 8" stroke="#7cc8f8" stroke-width="3" fill="none" class="sf-water"/></g>` + e(R, '🌳', 40);
    case 'flags': {
      let s = '';
      ['#ff9f43', '#2fa36b', '#4dabf7'].forEach((c, i) => {
        const x = L - 60 + i * 34;
        s += `<rect x="${x}" y="${G - 110}" width="3" height="110" fill="#8a96a3"/><path d="M${x + 3} ${G - 108} h30 l-6 9 l6 9 h-30 z" fill="${c}" class="sf-flag"/>`;
      });
      return s;
    }
    case 'carts': return `<rect x="${R - 40}" y="${G - 46}" width="96" height="6" rx="2" fill="#2fa36b"/><rect x="${R - 38}" y="${G - 40}" width="3" height="40" fill="#8a96a3"/><rect x="${R + 50}" y="${G - 40}" width="3" height="40" fill="#8a96a3"/>` + e(R - 18, '🛒', 26) + e(R + 6, '🛒', 26) + e(R + 30, '🛒', 26);
    case 'palms': return `<g class="sf-neon-palm">${e(L, '🌴', 54)}${e(R, '🌴', 54)}</g>` + `<rect x="${L - 30}" y="${G - 4}" width="60" height="4" rx="2" class="sf-neon" stroke="#49f2ff" color="#49f2ff"/>`;
    default: return '';
  }
}

function lighting(look: DecorLook, g: Geo): string {
  const { bx, bw, awY, wallTop } = g;
  const style = look.lightStyle ?? 'none';
  let s = '';
  if (style === 'garland' || style === 'fairy') {
    const n = Math.round(bw / 30);
    const y = awY + 24;
    s += `<path d="M${bx} ${y} ${Array.from({ length: n }, (_, i) => `Q${bx + (i + 0.5) * (bw / n)} ${y + 10} ${bx + (i + 1) * (bw / n)} ${y}`).join(' ')}" fill="none" stroke="#5b6470" stroke-width="1.2"/>`;
    const colors = style === 'fairy' ? ['#ff7eb6', '#c8f7e1', '#ffd166', '#b197fc'] : ['#ffd95a'];
    for (let i = 0; i < n; i++) s += `<circle cx="${bx + (i + 0.5) * (bw / n)}" cy="${y + 6}" r="${style === 'fairy' ? 3 : 4}" fill="${colors[i % colors.length]}" class="sf-bulb" style="animation-delay:${(i % 5) * 0.2}s"/>`;
  }
  if (style === 'lanterns') for (const x of [bx + 30, bx + bw - 30]) s += `<g transform="translate(${x} ${awY + 30})"><rect x="-1.5" y="-14" width="3" height="14" fill="#8a6a3a"/><rect x="-10" width="20" height="26" rx="4" fill="#ffe8a3" stroke="#b08a3e" stroke-width="2" class="sf-lantern"/></g>`;
  if (style === 'neon') s += `<rect x="${bx + 4}" y="${wallTop + 2}" width="${bw - 8}" height="${G - wallTop - 6}" rx="10" class="sf-neon" stroke="#ff3fa4" color="#ff3fa4"/>`;
  if (style === 'spots') for (let i = 0; i < 5; i++) {
    const x = bx + 40 + i * ((bw - 80) / 4);
    s += `<path d="M${x} ${G} l-26 -${G - wallTop} h52 z" fill="#fff8d6" opacity="0.18"/><rect x="${x - 7}" y="${G - 6}" width="14" height="6" rx="2" fill="#5b6470"/>`;
  }
  return s;
}

export interface StorefrontOptions { preview?: string; level?: number; look?: DecorLook }

export function storefrontSvg(state: GameState, opts: StorefrontOptions = {}): string {
  const level = opts.level ?? state.level;
  const tier = tierOf(level);
  const look = opts.look ?? decorLook(state, opts.preview);
  const g = geometry(tier);
  const { bx, bw, wallTop, awY, upperTop, roofY } = g;
  const weather = weatherFor(state).icon;
  const [sky1, sky2] = look.sky ?? SKIES[weather] ?? SKIES['⛅'];
  // Identifiant provisoire : remplacé à la fin (sert aussi à reconnaître un dessin identique).
  const id = '§';
  const lit = up(state, 'sign');
  const billboard = up(state, 'billboard');
  const emojis = [...assortment(state)].map((pid) => PRODUCT_BY_ID[pid]?.emoji).filter(Boolean);
  const pick = (i: number) => (emojis.length ? emojis[i % emojis.length] : '📦');

  let skyline = '';
  for (let i = 0; i < 16; i++) {
    const w = 60 + ((i * 37) % 50), h = 50 + ((i * 53) % 90), x = i * 78 - 20;
    skyline += `<rect x="${x}" y="${G - h}" width="${w}" height="${h}" rx="4" class="sf-far"/>`;
    for (let k = 0; k < 3; k++) skyline += `<rect x="${x + 10 + k * 16}" y="${G - h + 12}" width="8" height="10" rx="2" class="sf-far-win"/>`;
  }
  let sky = '';
  if (look.sky && look.sky[0] === '#1b1440') for (let i = 0; i < 40; i++) sky += `<circle cx="${(i * 149) % W}" cy="${(i * 53) % 130 + 8}" r="${i % 3 ? 1.2 : 2}" class="sf-star" style="animation-delay:${(i % 7) * 0.35}s"/>`;
  if (weather === '☀️' || weather === '🔥') sky += `<circle cx="1080" cy="56" r="${weather === '🔥' ? 44 : 32}" fill="#ffd95a" class="sf-sun"/>`;
  sky += `<g class="sf-cloud slow"><ellipse cx="260" cy="50" rx="55" ry="16"/><ellipse cx="295" cy="40" rx="34" ry="16"/></g>`;
  if (weather !== '☀️' && weather !== '🔥') sky += `<g class="sf-cloud"><ellipse cx="900" cy="44" rx="70" ry="22"/><ellipse cx="950" cy="32" rx="44" ry="20"/></g>`;
  if (weather === '🌧️' || weather === '🌦️') for (let i = 0; i < (weather === '🌧️' ? 46 : 20); i++) sky += `<line x1="${(i * 97) % W}" y1="${(i * 41) % 200}" x2="${((i * 97) % W) - 6}" y2="${((i * 41) % 200) + 16}" class="sf-rain" style="animation-delay:${(i % 9) * 0.11}s"/>`;
  if (weather === '❄️') for (let i = 0; i < 40; i++) sky += `<circle cx="${(i * 131) % W}" cy="${(i * 67) % 240}" r="2.4" class="sf-snow" style="animation-delay:${(i % 8) * 0.3}s"/>`;

  const wall = look.wall ?? '#fff6e6', wall2 = look.wall2 ?? '#f6e7cb';
  let building = '';
  // Étage du mini-marché
  if (tier === 3) {
    const ux = bx + 20, uw = bw - 40;
    building += `<clipPath id="up${id}"><rect x="${ux}" y="${upperTop}" width="${uw}" height="${wallTop - upperTop + 4}"/></clipPath>`;
    building += `<rect x="${ux}" y="${upperTop}" width="${uw}" height="${wallTop - upperTop + 4}" fill="${wall2}"/>${texture(look, ux, upperTop, uw, wallTop - upperTop + 4, `up${id}`)}`;
    const n = Math.floor(uw / 90);
    for (let i = 0; i < n; i++) {
      const x = ux + 24 + i * ((uw - 48 - 44) / Math.max(1, n - 1));
      building += `<rect x="${x}" y="${upperTop + 12}" width="44" height="32" rx="5" fill="${look.glass ?? '#bfe3f7'}" stroke="${look.frame ?? '#fff'}" stroke-width="3"/>`;
    }
  }
  // Rez-de-chaussée
  building += `<clipPath id="gr${id}"><rect x="${bx}" y="${wallTop}" width="${bw}" height="${G - wallTop}" rx="10"/></clipPath>`;
  building += `<rect x="${bx}" y="${wallTop}" width="${bw}" height="${G - wallTop}" rx="10" fill="${wall}"/>${texture(look, bx, wallTop, bw, G - wallTop, `gr${id}`)}`;
  if (tier === 4) building += `<rect x="${bx}" y="${wallTop}" width="${bw}" height="14" fill="${wall2}"/>`;
  const d = door(look, g, tier);
  const win = windows(look, g, tier, d.w, pick);

  let street = '';
  const tree = (x: number, s = 1) => `<rect x="${x - 4}" y="${G - 44 * s}" width="8" height="${44 * s}" rx="3" fill="#9a6b43"/><circle cx="${x}" cy="${G - 60 * s}" r="${28 * s}" class="sf-tree"/><circle cx="${x - 16 * s}" cy="${G - 46 * s}" r="${18 * s}" class="sf-tree"/><circle cx="${x + 16 * s}" cy="${G - 46 * s}" r="${18 * s}" class="sf-tree"/>`;
  if (tier <= 3) {
    if (level >= 2) street += tree(Math.max(60, bx - 130), 0.9);
    if (level >= 4) street += tree(Math.min(W - 60, bx + bw + 140));
  }
  if (billboard >= 1) street += `<g transform="translate(${tier === 4 ? 20 : Math.min(W - 170, bx + bw + 150)} ${G - 150})"><rect x="34" y="60" width="7" height="90" fill="#5b6470"/><rect x="104" y="60" width="7" height="90" fill="#5b6470"/><rect width="146" height="72" rx="8" fill="#fff" stroke="#ff9f43" stroke-width="5"/><text x="73" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="#2b2a33" font-family="Poppins, sans-serif">MA SUPÉRETTE</text><text x="73" y="56" text-anchor="middle" font-size="${14 + billboard * 2}">📣 ${'⭐'.repeat(billboard)}</text></g>`;

  const svg = `<svg class="storefront" data-key="§KEY§" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" style="--sf-aw1:${look.aw1 ?? '#2fa36b'};--sf-glass:${look.glass ?? '#cdeaf9'}" aria-label="Façade du magasin : ${['', 'épicerie', 'supérette', 'mini-marché', 'supermarché'][tier]}">
    <defs><linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky${id})"/>${sky}${skyline}
    ${ground(look, tier)}
    ${roof(look, g)}${building}${win}${d.svg}${awning(look, g)}${sign(look, g, tier, lit)}${lighting(look, g)}${decoration(look, g, d.w)}${street}
  </svg>`;
  // Clé du dessin : identique si rien n'a changé → l'interface réutilise l'ancien dessin.
  let h = 5381;
  for (let k = 0; k < svg.length; k++) h = ((h * 33) ^ svg.charCodeAt(k)) >>> 0;
  return svg.replace('§KEY§', `${h.toString(36)}-${svg.length}`).replaceAll('§', String(++uid));
}
