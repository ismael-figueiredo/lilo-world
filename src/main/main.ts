import { createBrowserAdapters, createServices } from '@main/container';
import { GameApp } from '@presentation/game-app';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app element');

const services = createServices(createBrowserAdapters());
const game = new GameApp(root, services, {
  baseUrl: import.meta.env.BASE_URL,
});

void game.start();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready)
    .then(({ active }) => {
      const remember = performance.getEntriesByType('resource').map((entry) => entry.name);
      active?.postMessage({ remember: [window.location.href, ...remember] });
    })
    .catch(() => undefined);
}
