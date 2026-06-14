/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ui',
  resolve: {
    conditions: ['@klank/source'],
    alias: {
      '@klank/platform-api': path.resolve(__dirname, '../../libs/platform-api/src/index.ts'),
      '@klank/store': path.resolve(__dirname, '../../libs/store/src/index.ts'),
      '@klank/audio': path.resolve(__dirname, '../../libs/audio/src/index.ts'),
    },
  },
  plugins: [
    // Only use React plugin for building, not during development
    mode === 'production' && react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
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
