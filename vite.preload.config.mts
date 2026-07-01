import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve('app/preload/bridge.ts'),
      formats: ['cjs'],
      fileName: () => 'bridge.js',
    },
    outDir: 'dist/app/preload',
    emptyOutDir: false,
    target: 'node22',
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['electron'],
    },
  },
});
