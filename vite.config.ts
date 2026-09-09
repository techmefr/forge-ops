import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const BOARD_PORT = process.env.FORGE_PORT ?? '8830'

export default defineConfig({
  root: 'web',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web/src', import.meta.url)),
    },
  },
  server: {
    port: 8832,
    proxy: {
      '/api': `http://localhost:${BOARD_PORT}`,
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
})
