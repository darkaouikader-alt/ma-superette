// Graphique SVG : chiffre d'affaires (barres) et bénéfice (courbe) sur les 14 derniers jours.
import { WEEKDAYS } from '../data/constants';
import type { DayReport } from '../state/types';
import { money0 } from './dom';

export function revenueChart(history: DayReport[]): string {
  const data = history.slice(-14);
  if (!data.length) {
    return `<div class="chart-empty">📊 Le graphique apparaîtra après ta première journée.</div>`;
  }
  const W = 720, H = 230, padL = 46, padB = 26, padT = 14, padR = 8;
  const max = Math.max(50, ...data.map((d) => d.revenue));
  const min = Math.min(0, ...data.map((d) => d.profit));
  const span = max - min;
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / span);
  const bw = (W - padL - padR) / 14;
  const x = (i: number) => padL + i * bw;
  const ticks = [0, max / 2, max];
  const grid = ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end" class="chart-axis">${money0(t)}</text>`).join('');
  const bars = data.map((d, i) => {
    const h = Math.max(2, y(0) - y(d.revenue));
    return `<g class="chart-bar"><rect x="${x(i) + bw * 0.18}" y="${y(d.revenue)}" width="${bw * 0.64}" height="${h}" rx="5" style="animation-delay:${i * 30}ms"/>
      <title>Jour ${d.day} — CA ${money0(d.revenue)} · bénéfice ${money0(d.profit)}</title>
      <text x="${x(i) + bw / 2}" y="${H - 8}" text-anchor="middle" class="chart-axis">${WEEKDAYS[(d.day - 1) % 7][0]}${d.day}</text></g>`;
  }).join('');
  const pts = data.map((d, i) => `${x(i) + bw / 2},${y(d.profit)}`).join(' ');
  const dots = data.map((d, i) => `<circle cx="${x(i) + bw / 2}" cy="${y(d.profit)}" r="3.5" class="chart-dot ${d.profit < 0 ? 'neg' : ''}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Chiffre d'affaires des 14 derniers jours">
    ${grid}${bars}<polyline points="${pts}" class="chart-line"/>${dots}</svg>
    <div class="chart-legend"><span><i class="lg-bar"></i>Chiffre d'affaires</span><span><i class="lg-line"></i>Bénéfice</span></div>`;
}

/** Mini-courbe des ventes récentes (7 jours). */
export function sparkline(values: number[]): string {
  const v = values.slice(-7);
  if (v.length < 2) return '<span class="muted small">—</span>';
  const max = Math.max(1, ...v);
  const W = 64, H = 22;
  const pts = v.map((n, i) => `${(i / (v.length - 1)) * W},${H - 2 - (n / max) * (H - 4)}`).join(' ');
  const half = Math.floor(v.length / 2);
  const a = v.slice(0, half).reduce((s, n) => s + n, 0) / Math.max(1, half);
  const b = v.slice(half).reduce((s, n) => s + n, 0) / Math.max(1, v.length - half);
  const trend = b > a * 1.1 ? 'up' : b < a * 0.9 ? 'down' : 'flat';
  const arrow = { up: '↗', down: '↘', flat: '→' }[trend];
  return `<span class="spark ${trend}"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}"/></svg><b>${arrow}</b></span>`;
}
