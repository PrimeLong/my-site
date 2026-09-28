import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import textbookSections from './scripts/textbook-sections-plugin.js'
import serviceWorker from './scripts/sw-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), textbookSections(), serviceWorker()],
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
