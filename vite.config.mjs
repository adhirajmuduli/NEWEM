import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'app/renderer',
  base: './',
  plugins: [react()],
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