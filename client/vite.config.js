import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wyw({
      displayName: true,
      classNameSlug: '[title]_[hash]',
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:19190'
    }
  }
})
