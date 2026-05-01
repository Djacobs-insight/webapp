import { defineConfig } from 'vitest/config'
import path from 'path'

// React 19's react-dom only exports `act` when NODE_ENV is "test" or "development".
// Vitest 4 no longer auto-sets this, so force it before any module resolution.
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/app/**/*.test.tsx', 'jsdom'],
    ],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
