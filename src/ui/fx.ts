// Effets visuels : confettis, compteurs animés, texte flottant.

export function confetti(durationMs = 2600): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d');
  if (!c) { canvas.remove(); return; }
  const W = (canvas.width = window.innerWidth);
  const H = (canvas.height = window.innerHeight);
  const colors = ['#2fa36b', '#ff9f43', '#ffd166', '#ef6f6c', '#4dabf7', '#b197fc'];
  const parts = Array.from({ length: 160 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H * 0.35 + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3,
    s: 5 + Math.random() * 7, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (now: number) => {
    const el = now - t0;
    c.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - el / durationMs);
      c.translate(p.x, p.y); c.rotate(p.r);
      c.fillStyle = p.color;
      c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      c.restore();
    }
    if (el < durationMs) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Anime un nombre de `from` à `to` dans un élément. */
export function animateNumber(el: HTMLElement, from: number, to: number, fmt: (v: number) => string, ms = 700): void {
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Anime tous les éléments [data-count] d'un conteneur (de 0 à leur valeur). */
export function runCounters(root: ParentNode, fmtMap: Record<string, (v: number) => string>): void {
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
    const to = Number(el.dataset.count);
    const fmt = fmtMap[el.dataset.fmt ?? 'num'] ?? ((v: number) => String(Math.round(v)));
    el.textContent = fmt(0);
    setTimeout(() => animateNumber(el, 0, to, fmt, 900), i * 60);
  });
}

/** Petit texte qui s'envole (pièces à la vente). */
export function floatText(container: HTMLElement, text: string, className = ''): void {
  const el = document.createElement('span');
  el.className = `float-text ${className}`;
  el.textContent = text;
  el.style.left = `${10 + Math.random() * 75}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
