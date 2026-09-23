import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

// Flat config only: ESLint 9 removed `.eslintrc.*`, and this project runs ESLint 10.
// `eslint-config-prettier` stays last so it can switch off the rules Prettier owns.
export default [
  {
    // resources/ holds only the downloaded Neutralino client and the app icons — nothing authored
    // here, and the client ships minified on one line, which no-undef reports 25 times.
    ignores: [
      'dist/**',
      'bin/**',
      'coverage/**',
      'node_modules/**',
      '.tmp/**',
      'extensions/**',
      'resources/**',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.mjs', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        Neutralino: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        structuredClone: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        queueMicrotask: 'readonly',
        URL: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        performance: 'readonly',
      },
    },
  },
  {
    // Build-time scripts run under plain Node, not in the window.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
  prettier,
]
