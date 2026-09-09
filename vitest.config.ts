import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
    },
  },
  test: {
    root: '.',
    include: ['backend/tests/**/*.test.ts', 'frontend/tests/**/*.test.ts'],
  },
})
