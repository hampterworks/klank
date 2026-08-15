/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { klankAliases } from '../../vite-aliases.mjs';
import { join } from 'node:path';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ui',
  resolve: {
    conditions: ['@klank/source'],
    alias: {
      '@klank/platform-api': klankAliases['@klank/platform-api'],
      '@klank/store': klankAliases['@klank/store'],
      '@klank/audio': klankAliases['@klank/audio'],
    },
  },
  plugins: [
    // Only use React plugin for building, not during development
    mode === 'production' && react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
    }),
  ].filter(Boolean),
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@klank/ui',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@klank/platform-api'],
    },
  },
  test: {
    name: '@klank/ui',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
