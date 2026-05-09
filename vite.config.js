import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dev-digest-visualizer/' : '/',
  plugins: [vue(), tailwindcss()],
}))
