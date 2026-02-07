import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections in Docker
    port: 5173,
    watch: {
      usePolling: true, // Required for hot reload in Docker
    },
    proxy: {
      '/api': {
        // Proxy for localhost access (when using localhost:5173)
        // When accessing via IP, the API client connects directly to backend
        target: process.env.VITE_BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
});
