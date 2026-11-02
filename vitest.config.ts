import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@contract': fileURLToPath(new URL('./contract', import.meta.url)),
    },
  },
  test: {
    root: '.',
    env: { TZ: 'Europe/Paris' },
    projects: [
      {
        extends: true,
        test: {
          name: 'backend',
          include: ['backend/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend',
          include: ['frontend/tests/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
    ],
  },
})
