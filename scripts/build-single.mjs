// Assemble dist/ en une seule page HTML autonome (CSS et JS inlinés) : dist-single/ma-superette.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Ma Supérette</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${css}</style>
<div id="app"></div>
<div id="overlay-root"></div>
<div id="modal-root"></div>
<div id="toast-root"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/ma-superette.html', html);
console.log('dist-single/ma-superette.html', (html.length / 1024).toFixed(0), 'Ko');
