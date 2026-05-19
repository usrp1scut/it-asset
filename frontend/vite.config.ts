import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Tunnel / external domains that may serve this dev server (Lark 免登 needs
    // a real https host). Override/extend via VITE_ALLOWED_HOSTS (comma-sep).
    allowedHosts: [
      ...(process.env.VITE_ALLOWED_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean) ?? []),
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
