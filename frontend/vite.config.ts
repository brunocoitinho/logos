import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // A página simulada fica na mesma origem da API dos testes. Sem isso, o jsdom aplica
    // CORS (inclusive o preflight OPTIONS do header Authorization) às respostas do MSW.
    // O CORS real é testado no backend (test_auth.py).
    environmentOptions: {
      jsdom: { url: 'http://127.0.0.1:8000' },
    },
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/components/ui/**'],
    },
  },
})
