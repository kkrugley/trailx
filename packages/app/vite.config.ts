import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const envDir = resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '')
  const ghKey = env.GRAPHHOPPER_API_KEY || env.VITE_GRAPHHOPPER_API_KEY

  return {
    plugins: [
      react(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disable: !process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
    build: {
      sourcemap: 'hidden',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('maplibre-gl')) return 'vendor-map'
            if (id.includes('@phosphor-icons')) return 'vendor-icons'
            if (id.includes('@dnd-kit')) return 'vendor-dnd'
            if (id.includes('dexie')) return 'vendor-db'
            if (id.includes('@sentry')) return 'vendor-sentry'
            if (id.includes('react-dom') || /[/\\]react[/\\]/.test(id)) return 'vendor-react'
            if (id.includes('node_modules')) return 'vendor'
          },
        },
      },
    },
    resolve: { tsconfigPaths: true },
    // Load .env from the monorepo root instead of packages/app
    envDir,
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
      proxy: {
        '/api/route': {
          target: 'https://graphhopper.com',
          changeOrigin: true,
          rewrite: () => `/api/1/route?key=${ghKey}`,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
      },
    },
  }
})
