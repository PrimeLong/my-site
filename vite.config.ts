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

// сборка падает, если какой-то JS-чанк больше limit байт: тяжёлое — в ленивые чанки
function chunkLimit(limit: number) {
  return {
    name: 'chunk-limit',
    generateBundle(_: unknown, bundle: Record<string, { type: string, code?: string, fileName: string }>) {
      const big = Object.values(bundle).filter((c) => c.type === 'chunk' && c.code && Buffer.byteLength(c.code) > limit)
        .map((c) => `${c.fileName}: ${Math.round(Buffer.byteLength(c.code as string) / 1024)} КБ`)
      if (big.length) (this as unknown as { error: (m: string) => never }).error(`чанки больше ${Math.round(limit / 1024)} КБ: ${big.join(', ')}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), textbookSections(), serviceWorker(), chunkLimit(Number(process.env.CHUNK_LIMIT_KB || 400) * 1024)],
  define: { __BUILD__: JSON.stringify(BUILD) },
  preview: { headers: SITE_HEADERS },
  build: {
    rolldownOptions: {
      output: {
        // модули движка ссылаются друг на друга по кругу; когда группа делится на части, порядок
        // выполнения должен остаться тем же, что без разбиения
        strictExecutionOrder: true,
        // ни один чанк не больше 400 КБ (проверка — плагин chunkLimit выше). Группа с большим
        // priority забирает модули первой; без своей группы модуль едет с тем, кто его импортирует
        codeSplitting: {
          groups: [
            // React — свой чанк: без него стартовый index был больше 400 КБ
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'lucide-react', test: /node_modules[\\/]lucide-react[\\/]/, priority: 30 },
            // KaTeX нужен только учебнику, но это самая тяжёлая его часть — свой чанк
            { name: 'katex', test: /node_modules[\\/]katex[\\/]/, priority: 30 },
            // зависимости recharts (d3, decimal.js, анимация) — отдельно от самого recharts
            { name: 'recharts-deps', test: /node_modules[\\/](d3-[a-z-]+|decimal\.js-light|react-smooth|fast-equals|recharts-scale|victory-vendor|internmap|lodash|eventemitter3|tiny-invariant|clsx|react-is|prop-types|dom-helpers|react-transition-group)[\\/]/, priority: 25 },
            { name: 'recharts', test: /node_modules[\\/]recharts[\\/]/, priority: 20, maxSize: 360 * 1024 },
            // движок партии (расчёт, политика, карта, тексты новостей) — делится на части до 360 КБ
            { name: 'engine', test: /src[\\/]lib[\\/]((engine|autopilot)\.js|model[\\/]|content[\\/]|politics[\\/]|world[\\/])/, priority: 10, maxSize: 360 * 1024 },
          ],
        },
      },
    },
  },
})
