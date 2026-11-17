// Écran 6 : améliorations et licences.
import { CATEGORIES, CATEGORY_BY_ID } from '../../data/categories';
import { BALANCE } from '../../data/constants';
import { PRODUCTS } from '../../data/products';
import { UPGRADES, UPGRADE_BY_ID, type UpgradeDef } from '../../data/upgrades';
import type { CategoryId, GameState } from '../../state/types';
import { store } from '../../state/store';
import { checkoutCapacity, up } from '../../systems/economy';
import { buyLicence, buyUpgrade, categoryLevel, upgradeCost } from '../../systems/progression';
import { stockerRefills } from '../../systems/stock';
import { on } from '../actions';
import { sfx } from '../audio';
import { badge, catPastille, esc, gauge, money0 } from '../dom';
import { toast } from '../toast';
import { BRANCHES, type BranchDef } from '../../data/branches';
import { levelDef } from '../../data/levels';
import { branchIncomeOf, buyBranch, dailyBranchIncome, ownedBranches, ownsBranch } from '../../systems/branches';
import { confetti } from '../fx';
import { shopsSection } from '../shops';

function upgradeCard(state: GameState, u: UpgradeDef): string {
  const lvl = up(state, u.id);
  const cost = upgradeCost(state, u.id);
  const locked = state.level < u.minLevel;
  const maxed = cost === null;
  const afford = !maxed && state.cash >= cost;
  let extra = '';
  if (u.id === 'cashier') extra = `Capacité actuelle : ${checkoutCapacity(state)} clients/jour${!maxed ? ` → ${BALANCE.CHECKOUT_CAPACITY[lvl + 1]}` : ''}`;
  if (u.id === 'stocker' && lvl > 0) extra = `Regarnissages : ${stockerRefills(state)} par jour${!maxed ? ` → ${BALANCE.STOCKER_REFILL_COUNT[lvl + 1]}` : ''}`;
  if (u.salary) extra += `${extra ? ' · ' : ''}Salaire : ${u.salary} €/jour${u.costs.length > 1 ? ' par niveau' : ''}`;
  return `<div class="card upgrade ${locked ? 'locked' : ''} ${maxed ? 'maxed' : ''}">
    <div class="up-head">${catPastille(u.emoji, 150, 'lg')}<div><h3>${esc(u.name)}</h3>${u.costs.length > 6 ? `<div class="pips-text"><span class="small muted">Niveau ${lvl} / ${u.costs.length}</span>${gauge((lvl / u.costs.length) * 100, 'green')}</div>` : `<div class="pips">${u.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`}</div></div>
    <p class="muted">${esc(u.desc)}</p>
    <p class="up-effect">➜ ${esc(u.effect)}</p>
    ${extra ? `<p class="small muted">${extra}</p>` : ''}
    <div class="up-foot">
      ${locked ? badge(`🔒 Niveau ${u.minLevel} requis`, 'grey')
        : maxed ? badge('✔ Au maximum', 'green')
        : `<button class="btn ${afford ? 'primary' : 'ghost'} block" data-act="buy-upgrade" data-arg="${u.id}" ${afford ? '' : 'disabled'}>${lvl === 0 ? 'Acheter' : 'Améliorer'} · ${money0(cost!)}</button>`}
    </div>
  </div>`;
}

function licenceCard(state: GameState, cat: CategoryId): string {
  const c = CATEGORY_BY_ID[cat];
  const owned = state.licences.includes(cat);
  const reqLevel = categoryLevel(cat);
  const locked = state.level < reqLevel;
  const afford = state.cash >= c.licence!;
  const prods = PRODUCTS.filter((p) => p.cat === cat);
  const needs = prods.some((p) => p.storage === 'fridge') ? 'Nécessite un réfrigérateur.' : prods.some((p) => p.storage === 'freezer') ? 'Nécessite un congélateur.' : '';
  return `<div class="card upgrade ${locked ? 'locked' : ''} ${owned ? 'maxed' : ''}">
    <div class="up-head">${catPastille(c.emoji, c.hue, 'lg')}<div><h3>Licence ${esc(c.name)}</h3><div class="up-emojis">${prods.slice(0, 7).map((p) => p.emoji).join(' ')}</div></div></div>
    <p class="muted">Autorise la vente de ${prods.length} produits. ${needs}</p>
    <div class="up-foot">
      ${owned ? badge('✔ Acquise', 'green') : locked ? badge(`🔒 Niveau ${reqLevel} requis`, 'grey')
        : `<button class="btn ${afford ? 'primary' : 'ghost'} block" data-act="buy-licence" data-arg="${cat}" ${afford ? '' : 'disabled'}>Acheter · ${money0(c.licence!)}</button>`}
    </div>
  </div>`;
}

export function renderUpgrades(state: GameState): string {
  const groups = [...new Set(UPGRADES.map((u) => u.group))];
  return `
  <div class="screen-head">
    <div><h1>🛠️ Améliorations</h1><p class="muted">Investis tes bénéfices pour agrandir le magasin affiché, embaucher, ouvrir de nouveaux rayons et de nouveaux magasins.</p></div>
  </div>
  ${groups.map((g) => `<h2 class="group-title">${g}</h2><section class="upgrade-grid">${UPGRADES.filter((u) => u.group === g).map((u) => upgradeCard(state, u)).join('')}</section>`).join('')}
  <h2 class="group-title">Licences de vente</h2>
  <section class="upgrade-grid">${CATEGORIES.filter((c) => c.licence).map((c) => licenceCard(state, c.id)).join('')}</section>
  ${shopsSection(state)}
  <h2 class="group-title">🏢 Succursales</h2>
  <p class="muted small group-note">Ouvre d’autres magasins avec ta trésorerie : chacun te verse un revenu chaque soir (plus ta réputation est haute, plus il rapporte) et te fait gagner de l’expérience.${ownedBranches(state).length ? ` Aujourd’hui : <b class="pos">+${money0(dailyBranchIncome(state))} par jour</b>.` : ''}</p>
  <section class="upgrade-grid">${BRANCHES.map((b) => branchCard(state, b)).join('')}</section>`;
}

function branchCard(state: GameState, b: BranchDef): string {
  const owned = ownsBranch(state, b.id);
  const locked = state.level < b.minLevel;
  const income = branchIncomeOf(b, state);
  const afford = state.cash >= b.cost;
  return `<div class="card upgrade ${locked ? 'locked' : ''} ${owned ? 'maxed' : ''}">
    <div class="up-head">${catPastille(b.emoji, 210, 'lg')}<div><h3>${esc(b.name)}</h3><span class="small muted">📍 ${esc(b.city)}</span></div></div>
    <p class="up-effect">➜ +${money0(income)} par jour</p>
    <p class="small muted">${owned ? 'Ouverte : elle te verse son revenu chaque soir.' : `Rentabilisée en ${Math.ceil(b.cost / income)} jours environ (selon ta réputation).`}</p>
    <div class="up-foot">${owned ? badge('✔ Ouverte', 'green')
      : locked ? badge(`🔒 Niveau ${b.minLevel} requis (${esc(levelDef(b.minLevel).name)})`, 'grey')
      : `<button class="btn ${afford ? 'primary' : 'ghost'} block" data-act="buy-branch" data-arg="${b.id}" ${afford ? '' : 'disabled'}>Ouvrir · ${money0(b.cost)}</button>`}</div>
  </div>`;
}

on('buy-branch', (id) => {
  const err = buyBranch(store.state, id);
  if (err) return toast(err, 'error');
  sfx.level();
  confetti(1800);
  toast(`🏢 Succursale ouverte : ${esc(BRANCHES.find((b) => b.id === id)!.name)} ! Premier revenu ce soir.`, 'success');
  store.commit();
});

on('buy-upgrade', (id) => {
  const err = buyUpgrade(store.state, id);
  if (err) return toast(err, 'error');
  sfx.success();
  toast(`🛠️ ${UPGRADE_BY_ID[id].name} : ${UPGRADE_BY_ID[id].effect}.`, 'success');
  store.commit();
});
on('buy-licence', (cat) => {
  const err = buyLicence(store.state, cat as CategoryId);
  if (err) return toast(err, 'error');
  sfx.success();
  toast(`📜 Licence ${CATEGORY_BY_ID[cat as CategoryId].name} acquise : commande tes premiers produits !`, 'success');
  store.commit();
});
