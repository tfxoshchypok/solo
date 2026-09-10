import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Two projects, two environments: the engine suites are plain functions and run without a DOM,
// the component suites need one. `extends: true` inherits the plugins and the `@` alias below.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'happy-dom',
          include: ['tests/component/**/*.test.js'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/modules/*/engine/**', 'src/services/**', 'src/schemas/**'],
    },
  },
})
