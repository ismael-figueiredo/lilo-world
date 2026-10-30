import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative base keeps the static build portable (VPS subfolder, GitHub Pages, file server).
  base: './',
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
