// Écran 8 : paramètres.
import type { GameState } from '../../state/types';
import { store } from '../../state/store';
import { on } from '../actions';
import { sfx } from '../audio';
import { confirmDialog } from '../modal';
import { toast } from '../toast';
import { ui } from '../uiState';
import { cloudCard } from '../cloud';
import { cloudUser } from '../../cloud/sync';
import { canPromptInstall, isIos, isStandalone, promptInstall } from '../install';

function installCard(): string {
  if (isStandalone()) return `<section class="card"><div class="card-head"><h2>📲 Application</h2></div><p class="muted">Ma Supérette est installée sur cet appareil. Elle fonctionne aussi hors ligne.</p></section>`;
  const body = canPromptInstall()
    ? `<p class="muted">Ajoute le jeu à ton écran d’accueil : il s’ouvre en plein écran, comme une vraie application, et fonctionne hors ligne.</p>
       <button class="btn primary" data-act="install-app">📲 Installer l’application</button>`
    : isIos()
      ? `<p class="muted">Sur iPhone ou iPad, dans Safari : touche <b>Partager</b> <span aria-hidden="true">⬆️</span> puis <b>« Sur l’écran d’accueil »</b>.</p>`
      : `<p class="muted">Ouvre le jeu dans Chrome, Edge ou Safari depuis son adresse web, puis utilise <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b> dans le menu du navigateur.</p>`;
  return `<section class="card"><div class="card-head"><h2>📲 Installer sur mobile</h2></div>${body}</section>`;
}

export function renderSettings(state: GameState): string {
  const s = state.settings;
  const toggle = (key: string, onState: boolean, label: string, desc: string) => `
    <div class="setting"><div><b>${label}</b><p class="muted small">${desc}</p></div>
      <button class="switch ${onState ? 'on' : ''}" data-act="setting-toggle" data-arg="${key}" role="switch" aria-checked="${onState}" aria-label="${label}"><i></i></button></div>`;
  return `
  <div class="screen-head"><div><h1>⚙️ Paramètres</h1><p class="muted">La partie est sauvegardée automatiquement dans ce navigateur (fin de journée et à chaque achat).</p></div></div>
  <div class="settings-grid">
    <section class="card">
      <div class="card-head"><h2>Confort de jeu</h2></div>
      <div class="setting"><div><b>Vitesse de simulation par défaut</b><p class="muted small">Modifiable aussi pendant la journée.</p></div>
        <div class="tabs">${[1, 2, 4].map((v) => `<button class="${s.speed === v ? 'on' : ''}" data-act="setting-speed" data-arg="${v}">x${v}</button>`).join('')}</div></div>
      ${toggle('sound', s.sound, 'Sons', 'Caisse enregistreuse, notifications, passage de niveau.')}
      <div class="setting"><div><b>Animations du décor</b><p class="muted small">Nuages, pluie, ampoules de l’enseigne… « Auto » les coupe sur téléphone et tablette pour un jeu plus fluide et moins gourmand en batterie.</p></div>
        <div class="tabs">${(['auto', 'full', 'reduced'] as const).map((v) => `<button class="${(s.fx ?? 'auto') === v ? 'on' : ''}" data-act="setting-fx" data-arg="${v}">${{ auto: 'Auto', full: 'Activées', reduced: 'Coupées' }[v]}</button>`).join('')}</div></div>
      ${toggle('dark', s.dark, 'Mode sombre', 'Pour gérer ta supérette tard le soir.')}
      ${toggle('tutorial', !state.tutorialOff, 'Conseils de démarrage', 'Affiche les infobulles d’aide pendant les 5 premiers jours.')}
    </section>
    <section class="card">
      <div class="card-head"><h2>Sauvegarde</h2></div>
      <div class="setting"><div><b>Nouvelle partie</b><p class="muted small">Recommence au jour 1 en conservant tes réglages.</p></div>
        <button class="btn ghost" data-act="new-game">🔄 Nouvelle partie</button></div>
      <div class="setting"><div><b>Réinitialiser</b><p class="muted small">Efface la sauvegarde et tous les réglages de ce navigateur.</p></div>
        <button class="btn danger" data-act="reset-game">🗑️ Réinitialiser</button></div>
      <p class="muted small">Dernière sauvegarde : jour ${state.day}, ${state.phase === 'morning' ? 'matin' : 'bilan'}.</p>
    </section>
    ${cloudCard()}
    ${installCard()}
  </div>`;
}

on('install-app', async () => {
  const ok = await promptInstall();
  if (ok) toast('📲 Application installée : retrouve-la sur ton écran d’accueil.', 'success');
  store.commit();
});
on('setting-fx', (v) => { store.state.settings.fx = v as 'auto' | 'full' | 'reduced'; store.commit(); });
on('setting-speed', (v) => { store.state.settings.speed = Number(v); store.commit(); });
on('setting-toggle', (key) => {
  const st = store.state;
  if (key === 'sound') st.settings.sound = !st.settings.sound;
  if (key === 'dark') st.settings.dark = !st.settings.dark;
  if (key === 'tutorial') st.tutorialOff = !st.tutorialOff;
  store.commit();
  sfx.click();
});
on('new-game', () => confirmDialog('Nouvelle partie ?', `Ta partie en cours sera remplacée. Tes réglages (son, thème, vitesse) sont conservés.${cloudUser() ? ' ⚠️ Tu es connecté : la partie en ligne sera aussi remplacée sur tous tes appareils.' : ''}`, 'Recommencer', () => {
  ui.screen = 'dashboard';
  store.newGame();
  toast('🏪 Nouvelle partie : bonne chance !', 'success');
}));
on('reset-game', () => confirmDialog('Tout réinitialiser ?', `La sauvegarde et tous les réglages seront effacés définitivement.${cloudUser() ? ' ⚠️ Tu es connecté : la partie en ligne sera aussi remplacée sur tous tes appareils.' : ''}`, 'Tout effacer', () => {
  ui.screen = 'dashboard';
  store.reset();
  toast('Sauvegarde effacée. Nouvelle partie lancée.', 'info');
}, true));
