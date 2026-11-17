// Animation de la journée : rejoue la timeline produite par systems/simulation.ts.
// Aucune interaction pendant la journée, hormis Pause et la vitesse.
import { BALANCE, WEEKDAYS } from '../data/constants';
import { PRODUCT_BY_ID } from '../data/products';
import { store } from '../state/store';
import { saveGame } from '../state/save';
import type { DayOutcome, SimEvent } from '../systems/simulation';
import { activeEvents, weatherFor } from '../systems/events';
import { on } from './actions';
import { sfx } from './audio';
import { $, esc, gauge, money, num, pastille } from './dom';
import { floatText } from './fx';

interface Run {
  outcome: DayOutcome; onDone: () => void;
  elapsed: number; last: number; idx: number; paused: boolean; speed: number; done: boolean;
  shelf: Record<string, number>; cap: Record<string, number>;
  customers: number; revenue: number; items: number; lost: number;
}
let run: Run | null = null;

function controls(r: Run): string {
  return `<button class="btn ghost sm" data-act="sim-pause">${r.paused ? '▶️ Reprendre' : '⏸️ Pause'}</button>
    <div class="tabs sm">${[1, 2, 4].map((v) => `<button class="${r.speed === v ? 'on' : ''}" data-act="sim-speed" data-arg="${v}">x${v}</button>`).join('')}</div>`;
}

export function playDay(outcome: DayOutcome, onDone: () => void): void {
  const state = store.state;
  const day = outcome.report.day;
  const root = document.getElementById('overlay-root')!;
  lastText.clear();
  const pids = Object.keys(outcome.opening).sort((a, b) => PRODUCT_BY_ID[a].cat.localeCompare(PRODUCT_BY_ID[b].cat));
  run = {
    outcome, onDone, elapsed: 0, last: performance.now(), idx: 0, paused: false, speed: state.settings.speed, done: false,
    shelf: Object.fromEntries(pids.map((id) => [id, outcome.opening[id].qty])),
    cap: Object.fromEntries(pids.map((id) => [id, outcome.opening[id].cap])),
    customers: 0, revenue: 0, items: 0, lost: 0,
  };
  const events = activeEvents(state, day);
  root.innerHTML = `<div class="overlay sim"><div class="sim-card">
    <header class="sim-head">
      <div><h2>Jour ${day} · ${WEEKDAYS[(day - 1) % 7]}</h2>
        <span class="muted">${weatherFor(state, day).icon} Magasin ouvert${events.length ? ` · ${events.map((e) => `${e.emoji} ${esc(e.name)}`).join(' · ')}` : ''}</span></div>
      <div class="sim-clock" id="sim-clock">08:00</div>
      <div class="sim-controls" id="sim-controls">${controls(run)}</div>
    </header>
    <div class="sim-progress" id="sim-progress"><i></i><span class="sim-track"><span>🛒</span></span></div>
    <div class="sim-body">
      <div class="sim-left">
        <div class="sim-counters">
          <div><span>Clients servis</span><b id="sc-customers">0</b></div>
          <div><span>Chiffre d'affaires</span><b id="sc-revenue" class="pos">0,00 €</b></div>
          <div><span>Articles vendus</span><b id="sc-items">0</b></div>
          <div><span>Ventes manquées</span><b id="sc-lost">0</b></div>
        </div>
        <div class="sim-feed-wrap"><div class="sim-coins" id="sim-coins"></div><ul class="sim-feed" id="sim-feed"><li class="muted">Les premiers clients arrivent…</li></ul></div>
      </div>
      <div class="sim-right">
        <h3>Rayons en direct</h3>
        <div class="sim-shelves">${pids.map((id) => {
          const p = PRODUCT_BY_ID[id];
          return `<div class="sim-shelf" id="sg-${id}">${pastille(p, 'sm')}<span class="sim-shelf-name">${esc(p.name)}</span>${gauge((run!.shelf[id] / Math.max(1, run!.cap[id])) * 100)}<b>${run!.shelf[id]}</b></div>`;
        }).join('') || '<p class="muted">Aucun produit en rayon…</p>'}</div>
      </div>
    </div>
  </div></div>`;
  progressBar = root.querySelector<HTMLElement>('#sim-progress > i');
  progressCart = root.querySelector<HTMLElement>('#sim-progress .sim-track');
  progressWidth = root.querySelector<HTMLElement>('#sim-progress')?.getBoundingClientRect().width ?? 0;
  lastTick = -1;
  requestAnimationFrame(frame);
}

function updateShelf(r: Run, pid: string): void {
  const el = document.getElementById(`sg-${pid}`);
  if (!el) return;
  const qty = Math.max(0, r.shelf[pid] ?? 0);
  const pct = (qty / Math.max(1, r.cap[pid] ?? 1)) * 100;
  const g = el.querySelector<HTMLElement>('.gauge');
  const bar = el.querySelector<HTMLElement>('.gauge i');
  if (bar) bar.style.setProperty('--p', (pct / 100).toFixed(3));
  if (g) g.className = `gauge ${pct <= 15 ? 'red' : pct <= 40 ? 'orange' : 'green'}`;
  el.querySelector('b')!.textContent = String(qty);
  el.classList.toggle('out', qty === 0);
}

function feed(html: string, cls = ''): void {
  const ul = document.getElementById('sim-feed');
  if (!ul) return;
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = html;
  ul.prepend(li);
  while (ul.children.length > 9) ul.lastElementChild?.remove();
}

function apply(r: Run, ev: SimEvent): void {
  if (ev.restock) {
    for (const [pid, q] of Object.entries(ev.restock)) { r.shelf[pid] = q; updateShelf(r, pid); }
    feed('🧑‍🔧 Ton employé regarnit les rayons.', 'restock');
    return;
  }
  const amount = ev.sales.reduce((s, x) => s + x.amount, 0);
  for (const s of ev.sales) { r.shelf[s.pid] = (r.shelf[s.pid] ?? 0) - s.qty; r.items += s.qty; updateShelf(r, s.pid); }
  if (ev.sales.length) {
    r.customers++;
    r.revenue += amount;
    const items = ev.sales.slice(0, 6).map((s) => `${PRODUCT_BY_ID[s.pid].emoji}${s.qty > 1 ? `<small>×${s.qty}</small>` : ''}`).join(' ');
    feed(`<span class="feed-items">🧑 ${items}${ev.sales.length > 6 ? ' …' : ''}</span><b class="pos">+${money(amount)}</b>`);
    const coins = document.getElementById('sim-coins');
    if (coins && coins.children.length < 6) floatText(coins, `${amount >= 10 ? '💶' : '🪙'} +${money(amount)}`);
    sfx.cash();
  }
  if (ev.missed.length || ev.refused.length) {
    r.lost += ev.missed.length + ev.refused.length;
    if (ev.missed.length) feed(`<span class="feed-items">😕 Introuvable : ${ev.missed.slice(0, 5).map((id) => PRODUCT_BY_ID[id].emoji).join(' ')}</span>`, 'miss');
    if (ev.refused.length) feed(`<span class="feed-items">💸 Trop cher : ${ev.refused.slice(0, 5).map((id) => PRODUCT_BY_ID[id].emoji).join(' ')}</span>`, 'miss');
  }
}

const lastText = new Map<string, string>();
let progressBar: HTMLElement | null = null;
let progressCart: HTMLElement | null = null;
let progressWidth = 0;
let lastTick = -1;
/** Met à jour un texte seulement s'il a changé. Retourne true en cas de changement. */
function setText(sel: string, text: string): boolean {
  if (lastText.get(sel) === text) return false;
  lastText.set(sel, text);
  const el = $(sel);
  if (el) el.textContent = text;
  return true;
}

function frame(now: number): void {
  const r = run;
  if (!r || r.done) return;
  const dt = Math.min(100, now - r.last);
  r.last = now;
  if (!r.paused) r.elapsed += dt * r.speed;
  const t = Math.min(1, r.elapsed / BALANCE.SIM_DURATION_MS);
  const tl = r.outcome.timeline;
  while (r.idx < tl.length && tl[r.idx].t <= t) apply(r, tl[r.idx++]);
  const minutes = Math.round((8 + t * 12) * 60);
  // On n'écrit dans la page que ce qui a changé (moins de travail pour le navigateur).
  setText('#sim-clock', `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor((minutes % 60) / 5) * 5).padStart(2, '0')}`);
  // Barre et caddie déplacés par « transform » directement (pas de recalcul du reste de la page)
  const tk = Math.round(t * 400);
  if (tk !== lastTick) {
    lastTick = tk;
    if (progressBar) progressBar.style.transform = `scaleX(${t.toFixed(4)})`;
    if (progressCart) progressCart.style.transform = `translateX(${(t * progressWidth).toFixed(1)}px)`;
  }
  setText('#sc-customers', num(r.customers));
  setText('#sc-revenue', money(r.revenue));
  setText('#sc-items', num(r.items));
  if (setText('#sc-lost', num(r.lost))) $('#sc-lost')!.classList.toggle('neg', r.lost > 0);
  if (t >= 1) {
    r.done = true;
    feed('🌙 Fermeture du magasin… on fait les comptes !', 'restock');
    setTimeout(() => { run = null; r.onDone(); }, 700);
    return;
  }
  requestAnimationFrame(frame);
}

on('sim-pause', () => {
  if (!run) return;
  run.paused = !run.paused;
  $('#sim-controls')!.innerHTML = controls(run);
});
on('sim-speed', (v) => {
  if (!run) return;
  run.speed = Number(v);
  store.state.settings.speed = run.speed;
  saveGame(store.state);
  $('#sim-controls')!.innerHTML = controls(run);
});
