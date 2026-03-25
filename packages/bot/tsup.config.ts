import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  noSplitting: true,
  external: ['@prisma/client', 'prisma'],
  esbuildOptions(options) {
    options.banner = {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    }
  },
})
