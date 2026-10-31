import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Only what the game itself ships can run: no script from anywhere else, and
 * nothing sent anywhere. The dev server needs its own inline scripts, so this
 * goes in the build only. WebAssembly decodes the 3D models.
 */
const CONTENT_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const contentPolicy = (): Plugin => ({
  name: 'content-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_POLICY },
      injectTo: 'head-prepend',
    },
  ],
});

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative base keeps the static build portable (VPS subfolder, GitHub Pages, file server).
  base: './',
  plugins: [contentPolicy()],
  resolve: {
    alias: {
      '@domain': fromRoot('./src/domain'),
      '@application': fromRoot('./src/application'),
      '@infrastructure': fromRoot('./src/infrastructure'),
      '@presentation': fromRoot('./src/presentation'),
      '@main': fromRoot('./src/main'),
    },
  },
  build: {
    target: 'es2022',
    // Three.js is most of the bundle: alone in its file, it stays cached between versions.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
      thresholds: {
        'src/domain/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
        'src/application/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
