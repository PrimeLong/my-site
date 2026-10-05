import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import textbookSections from './scripts/textbook-sections-plugin.js'
import serviceWorker from './scripts/sw-plugin.js'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// версия сборки для «Сообщить об ошибке»: коммит и дата (на Vercel коммит — из его переменной)
const commit = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
})()
const BUILD = `${commit} · ${new Date().toISOString().slice(0, 10)}`

// заголовки безопасности из vercel.json — и в vite preview: e2e-тесты идут под той же CSP, что и сайт
const SITE_HEADERS: Record<string, string> = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers
    .find((h: { source: string }) => h.source === '/(.*)').headers.map((h: { key: string, value: string }) => [h.key, h.value]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), textbookSections(), serviceWorker()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  preview: { headers: SITE_HEADERS },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/lucide-react')) return 'lucide-react'
          // KaTeX нужен только учебнику, но это самая тяжёлая его часть — свой чанк
          if (id.includes('node_modules/katex')) return 'katex'
        },
      },
    },
  },
})
