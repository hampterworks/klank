import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { resolve } from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/klank',
  server: {
    port: 4200,
    host: 'localhost',
    middlewareMode: false,
    hmr: {
      port: 4201,
      host: 'localhost'
    },
    fs: {
      // Allow serving files from the monorepo root
      allow: ['../..']
    }
  },
  publicDir: 'public',
  preview: {
    port: 4300,
    host: 'localhost',
  },
  resolve: {
    alias: {
      '@klank/ui': resolve(__dirname, '../../libs/ui/src/index.ts'),
      '@klank/store': resolve(__dirname, '../../libs/store/src/index.ts'),
      '@klank/platform-api': resolve(__dirname, '../../libs/platform-api/src/index.ts'),
    },
  },
  plugins: [!process.env.VITEST && reactRouter()],
  optimizeDeps: {
    // Exclude monorepo packages from pre-bundling for faster HMR
    exclude: ['@klank/ui', '@klank/store', '@klank/platform-api'],
    // Include common dependencies that should be pre-bundled
    include: ['react', 'react-dom']
  },
  build: {
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    transformMixedEsModules: true,
    outDir: './dist',
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  test: {
    name: '@klank/klank',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
