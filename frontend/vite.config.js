import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    allowedHosts: [
      'edp-2k.tailcd68fc.ts.net'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Nembak ke Express lu di PC
        changeOrigin: true,
        secure: false,
      }
    }
  },
})