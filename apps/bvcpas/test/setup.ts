import '@testing-library/jest-dom/vitest'

// React 19 requiere este flag para que act(...) funcione en JSDOM.
// Sin esto, los tests pasan pero React imprime warnings ruidosos.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// JSDOM no implementa layout — getBoundingClientRect siempre devuelve 0.
// Eso rompe @tanstack/react-virtual (necesita medir el scroll element).
// Stub global con un rect "razonable" suficiente para que useVirtualizer
// considere visible toda la lista en tests.
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: function () {
    return {
      x: 0,
      y: 0,
      width: 300,
      height: 800,
      top: 0,
      left: 0,
      right: 300,
      bottom: 800,
      toJSON() {},
    }
  },
})

// Algunos componentes usan ResizeObserver (tabs, dropdowns shadcn).
// JSDOM no lo trae; stub mínimo.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver
