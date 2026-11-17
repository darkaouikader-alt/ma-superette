# 🏪 Ma Supérette

Jeu de gestion de supérette en navigateur, 100 % en français. Pas de gameplay d'action : on fixe ses prix,
on commande, on remplit ses rayons, on ouvre le magasin et on lit son bilan, jour après jour.

## Installation et lancement

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # vérification TypeScript + build de production dans dist/
npm run preview    # sert le build de production
npm test           # tests unitaires (demande, péremption, commandes, sauvegarde)
npm run simulate   # bot d'équilibrage : joue 10 jours sans interface
npm run preview -- --host   # teste la version mobile depuis un téléphone du même réseau
```

Le bot accepte des paramètres : `npm run simulate -- 60 1.3` joue 60 jours avec tous les prix à 130 % du
marché ; `npm run simulate -- 10 1 lazy` ignore les essentiels. Pratique pour vérifier un réglage.

Prérequis : Node 18+. Aucune dépendance à l'exécution (Vite, TypeScript et Vitest en développement uniquement).

## Version mobile (application installable)

Le jeu est une **PWA** : sur téléphone, il s'affiche comme une application (barre d'onglets en bas,
listes en cartes, fenêtres qui montent du bas, bilan en plein écran) et peut s'installer sur l'écran
d'accueil. Après la première visite, il fonctionne **hors ligne** (service worker `public/sw.js`).

Pour l'installer, il faut que le dossier `dist/` soit servi en HTTPS, par exemple :

- **Netlify Drop** : `npm run build`, puis glisser le dossier `dist/` sur https://app.netlify.com/drop ;
- **GitHub Pages** : publier le contenu de `dist/` sur la branche `gh-pages` d'un dépôt ;
- n'importe quel hébergement statique (le build utilise des chemins relatifs, il marche dans un sous-dossier).

Ensuite, sur le téléphone :
- **Android (Chrome)** : menu ⋮ → « Installer l'application », ou bouton « 📲 Installer » dans Paramètres ;
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

Fichiers concernés : `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` (régénérer les PNG
avec `node scripts/make-icons.cjs` après avoir modifié `icon.svg`), `src/ui/install.ts`.

Version « une seule page » (tout inliné, pratique pour un partage rapide) :
`npm run build && node scripts/build-single.mjs` → `dist-single/ma-superette.html`.

## Comment jouer

1. **Matin** : commande du stock (onglet Commandes), remplis les rayons, ajuste les prix, lis les infos du jour.
2. **« Ouvrir le magasin »** : la journée se déroule seule (vitesse x1 / x2 / x4, pause).
3. **Bilan** : chiffre d'affaires, marge, charges, clients déçus, ruptures, périmés, réputation, objectifs.

La partie est sauvegardée automatiquement dans `localStorage`. Touche **D** : mode debug (formules de
demande produit par produit, plus deux boutons de triche pour tester).

## Promotions

- **Promotions** (Prix → onglet Promotions) : choisis une réduction (−10 à −40 %) et une durée (1, 3 ou 7 jours).
  Le produit se vend mieux (prix plus bas + mise en avant ×1,3) et chaque promo attire +3 % de clients
  (max +15 %). Jusqu'à 2 promos en même temps, une de plus tous les 2 niveaux. Les promos sur les
  essentiels rapportent un peu de réputation. Réglages : bloc `PROMO_*` de `data/constants.ts`.
- **Campagnes** : prospectus, dégustation, radio, réseaux sociaux (`data/campaigns.ts`) — coût immédiat,
  bonus de clients pendant quelques jours.

## Façade (éléments à gagner)

Onglet **🎨 Façade** : 9 emplacements (façade, toit, auvent, enseigne, porte, vitrines, sol, décoration,
éclairage) et 79 éléments dans 9 thèmes, définis dans `src/data/decor.ts` et gérés par `src/systems/decor.ts`.

- **Gagner des éléments** : en montant de niveau, en validant des objectifs et des succès (clients servis,
  jours tenus, promos lancées, jours sans gaspillage…). Les éléments verrouillés peuvent être prévisualisés.
- **Effet sur la partie** : chaque élément a un « charme ». Le charme total attire des clients
  (jusqu'à +15 %) et rapporte de la réputation chaque jour (jusqu'à +1,2). Porter 4 ou 6 éléments du même
  thème multiplie le charme (×1,15 / ×1,3).
- **Évolution avec le statut** : le magasin change d'architecture en devenant Supérette (niv. 3),
  Mini-marché (niv. 5) puis Supermarché (niv. 7). Un élément conçu pour un statut trop petit (2 crans
  d'écart) devient « démodé » et ne compte qu'à moitié ; un élément de supermarché ne peut pas être posé
  sur une épicerie.
- **Ajouter un élément** : une ligne `D(...)` dans `src/data/decor.ts` (emplacement, thème, statut, charme,
  condition de gain, apparence). Réglages des effets : `DECOR_BALANCE`.

## Mise en ligne

Voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** : Netlify Drop (archive prête dans `deploy/`) ou GitHub Pages
(workflow fourni dans `.github/workflows/deploy.yml`), puis installation sur Android et iPhone.

## Structure

```
src/
  data/        Tout l'équilibrage, sans logique
    constants.ts    constantes globales (demande, réputation, prêt, charges…)
    products.ts     catalogue (108 produits)
    categories.ts   catégories, couleurs, licences
    suppliers.ts    fournisseurs (délai, lot, remise)
    levels.ts       niveaux du magasin (XP, rayons, entrepôt, affluence, loyer)
    upgrades.ts     améliorations achetables
    objectives.ts   objectifs du jour, de la semaine, à long terme
    events.ts       événements aléatoires et météo
  systems/     Logique pure, sans DOM (testable)
    demand.ts       formule de demande
    economy.ts      affluence, charges, prix, prêt d'urgence
    stock.ts        lots, péremption, rayons, entrepôt, agencement auto
    suppliers.ts    panier, commandes, livraisons, réassort auto
    events.ts       événements actifs, prix du marché, météo
    reputation.ts   évolution quotidienne de la réputation
    progression.ts  XP, niveaux, déblocages, licences, objectifs
    simulation.ts   déroulé d'une journée + passage au jour suivant
  state/       types.ts (modèle), store.ts (état + nouvelle partie), save.ts (localStorage)
  ui/          app.ts (coquille), simulation.ts (journée animée), report.ts (bilan),
               composants (modal, toast, fx, audio, chart, storefront, debug), screens/ (8 écrans)
tests/         tests unitaires Vitest
scripts/       simulate.ts (bot d'équilibrage)
```

## La formule de demande

```
demande = base × poids_essentiel × facteur_prix × facteur_réputation
          × facteur_jour × événements × affluence × aléa(±10 %)

facteur_prix = (prix_marché / prix_joueur) ^ élasticité     borné entre 0 et 2
```

- `base` : demande de base du produit × `DEMAND_SCALE` (levier global de difficulté).
- Au-delà de 1,5 × le prix du marché, le facteur prix chute linéairement jusqu'à 0 à 2 × (prix abusif).
- `affluence` : niveau du magasin, enseigne, publicité, météo, événements, et **image prix** (un magasin
  dont le prix moyen dépasse 110 % du marché perd des clients).
- Les clients cherchent d'abord les essentiels. Un essentiel introuvable fait un client déçu et coûte de la réputation.

Les marges affichées sont des **taux de marge sur coût** : `(prix − achat) / achat`.

## Ajouter un produit

Une ligne dans `src/data/products.ts` :

```ts
P('kiwis', 'Kiwis x6', '🥝', 'fl', 4, 1.40, 2.30, 5, 1.3, { shelfLife: 7, size: 2 }),
//  id      nom        emoji  cat. niveau achat marché base élasticité options
```

Options : `essential`, `size` (volume en rayon, défaut 1), `shelfLife` (jours, sinon non périssable),
`storage` (`'fridge'` ou `'freezer'`, via les aides `frigo(jours)` / `congel()`), `tags` (étiquettes
utilisées par les événements et les jours de la semaine : `froid`, `chaud`, `bbq`, `apero`, `scolaire`,
`pluie`), `unlockBy` (identifiant d'un objectif qui le débloque).

Le produit apparaît automatiquement chez les fournisseurs qui livrent sa catégorie, dans les écrans et
dans l'écran « Nouveautés » de son niveau. Le test `catalogue` vérifie que la marge reste dans les
fourchettes prévues (15–35 % pour un essentiel, 40–100 % sinon).

## Régler l'équilibrage

| Je veux…                                   | Fichier                 | Clé                                        |
|--------------------------------------------|-------------------------|--------------------------------------------|
| Plus ou moins de ventes partout            | `data/constants.ts`     | `DEMAND_SCALE`, `BASE_CUSTOMERS`           |
| Un démarrage plus facile                   | `data/constants.ts`     | `START_CASH`, `STARTER_KIT_DAYS`           |
| Des niveaux plus rapides ou plus lents     | `data/levels.ts`        | `xp`                                       |
| Des charges plus légères                   | `data/levels.ts`, `data/upgrades.ts` | `rent`, `salary`              |
| Une réputation plus ou moins sévère        | `data/constants.ts`     | bloc `REP_*`                               |
| Punir davantage les prix élevés            | `data/constants.ts`     | `REP_PRICE_CURVE`, `PRICE_IMAGE_*`         |
| Changer l'objectif final                   | `data/constants.ts`     | `FINAL_GOAL`                               |
| Modifier le week-end, le barbecue du samedi| `data/constants.ts`     | `WEEKDAY_FACTORS`, `CATEGORY_WEEKDAY`, `TAG_WEEKDAY` |

Après un changement : `npm test` puis `npm run simulate -- 30` pour voir l'effet sur un mois de jeu.
