// Sons légers générés avec Web Audio (aucun fichier). Coupables dans les paramètres.
import { store } from '../state/store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.06): void {
  if (!store.state?.settings.sound) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* audio indisponible */ }
}

/** Petite vibration (téléphones Android), seulement si le son est activé. */
function buzz(pattern: number | number[]): void {
  if (!store.state?.settings.sound) return;
  try { navigator.vibrate?.(pattern); } catch { /* non pris en charge */ }
}

let lastCash = 0;
export const sfx = {
  click: () => tone(520, 0, 0.06, 'triangle', 0.03),
  /** Caisse enregistreuse (limité à ~8 par seconde). */
  cash: () => {
    const now = performance.now();
    if (now - lastCash < 120) return;
    lastCash = now;
    tone(1320, 0, 0.08, 'triangle', 0.035);
    tone(1760, 0.06, 0.12, 'triangle', 0.03);
  },
  notify: () => { tone(660, 0, 0.12); tone(880, 0.1, 0.18); },
  error: () => {
    buzz([30, 40, 30]); tone(220, 0, 0.15, 'sawtooth', 0.03); tone(180, 0.1, 0.2, 'sawtooth', 0.03); },
  success: () => { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.2); },
  level: () => {
    buzz([60, 50, 60, 50, 120]);
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.05));
  },
  open: () => {
    buzz(25); tone(784, 0, 0.15); tone(1047, 0.15, 0.3); },
};
