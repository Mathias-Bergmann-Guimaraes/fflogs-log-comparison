import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The admin page (admin.html → src/admin/), built on its own into dist-admin/ so the public server's dist/ never
// contains it. Served only by the loopback-only admin server in server/admin.ts.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/admin-api': 'http://localhost:3001' },
  },
  build: {
    outDir: 'dist-admin',
    rollupOptions: { input: 'admin.html' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
