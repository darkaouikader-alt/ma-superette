import './styles/main.css';
import { store } from './state/store';
import { initApp } from './ui/app';
import { registerServiceWorker } from './ui/install';

store.init();
initApp();
registerServiceWorker();
