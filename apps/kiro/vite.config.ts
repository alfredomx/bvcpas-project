import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// La versión de la extensión (la que Chrome muestra) sale del package.json, NO
// del manifest a mano: así un bump de versión propaga solo al manifest del build
// y nunca se desfasa (antes el manifest se quedaba viejo). El manifest.json del
// repo mantiene la misma versión por claridad, pero el build siempre la reescribe.
const pkgVersion = (
  JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
).version

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.',
          transform: (content) =>
            JSON.stringify({ ...JSON.parse(content), version: pkgVersion }, null, 2),
        },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // El content script NO va aquí: se compila aparte (vite.content.config.ts)
      // como IIFE auto-contenido, porque un content script classic no admite
      // `import`. El SW (`type:module`) y el popup (`type:module`) sí admiten
      // chunks ESM, así que se quedan en este build multi-entry.
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'popup/[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    minify: false,
  },
})
