import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Build dedicado del content script. Un content script classic (lo que Chrome
// inyecta en `<all_urls>`) NO puede tener `import` — debe ser un único archivo
// auto-contenido (IIFE). El build multi-entry de vite.config.ts comparte chunks
// vía `import`, por eso el content script se compila aquí aparte con
// `inlineDynamicImports` + formato IIFE, y se escribe SIN vaciar el dist.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // no borra lo que ya emitió el build principal
    lib: {
      entry: resolve(__dirname, 'src/content.ts'),
      formats: ['iife'],
      name: 'KiroContent',
      fileName: () => 'content.js',
    },
    minify: false,
  },
})
