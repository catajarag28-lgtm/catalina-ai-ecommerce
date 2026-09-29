import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH lo fija el workflow de GitHub Pages (/catalina-ai-ecommerce/).
// En local y con dominio propio queda en '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: { outDir: 'dist' },
})
