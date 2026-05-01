import { defineConfig } from 'vitest/config'
import path from 'path'

// React 19's react-dom only exports `act` when NODE_ENV is "test" or "development".
// Vitest 4 no longer auto-sets this, so force it before any module resolution.
const env = process.env as Record<string, string | undefined>
env.NODE_ENV = env.NODE_ENV || 'test'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // environmentMatchGlobs is removed from public types in vitest 4 but still
    // honored at runtime. Cast to bypass the type check.
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/app/**/*.test.tsx', 'jsdom'],
    ],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
