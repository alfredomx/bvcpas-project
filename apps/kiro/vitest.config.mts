import { defineConfig } from 'vitest/config'

// Tests Tipo A del plugin: lógica pura con `chrome` y `fetch` mockeados
// (vi.stubGlobal). No se carga Chrome real. Entorno jsdom para tener
// `Headers`, `URL`, `btoa` y demás Web APIs disponibles en los tests.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
