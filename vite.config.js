import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base: the production bundle is served by Neutralino from documentRoot /dist/,
// not from a web server root.
export default defineConfig({
  base: './',
  // `neu update` writes the Neutralino client into resources/; making it the publicDir means
  // vite copies it into dist/ on every build instead of emptyOutDir deleting it.
  publicDir: 'resources',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
