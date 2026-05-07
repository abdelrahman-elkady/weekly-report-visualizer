import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/weekly-report-visualizer/' : '/',
  plugins: [vue(), tailwindcss()],
}))
