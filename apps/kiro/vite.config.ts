import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'manifest.json', dest: '.' }],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
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
