import { defineConfig } from 'vite';

// base relative : le build fonctionne dans n'importe quel sous-dossier (GitHub Pages, Netlify…).
export default defineConfig({ base: './' });
