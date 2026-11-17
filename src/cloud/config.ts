// Identifiants du projet Firebase (console Firebase → Paramètres du projet → Vos applications → Web).
// Ces valeurs ne sont pas secrètes : la sécurité repose sur les règles Firestore (chaque joueur
// ne peut lire et écrire que sa propre sauvegarde, voir DEPLOIEMENT.md).
// Laisser à null désactive la synchronisation (le jeu reste 100 % local).
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export const FIREBASE_CONFIG: FirebaseConfig | null = {
  apiKey: 'AIzaSyAZcYTlszBtA2XZ0O3Aj6z4-ndMIuyFCsI',
  authDomain: 'ma-superette.firebaseapp.com',
  projectId: 'ma-superette',
  storageBucket: 'ma-superette.firebasestorage.app',
  messagingSenderId: '184578571650',
  appId: '1:184578571650:web:711111bade3c14c7b7639b',
};

/** Sites sur lesquels la synchronisation est proposée (les autres, comme l'aperçu Claude, la bloquent). */
export const CLOUD_HOSTS = ['darkaouikader-alt.github.io', 'localhost', '127.0.0.1'];
