import { defineConfig } from 'vite-plus'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // Oxfmt — Prettier-compatible. Settings match the existing codebase style
  // (single-quoted JS, no semicolons; JSX keeps double quotes by default).
  fmt: {
    ignorePatterns: ['dist/**'],
    singleQuote: true,
    semi: false,
  },
  // Oxlint — type-aware, replaces ESLint. The vite-plus JS plugin enforces
  // importing from `vite-plus`; the react rules preserve the react-hooks
  // coverage previously provided by eslint-plugin-react-hooks.
  lint: {
    ignorePatterns: ['dist/**'],
    plugins: ['react', 'typescript', 'unicorn', 'oxc', 'import'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'warn',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts + ses dépendances CommonJS (es-toolkit, d3, victory-vendor…) DOIVENT
        // rester dans un SEUL chunk. Sinon Rolldown duplique des modules CJS (ex. le
        // helper `require_get` d'es-toolkit) dans le chunk consommateur (chart.tsx) avec
        // une référence cassée → « require_get is not a function » au 1er rendu d'un
        // chart en prod. Les regrouper évite le split inter-chunks des modules CJS, tout
        // en gardant Recharts hors du bundle d'entrée (chargé à la 1re étape avec chart).
        manualChunks(id: string) {
          if (
            /node_modules\/(recharts|es-toolkit|victory-vendor|d3-[^/]+|internmap|decimal\.js-light)\//.test(
              id,
            )
          ) {
            return 'recharts'
          }
        },
      },
    },
  },
})
