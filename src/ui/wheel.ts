// Roue de la fortune : carte du tableau de bord, fenêtre avec la roue animée, comptes à rebours.
import { BOOST_LABEL, WHEEL_PRIZES } from '../data/wheel';
import { store } from '../state/store';
import type { GameState } from '../state/types';
import { activeBoosts, boostDaysLeft, canSpin, spinCooldown, spinWheel } from '../systems/wheel';
import { on } from './actions';
import { sfx } from './audio';
import { esc, money0 } from './dom';
import { confetti } from './fx';
import { openModal } from './modal';
import { toast } from './toast';

/** « 2 h 05 », « 37 min », « 1 j 4 h ». */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} j ${h % 24} h`;
}

/** « encore aujourd’hui », « encore 2 journées ». */
const daysText = (n: number) => (n <= 1 ? 'encore aujourd’hui' : `encore ${n} journées`);

export function wheelCard(state: GameState): string {
  const ready = canSpin(state);
  const boosts = activeBoosts(state);
  return `<section class="card wheel-card ${ready ? 'ready' : ''}" id="wheel-card">
    <div class="card-head"><h2>🎡 Roue de la fortune</h2><span class="muted small">1 tour par heure</span></div>
    ${ready
      ? '<button class="btn primary block pulse" data-act="wheel-open">🎡 Tourner la roue !</button>'
      : `<button class="btn ghost block" data-act="wheel-open">Prochain tour dans <b data-countdown="${Date.now() + spinCooldown(state)}">${formatDuration(spinCooldown(state))}</b></button>`}
    ${boosts.length ? `<ul class="boost-list">${boosts.map((b) => `<li><span>${BOOST_LABEL[b.kind]}</span><span class="small muted">${daysText(boostDaysLeft(state, b))}</span></li>`).join('')}</ul>` : '<p class="small muted">Cagnottes et bonus temporaires (clients, expérience, prix d’achat…) qui durent de 1 à 3 journées de jeu.</p>'}
  </section>`;
}

const SEG = 360 / WHEEL_PRIZES.length;
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
};

function wheelSvg(): string {
  const parts = WHEEL_PRIZES.map((p, i) => {
    const a0 = i * SEG - SEG / 2, a1 = a0 + SEG;
    return `<path d="M100 100 L${polar(a0, 96)} A96 96 0 0 1 ${polar(a1, 96)} Z" fill="${p.color}" stroke="#fff" stroke-width="2"/>
      <g transform="rotate(${i * SEG} 100 100)"><text x="100" y="27" text-anchor="middle" font-size="16">${p.emoji}</text>
      <text x="100" y="57" transform="rotate(90 100 57)" text-anchor="middle" dominant-baseline="central" font-size="7.2" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">${esc(p.short)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" class="wheel-svg" aria-hidden="true">${parts}<circle cx="100" cy="100" r="16" fill="#fff" stroke="#e8e0d2" stroke-width="3"/><text x="100" y="105" text-anchor="middle" font-size="13">🎁</text></svg>`;
}

function modalBody(state: GameState): string {
  const ready = canSpin(state);
  return `<div class="wheel-wrap">
      <div class="wheel-pointer" aria-hidden="true">▼</div>
      <div class="wheel-disk" id="wheel-disk">${wheelSvg()}</div>
    </div>
    <div class="wheel-result" id="wheel-result" aria-live="polite">
      ${ready ? '<p class="muted">Tente ta chance : les bonus durent de 1 à 3 journées de jeu.</p>' : `<p class="muted">Prochain tour dans <b data-countdown="${Date.now() + spinCooldown(state)}">${formatDuration(spinCooldown(state))}</b>.</p>`}
    </div>
    <button class="btn primary xl block" id="wheel-spin" data-act="wheel-spin" ${ready ? '' : 'disabled'}>🎡 Tourner</button>
    <details class="wheel-odds"><summary class="small muted">Voir les lots et leurs chances</summary>
      <ul>${WHEEL_PRIZES.map((p) => `<li><span>${p.emoji} <b>${esc(p.label)}</b> — ${esc(p.desc)}</span><span class="small muted">${Math.round((p.weight / WHEEL_PRIZES.reduce((s, x) => s + x.weight, 0)) * 100)} %</span></li>`).join('')}</ul>
    </details>`;
}

let rotation = 0;
let spinning = false;

on('wheel-open', () => {
  rotation = 0;
  openModal({ title: '🎡 Roue de la fortune', body: modalBody(store.state), className: 'wheel-modal' });
});

on('wheel-spin', () => {
  if (spinning) return;
  const result = spinWheel(store.state);
  if (typeof result === 'string') { toast(result, 'error'); return; }
  spinning = true;
  // Enregistré tout de suite (pas de nouveau tour en rechargeant la page).
  store.commit();
  (document.getElementById('wheel-spin') as HTMLButtonElement | null)?.setAttribute('disabled', '');
  const disk = document.getElementById('wheel-disk');
  const jitter = (Math.random() - 0.5) * SEG * 0.6;
  rotation += 360 * 6 + (360 - ((rotation % 360) + result.index * SEG) % 360) + jitter;
  if (disk) disk.style.transform = `rotate(${rotation}deg)`;
  sfx.click();
  const reveal = () => {
    spinning = false;
    const p = result.prize;
    const box = document.getElementById('wheel-result');
    if (box) box.innerHTML = `<p class="wheel-win">${p.emoji} <b>${esc(p.label)}</b>${result.cash ? ` : +${money0(result.cash)}` : ''}</p><p class="small muted">${esc(p.desc)}</p>`;
    if (p.id === 'jackpot') confetti(3000); else confetti(1200);
    sfx.success();
    toast(`🎡 ${p.emoji} ${esc(p.label)}${result.cash ? ` : +${money0(result.cash)}` : ''}`, 'success');
    store.commit();
  };
  if (disk && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) disk.addEventListener('transitionend', reveal, { once: true });
  else reveal();
});

/** Met à jour les comptes à rebours chaque 20 s ; redessine quand un délai se termine. */
export function startWheelTicker(onExpired: () => void): void {
  setInterval(() => {
    let expired = false;
    document.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
      const left = Number(el.dataset.countdown) - Date.now();
      if (left <= 0) expired = true;
      else el.textContent = formatDuration(left);
    });
    if (expired && !spinning) onExpired();
  }, 20_000);
}
