import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const BOARD_PORT = process.env.FORGE_PORT ?? '8830'
const TOKEN_PATH = process.env.FORGE_TOKEN_PATH ?? '.forge-token'
const BOARD_TOKEN = existsSync(TOKEN_PATH) ? readFileSync(TOKEN_PATH, 'utf-8').trim() : ''

export default defineConfig({
  root: 'frontend',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
    },
  },
  server: {
    port: 8832,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BOARD_PORT}`,
        headers: { 'x-forge-token': BOARD_TOKEN },
      },
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
})
