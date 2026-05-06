import '@testing-library/jest-dom/vitest'

// React 19 requiere este flag para que act(...) funcione en JSDOM.
// Sin esto, los tests pasan pero React imprime warnings ruidosos.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
