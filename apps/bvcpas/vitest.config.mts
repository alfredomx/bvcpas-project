import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  // jsx: 'automatic' permite escribir JSX en .tsx sin `import React`
  // explícito (es el runtime que usa Next.js). esbuild de Vite lo
  // transforma nativamente sin necesidad de @vitejs/plugin-react.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})
