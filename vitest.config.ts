import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
    },
  },
  test: {
    root: '.',
    include: ['backend/tests/**/*.test.ts', 'frontend/tests/**/*.test.ts'],
    environmentMatchGlobs: [['frontend/tests/**', 'jsdom']],
  },
})
