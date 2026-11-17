// Écran « Façade » : personnalisation du magasin avec des éléments à gagner.
import {
  DECOR_BALANCE, DECOR_BY_ID, tierWithArticle, DECOR_PARTS, DECOR_SLOTS, MILESTONES, THEMES, TIERS, tierName, tierOf, type DecorPart, type DecorSlot,
} from '../../data/decor';
import type { GameState } from '../../state/types';
import { store } from '../../state/store';
import { saveGame } from '../../state/save';
import {
  applyTheme, canEquip, charmSummary, equipPart, equippedPart, isOutdated, milestoneValue, ownsPart, partCharm, unlockProgress, unlockText,
} from '../../systems/decor';
import { on } from '../actions';
import { sfx } from '../audio';
import { badge, esc, gauge, num, num1 } from '../dom';
import { storefrontSvg } from '../storefront';
import { toast } from '../toast';
import { ui } from '../uiState';

const stars = (n: number) => (n <= 0 ? '<span class="muted small">—</span>' : `<span class="stars" title="${n} point${n > 1 ? 's' : ''} de charme">${'★'.repeat(Math.min(6, Math.round(n)))}</span>`);

/** Nombre d'éléments gagnés pas encore vus (pastille du menu). */
export const unseenDecor = (state: GameState) => state.decor.owned.filter((id) => !state.decor.seen.includes(id) && DECOR_BY_ID[id]?.unlock.kind !== 'start').length;

function partCard(state: GameState, p: DecorPart): string {
  const owned = ownsPart(state, p.id);
  const equipped = state.decor.equipped[p.slot] === p.id;
  const err = canEquip(state, p.id);
  const tooBig = owned && p.tier > tierOf(state.level);
  const isNew = owned && !state.decor.seen.includes(p.id) && p.unlock.kind !== 'start';
  const prog = owned ? null : unlockProgress(state, p.unlock);
  const outdated = owned && isOutdated(state, p);
  const theme = THEMES[p.theme];
  return `<button class="part-card ${equipped ? 'on' : ''} ${owned ? '' : 'locked'} ${ui.decorPreview === p.id ? 'previewing' : ''}" data-act="decor-pick" data-arg="${p.id}">
    <span class="part-top"><span class="part-emoji">${owned ? p.emoji : '🔒'}</span>${isNew ? badge('Nouveau', 'orange') : ''}${equipped ? badge('Équipé', 'green') : ''}</span>
    <b class="part-name">${esc(p.name)}</b>
    <span class="part-meta">${theme.emoji} ${esc(theme.name)} · ${esc(tierName(p.tier))}</span>
    <span class="part-charm">${stars(partCharm(state, p))}${outdated ? ` ${badge('Démodé', 'orange')}` : ''}</span>
    ${owned
      ? tooBig ? `<span class="small muted">Disponible quand tu seras ${esc(tierWithArticle(p.tier))}</span>`
        : equipped ? '<span class="small pos">Sur ta façade</span>' : '<span class="small muted">Toucher pour équiper</span>'
      : `<span class="small muted">${esc(unlockText(p.unlock))}</span>${prog !== null ? gauge(prog * 100, 'purple') : ''}`}
    ${err && owned && !tooBig ? `<span class="small neg">${esc(err)}</span>` : ''}
  </button>`;
}

export function renderDecor(state: GameState): string {
  const sum = charmSummary(state);
  const tier = tierOf(state.level);
  const next = TIERS.find((t) => t.tier === tier + 1);
  const slot = ui.decorSlot as DecorSlot;
  const parts = DECOR_PARTS.filter((p) => p.slot === slot).sort((a, b) => a.tier - b.tier || a.charm - b.charm);
  const preview = ui.decorPreview ? DECOR_BY_ID[ui.decorPreview] : null;
  const ownedCount = state.decor.owned.length;
  const themeBonus = sum.bestTheme && sum.bestTheme.mult > 1 ? sum.bestTheme : null;

  return `
  <div class="screen-head">
    <div><h1>🎨 Façade</h1><p class="muted">Personnalise ton magasin avec les éléments que tu gagnes en progressant. Une belle façade attire des clients et fait monter ta réputation. Quand ton magasin change de statut, son architecture change, et les éléments trop modestes deviennent démodés.</p></div>
  </div>

  <section class="decor-hero card">
    <div class="decor-preview">${storefrontSvg(state, { preview: ui.decorPreview ?? undefined })}
      ${preview ? `<div class="preview-banner">👀 Aperçu : <b>${esc(preview.name)}</b>${ownsPart(state, preview.id) ? '' : ` · à gagner : ${esc(unlockText(preview.unlock))}`}<button class="btn sm ghost" data-act="decor-preview-off">Revenir à ma façade</button></div>` : ''}
    </div>
    <div class="decor-stats">
      <div class="decor-stat"><span class="kpi-label">Charme</span><b>${num1(sum.total)}</b><span class="small muted">${themeBonus ? `dont bonus ${THEMES[themeBonus.theme].emoji} ×${themeBonus.mult}` : `${sum.themeCounts[0] ? `${sum.themeCounts[0].count} éléments ${THEMES[sum.themeCounts[0].theme].name}` : ''}`}</span></div>
      <div class="decor-stat"><span class="kpi-label">Clients en plus</span><b class="pos">+${num1(sum.traffic * 100)} %</b><span class="small muted">max +${Math.round(DECOR_BALANCE.TRAFFIC_MAX * 100)} %</span></div>
      <div class="decor-stat"><span class="kpi-label">Réputation</span><b class="pos">+${num1(sum.rep)}</b><span class="small muted">par jour</span></div>
      <div class="decor-stat"><span class="kpi-label">Collection</span><b>${ownedCount}<small> / ${DECOR_PARTS.length}</small></b>${gauge((ownedCount / DECOR_PARTS.length) * 100, 'purple')}</div>
    </div>
    ${sum.outdated.length ? `<div class="banner orange small">⚠️ Démodé pour ${esc(tierWithArticle(tier))} : ${sum.outdated.map((p) => `${p.emoji} ${esc(p.name)}`).join(', ')}. Ces éléments ne comptent qu’à moitié : remplace-les par des éléments plus récents.</div>` : ''}
    ${next ? `<p class="small muted">🏗️ Au niveau ${next.minLevel}, ton magasin deviendra <b>${esc(tierWithArticle(next.tier))}</b> : nouvelle architecture et nouveaux éléments.</p>` : ''}
  </section>

  <section class="card">
    <div class="card-head"><h2>🏗️ Évolution de ton magasin</h2><span class="muted small">Ta façade suit ton statut</span></div>
    <div class="tier-row">${TIERS.map((t) => `<div class="tier-card ${t.tier === tier ? 'on' : ''} ${t.tier > tier ? 'future' : ''}">
      <span class="tier-preview">${storefrontSvg(state, { level: t.minLevel })}</span>
      <b>${t.emoji} ${t.name}</b><span class="small muted">${t.tier === tier ? 'Statut actuel' : t.tier > tier ? `Dès le niveau ${t.minLevel}` : 'Déjà dépassé'}</span>
    </div>`).join('')}</div>
  </section>

  <section class="card">
    <div class="chips slot-chips">${DECOR_SLOTS.map((s) => {
      const eq = equippedPart(state, s.id);
      const fresh = DECOR_PARTS.some((p) => p.slot === s.id && ownsPart(state, p.id) && !state.decor.seen.includes(p.id) && p.unlock.kind !== 'start');
      return `<button class="chip ${slot === s.id ? 'on' : ''}" data-act="decor-slot" data-arg="${s.id}">${s.emoji} ${s.name}<span class="chip-eq">${eq.emoji}</span>${fresh ? '<i class="dot"></i>' : ''}</button>`;
    }).join('')}</div>
    <div class="part-grid">${parts.map((p) => partCard(state, p)).join('')}</div>
  </section>

  <section class="card">
    <div class="card-head"><h2>🎭 Thèmes</h2><span class="muted small">4 éléments d’un même thème : charme ×${DECOR_BALANCE.THEME_BONUS[1][1]} · 6 éléments : ×${DECOR_BALANCE.THEME_BONUS[0][1]}</span></div>
    <div class="theme-grid">${Object.entries(THEMES).map(([id, t]) => {
      const all = DECOR_PARTS.filter((p) => p.theme === id && p.charm > 0);
      const got = all.filter((p) => ownsPart(state, p.id));
      const wearing = sum.themeCounts.find((c) => c.theme === id)?.count ?? 0;
      return `<div class="theme-card"><b>${t.emoji} ${esc(t.name)}</b><span class="small muted">${got.length} / ${all.length} gagnés · ${wearing} porté${wearing > 1 ? 's' : ''}</span>${gauge((got.length / all.length) * 100, 'purple')}
        <button class="btn sm ${got.length ? 'ghost' : ''}" data-act="decor-theme" data-arg="${id}" ${got.length ? '' : 'disabled'}>Porter ce thème</button></div>`;
    }).join('')}</div>
  </section>

  <section class="card">
    <div class="card-head"><h2>🏆 Succès</h2><span class="muted small">Ils font gagner des éléments de façade</span></div>
    <div class="milestones">${MILESTONES.map((m) => {
      const v = milestoneValue(state, m);
      const done = v >= m.target;
      const rewards = DECOR_PARTS.filter((p) => p.unlock.kind === 'milestone' && p.unlock.id === m.id);
      return `<div class="objective ${done ? 'done' : ''}"><span class="obj-icon">${done ? '✅' : m.emoji}</span><div class="obj-main">
        <div class="obj-label">${esc(m.label)}</div>${done ? '' : gauge((v / m.target) * 100, 'blue')}
        <div class="obj-reward">${done ? 'Réussi' : `${num(Math.min(v, m.target))} / ${num(m.target)}`} · Récompense : ${rewards.map((p) => `${p.emoji} ${esc(p.name)}`).join(', ')}</div></div></div>`;
    }).join('')}</div>
  </section>`;
}

/** Marque les éléments de l'emplacement affiché comme vus (sans redessiner). */
export function markSlotSeen(state: GameState): void {
  const ids = DECOR_PARTS.filter((p) => p.slot === ui.decorSlot && ownsPart(state, p.id) && !state.decor.seen.includes(p.id)).map((p) => p.id);
  if (ids.length) { state.decor.seen.push(...ids); saveGame(state); }
}

on('decor-slot', (s) => { markSlotSeen(store.state); ui.decorSlot = s; ui.decorPreview = null; store.commit(); });
on('decor-pick', (id) => {
  const state = store.state;
  const p = DECOR_BY_ID[id];
  if (!p) return;
  if (!ownsPart(state, id) || p.tier > tierOf(state.level)) {
    ui.decorPreview = ui.decorPreview === id ? null : id;
    store.commit();
    document.querySelector('.decor-hero')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  const err = equipPart(state, id);
  if (err) return toast(err, 'error');
  ui.decorPreview = null;
  sfx.success();
  toast(`🎨 ${esc(p.name)} installé${p.slot === 'porte' || p.slot === 'facade' || p.slot === 'enseigne' ? 'e' : ''} · charme ${num1(charmSummary(state).total)}`, 'success');
  store.commit();
});
on('decor-preview-off', () => { ui.decorPreview = null; store.commit(); });
on('decor-theme', (id) => {
  const n = applyTheme(store.state, id);
  if (!n) return toast('Aucun élément de ce thème n’est encore disponible pour ton statut.', 'error');
  ui.decorPreview = null;
  sfx.success();
  toast(`🎭 Thème ${esc(THEMES[id].name)} : ${n} élément${n > 1 ? 's' : ''} installé${n > 1 ? 's' : ''}.`, 'success');
  store.commit();
});
