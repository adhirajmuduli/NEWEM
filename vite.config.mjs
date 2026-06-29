import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'app', 'renderer');

export default defineConfig({
  root: 'app/renderer',
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': rendererRoot,
    },
  },
  build: {
    outDir: '../../dist/app/renderer',
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: true,
    rollupOptions: {
      input: 'app/renderer/index.html',
    },
  },
  test: {
    root: './',
    environment: 'node',
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});