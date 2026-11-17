# 📲 Mettre Ma Supérette sur ton téléphone

Le jeu est une application web installable (PWA) : une fois en ligne, tu l'ajoutes à l'écran d'accueil
de ton téléphone. Il s'ouvre alors en plein écran avec son icône, et fonctionne même sans internet.

Pour ça, il faut d'abord le mettre en ligne. Deux méthodes gratuites, sans rien installer sur ton ordinateur.

---

## Méthode 1 — Netlify Drop (la plus rapide, 2 minutes)

1. Télécharge l'archive **`ma-superette-web.zip`** (dossier `deploy/` du projet) et **décompresse-la**.
   Tu obtiens un dossier avec `index.html`, `sw.js`, `manifest.webmanifest`, `assets/` et `icons/`.
2. Va sur **https://app.netlify.com/drop** et crée un compte gratuit (e-mail ou GitHub).
   Sans compte, le site est supprimé au bout d'une heure.
3. **Glisse le dossier décompressé** dans la zone « Drag and drop your site output folder here ».
4. Netlify te donne une adresse du type `https://nom-au-hasard.netlify.app`.
   Dans *Site configuration → Change site name*, tu peux la renommer, par exemple `ma-superette-du-quartier.netlify.app`.

Pour publier une nouvelle version plus tard : *Deploys → Drag and drop*, avec le nouveau dossier.

## Méthode 2 — GitHub Pages (mises à jour automatiques)

1. Crée un compte sur https://github.com, puis un dépôt **public** nommé `ma-superette`.
2. Décompresse **`ma-superette-projet.zip`** (dossier `deploy/`) et envoie son contenu dans le dépôt
   (*Add file → Upload files*, puis glisse tous les fichiers et dossiers).
   ⚠️ Le dossier **`.github`** est masqué sur Mac et parfois sur Windows : affiche les fichiers cachés
   (Mac : <kbd>Cmd</kbd> + <kbd>Maj</kbd> + <kbd>.</kbd>) pour bien l'inclure, sinon le site ne se publie pas.
3. Dans le dépôt : *Settings → Pages → Build and deployment → Source* : choisis **GitHub Actions**.
4. Le fichier `.github/workflows/deploy.yml` (déjà fourni) lance les tests, construit le jeu et le publie.
   Après 1 à 2 minutes, l'adresse apparaît dans *Settings → Pages* :
   `https://TON-PSEUDO.github.io/ma-superette/`.

À chaque modification envoyée sur la branche `main`, le site se met à jour tout seul.

> Si tu crées le dépôt et que tu m'en donnes le nom, je peux y envoyer le projet directement depuis Claude.

---

## Installer l'application sur le téléphone

Ouvre l'adresse de ton site sur le téléphone, puis :

| Téléphone | Comment faire |
|---|---|
| **Android** (Chrome) | Menu **⋮** → **Installer l'application** (ou bouton « 📲 Installer » dans *Réglages* du jeu) |
| **iPhone / iPad** (Safari) | Bouton **Partager** ⬆️ → **Sur l'écran d'accueil** → **Ajouter** |

L'icône « Supérette » apparaît sur l'écran d'accueil. Au premier lancement, le jeu se met en cache :
ensuite, il fonctionne aussi en mode avion.

## Spécial iPhone / iPad

- Fonctionne sur **iOS 15 ou plus récent** (iPhone 6s et suivants), en portrait comme à l'horizontale.
- L'installation passe obligatoirement par **Safari** (sur iPhone, Chrome ne propose pas « Sur l'écran d'accueil »).
- **Sauvegarde séparée** : l'application installée sur l'écran d'accueil a sa propre sauvegarde, distincte
  de celle de Safari. Installe l'application d'abord, puis joue depuis l'icône pour garder ta partie.
- **Sons** : ils sont coupés quand le bouton silencieux de l'iPhone est activé. Les vibrations
  n'existent pas sur iPhone (Safari ne les autorise pas).
- iOS peut effacer les données d'un site **non installé** après plusieurs semaines sans visite :
  installer l'application sur l'écran d'accueil protège ta partie.

## Même partie sur plusieurs appareils

Dans le jeu : **Réglages → ☁️ Compte et synchronisation**.

1. Sur le premier appareil : écris ton e-mail et un mot de passe (6 caractères minimum), puis **Créer un compte**.
   Ta partie est envoyée en ligne.
2. Sur chaque autre appareil : même e-mail, même mot de passe, puis **Se connecter**. La partie est récupérée.
3. Ensuite, tout est automatique : la partie est envoyée après chaque journée et récupérée à l'ouverture du jeu.
   Si deux appareils ont avancé chacun de leur côté, le jeu te demande laquelle garder.

Le compte fonctionne sur la version GitHub (https://darkaouikader-alt.github.io/ma-superette/), pas dans l'aperçu Claude.
Mot de passe oublié : bouton « Mot de passe oublié ? » sous le formulaire (un e-mail est envoyé).

## Bon à savoir

- **Sauvegarde** : elle est stockée dans le navigateur du téléphone. Une partie commencée sur
  l'ordinateur ne se retrouve pas sur le téléphone, et inversement.
- **iPhone** : n'utilise pas l'application « Fichiers » pour ouvrir `index.html` : il faut passer par l'adresse web.
- **Mises à jour** : après une nouvelle mise en ligne, ferme puis rouvre l'application (une ou deux fois)
  pour récupérer la nouvelle version.
