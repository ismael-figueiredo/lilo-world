import { createBrowserAdapters, createServices } from '@main/container';
import { GameApp } from '@presentation/game-app';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app element');

const services = createServices(createBrowserAdapters());
const game = new GameApp(root, services, {
  baseUrl: import.meta.env.BASE_URL,
});

void game.start();
