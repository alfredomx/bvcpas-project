// Contrato del ejecutor de operaciones DOM genérico (Design B).
//
// IMPORTANTE (protección de IP / el moat): este módulo NO contiene NINGUNA
// lógica de bancos, NI selectores, NI valores, NI orden de pasos. Todo eso vive
// en mapi y llega como DATA (una "receta"). El plugin es un intérprete tonto:
// recibe una lista de pasos genéricos y los ejecuta sobre el DOM de la pestaña.
//
// Por qué DATA y no código: MV3 prohíbe `eval`/`new Function` en extensiones
// (CSP), así que mapi no puede mandar una función para evaluar. Manda los pasos
// como objetos y kiro los interpreta con un set fijo de operaciones.

/** Una operación DOM genérica. El `selector` y `value` los dicta mapi. */
export type DomStep =
  | { op: 'fill'; selector: string; value: string }
  | { op: 'click'; selector: string }
  | { op: 'waitFor'; selector: string; timeoutMs?: number }
  | { op: 'getText'; selector: string }

/** Nombre de operación (para resultados). */
export type DomOp = DomStep['op']

/**
 * Receta de pasos DOM recibida del bridge. Genérica: el plugin no interpreta el
 * significado de los selectores ni valores — solo ejecuta en orden.
 */
export interface DomInstruction {
  /** Correlación con el bridge — se devuelve tal cual en la respuesta. */
  requestId: string
  steps: DomStep[]
}

/** Resultado de un paso individual. */
export interface DomStepResult {
  op: DomOp
  ok: boolean
  /** Solo para `getText`: el texto leído del elemento. */
  value?: string
}

/**
 * Resultado de ejecutar una receta, correlacionado por `requestId`. Si un paso
 * falla (selector no encontrado / timeout), se detiene ahí: `ok:false`,
 * `failedStep` = índice del paso, `error` = mensaje.
 */
export interface DomResult {
  requestId: string
  ok: boolean
  results: DomStepResult[]
  failedStep?: number
  error?: string
}
