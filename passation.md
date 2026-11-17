# Passation : Ma Supérette

Document de reprise du projet : où en est le jeu, comment il est construit, ce qui reste à faire.

- **Jeu en ligne** : https://darkaouikader-alt.github.io/ma-superette/
- **Code** : https://github.com/darkaouikader-alt/ma-superette (branche `main`)
- **Aperçu Claude** (sans compte en ligne) : https://claude.ai/artifact/3uZZq2hiX4HSQi8omiUQCU
- **État** : 78 tests au vert, publication automatique réussie (dernier commit : voir `git log`).

## 1. Objectif

Jeu de gestion de supérette en navigateur, entièrement en français, sans phase d'action. Le joueur
fixe ses prix, commande, remplit ses rayons, ouvre le magasin et lit son bilan, jour après jour.
Exigences : un jeu beau, jouable sur ordinateur et sur mobile (iPhone compris, installable), et qui
fidélise sur la durée (compte en ligne, classement, roue, longue progression).

## 2. Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 78 tests (Vitest)
npm run build        # vérification TypeScript + build dans dist/
npm run simulate -- 80   # bot d'équilibrage : 80 jours sans interface
```

- **Variables d'environnement du bot** : `NO_BUYER=1` désactive le responsable des achats ;
  `SHOW_BUYER=1` affiche ses comptes rendus.
- **Version « une seule page »** (aperçu Claude) : `npm run build && node scripts/build-single.mjs`,
  qui produit `dist-single/ma-superette.html`.

## 3. Architecture

| Dossier | Rôle |
|---|---|
| `src/data/` | **Tout l'équilibrage**, sans logique : constantes, 108 produits, fournisseurs, 14 niveaux, améliorations, objectifs, événements, campagnes, succursales, 79 éléments de façade, roue |
| `src/systems/` | Logique pure, testable sans navigateur : demande, économie, stock, fournisseurs, simulation d'une journée, progression, réputation, promotions, façade, acheteur, succursales, roue |
| `src/state/` | `types.ts` (modèle), `store.ts` (état + nouvelle partie), `save.ts` (localStorage, versionné) |
| `src/cloud/` | Firebase : `config.ts` (identifiants), `sync.ts` (synchronisation), `social.ts` (nom de joueur, classement) |
| `src/ui/` | Coquille (`app.ts`), journée animée, bilan, vitrine SVG, composants ; un fichier par écran dans `screens/` |
| `tests/` | 13 fichiers de tests |
| `public/` | PWA : `manifest.webmanifest`, `sw.js` (hors ligne), icônes |
| `.github/workflows/deploy.yml` | Tests, build et publication sur GitHub Pages à chaque push sur `main` |

**Principes à garder :**
- **La journée est calculée d'un coup** (`runDay`), puis rejouée en animation. La vitesse
  d'animation ne change donc rien aux résultats.
- **L'équilibrage reste dans `src/data/`**, notamment `constants.ts` et `DECOR_BALANCE` dans `decor.ts`.
- **Toute modification d'état passe par `store.commit()`**, qui sauvegarde, synchronise et redessine.
- **Ne pas redessiner l'écran pendant une saisie** (barres de recherche) : sur iPhone, cela fermerait
  le clavier. On masque les lignes à la place (`src/ui/search.ts`).

## 4. Décisions importantes

- **PWA plutôt qu'une application des stores** : installable, hors ligne, sans outils ni comptes
  développeur.
- **Compte par e-mail + mot de passe** : les liens de connexion par e-mail s'ouvriraient dans Safari,
  pas dans l'application installée sur iPhone.
- **Synchronisation par révision** : chaque sauvegarde en ligne porte un numéro. Si deux appareils
  ont avancé chacun de leur côté, le joueur choisit la partie à garder ; aucun écrasement silencieux.
- **Façade** : les éléments se gagnent (niveaux, objectifs, succès) et ont un effet réel (clients,
  réputation). Un élément trop modeste pour le statut du magasin devient « démodé » et compte à moitié.
- **Calcul des quantités à commander** (`reorderQty`) : simulation jour par jour, chaque livraison
  comptée à sa date d'arrivée. L'ancien calcul supposait qu'elles arrivaient toutes tout de suite et
  provoquait des ruptures.
- **Responsable des achats** : commandes « juste à temps », chez le fournisseur le moins cher qui livre
  avant la rupture. Il rapporte +18 % de bénéfice sur une partie simulée.
- **Fin de partie étendue** : 14 niveaux, améliorations prolongées, entrepôt logistique, succursales.
  La progression simulée dure environ 225 jours, contre 75 avant.
- **Performances** : plus de flou d'arrière-plan ; animations décoratives coupées par défaut sur écran
  tactile (réglage dans Paramètres) ; décor en pause sous les fenêtres. Au repos, le travail du
  navigateur passe de 101 à 5 ms par seconde.
- **Mode debug** (touche D) : les boutons +1 000 € / +1 000 XP marquent la partie `cheated`, ce qui
  l'exclut du classement.

## 5. Fonctionnalités en place

- **Gestion** :
  - tableau de bord avec vitrine selon le statut, objectifs, graphique et historique des 7 jours ;
  - rayons (badges « Déjà en rayon » et « Nouveau ») et prix ;
  - promotions et campagnes ;
  - commandes : réassort par fournisseur, achats rapides (ruptures, stock faible), recherche, tri,
    panier indépendant ;
  - stock avec recherche et tri sur toutes les colonnes ;
  - améliorations, licences et succursales ;
  - façade personnalisable ; statistiques ; paramètres.
- **Journée animée et bilan** : chiffre d'affaires, charges, clients, ventes manquées (rupture, prix,
  file d'attente), réputation, objectifs, éléments de façade gagnés.
- **En ligne** :
  - compte demandé au premier lancement (on peut jouer sans) ;
  - synchronisation entre appareils ;
  - nom de joueur unique et classement mondial (top 100 + rang du joueur).
- **Roue de la fortune** : un tour par heure réelle, avec cagnottes et bonus temporaires de 1 à 3 journées de jeu (pas en heures réelles, pour éviter d’enchaîner des dizaines de journées boostées).
- **Mobile** :
  - barre d'onglets en bas, cartes à la place des tableaux, fenêtres qui montent du bas ;
  - correctifs propres à Safari sur iPhone ;
  - mode paysage pris en charge.

## 6. Accès et configuration

- **GitHub** : compte `darkaouikader-alt`, dépôt `ma-superette`. GitHub Pages est configuré avec la
  source « GitHub Actions ».
- **Firebase**, projet `ma-superette` :
  - **Identifiants** dans `src/cloud/config.ts`. Ils ne sont pas secrets : la sécurité repose sur les
    règles Firestore.
  - **Connexion** : e-mail + mot de passe activé. Domaine autorisé : `darkaouikader-alt.github.io`.
  - **Base** : Firestore, édition Standard, mode production, région Europe.
  - **Collections** : `saves/{uid}` (partie), `profiles/{uid}` et `usernames/{nom}` (nom de joueur),
    `leaderboard/{uid}` (classement).
  - **Règles vérifiées en vrai** : un joueur ne lit et n'écrit que sa propre sauvegarde.
- **Sites autorisés pour le compte** : liste `CLOUD_HOSTS` dans `src/cloud/config.ts`.

## 7. Reste à faire

**Côté propriétaire du projet :**
1. **Activer le classement mondial.** Dans la console Firebase, ouvrir Firestore → Règles, coller le
   bloc complet de règles (sauvegardes, `profiles`, `usernames`, `leaderboard`), puis cliquer sur
   **Publier**. Texte des règles : section 9 ci-dessous. Tant que ce n'est pas fait, la carte du
   classement indique « pas encore activé » ; tout le reste fonctionne.
2. **Facultatif : passer à l'adresse `ma-superette.github.io`.**
   - Créer l'organisation GitHub `ma-superette`.
   - Renommer le dépôt en `ma-superette.github.io`, puis le transférer dans l'organisation.
   - Installer l'application Claude sur l'organisation.
   - Ajouter le domaine dans Firebase → Authentication → Domaines autorisés.

   Le code accepte déjà les deux adresses.
3. **Sur l'iPhone** : réinstaller l'icône depuis l'adresse finale (Safari → Partager → Sur l'écran
   d'accueil), puis se reconnecter pour récupérer la partie.

**Côté développement, une fois ces étapes faites :**
- Tester le classement en vrai : nom unique, top 100, rang au-delà du top 100. Utiliser des comptes de
  test et les supprimer ensuite.
- Vérifier la nouvelle adresse et l'installation sur iPhone, si l'adresse change.

**Limites connues :**
- **Triche au classement** : le score est calculé sur l'appareil du joueur. Les règles Firestore
  plafonnent le score et limitent chacun à sa propre ligne, mais une protection complète
  demanderait un serveur.
- **Safari réel** : la compatibilité iPhone a été vérifiée sur un iPhone émulé (moteur Chromium) et
  par relecture du code. Elle reste à confirmer sur un vrai iPhone.
- **Roue de la fortune** : en changeant l'heure de l'appareil, on peut raccourcir l'attente, plafonnée
  à une heure.
- **Journées jouées avant la mise à jour « ventes manquées »** : elles n'ont pas ce chiffre (« — »
  dans les statistiques).

## 8. Repères utiles

- **Ajouter un produit** : une ligne `P(...)` dans `src/data/products.ts`. Un test vérifie que les
  marges restent dans les fourchettes prévues.
- **Ajouter un élément de façade** : une ligne `D(...)` dans `src/data/decor.ts`.
- **Régler la difficulté** : `src/data/constants.ts`, notamment `DEMAND_SCALE`, `BASE_CUSTOMERS` et le
  bloc `REP_*`. Contrôler ensuite avec `npm run simulate -- 80`.
- **Publier une mise à jour** : push sur `main`. GitHub Actions lance les tests, construit et publie.
  Sur iPhone, l'application se met à jour après une ou deux réouvertures.

## 9. Règles Firestore à publier

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sauvegarde de partie : privée
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Profil : nom de joueur
    match /profiles/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid
        && request.resource.data.username is string
        && request.resource.data.username.matches('^[A-Za-z0-9_-]{3,16}$');
    }
    // Réservation des noms (unicité)
    match /usernames/{name} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid
        && name.matches('^[a-z0-9_-]{3,16}$');
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    // Classement mondial : lecture publique, chacun ne modifie que sa ligne
    match /leaderboard/{uid} {
      allow read: if true;
      allow delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.score is int
        && request.resource.data.score >= 0 && request.resource.data.score <= 100000000
        && request.resource.data.username == get(/databases/$(database)/documents/profiles/$(uid)).data.username;
    }
  }
}
```
