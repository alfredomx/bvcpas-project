// Contrato de mensajes del ejecutor de fetch genérico (Design B).
//
// IMPORTANTE (protección de IP): este módulo NO contiene NINGUNA lógica de
// bancos, NI URLs/dominios bancarios, NI mecánica de tokens. Todo eso vive en
// mapi (server-side). El plugin es un ejecutor tonto: recibe una orden
// "ejecuta este fetch" y devuelve la respuesta cruda. Los dominios, URLs,
// headers y tokens los dicta SIEMPRE quien llama (mapi vía bridge).

/** Verbos HTTP que el ejecutor acepta. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/**
 * Orden de fetch recibida del bridge. Genérica: el `url`, `headers` y `body`
 * los arma mapi. El plugin no interpreta ni conoce su significado.
 */
export interface FetchInstruction {
  /** Correlación con el bridge — se devuelve tal cual en la respuesta. */
  requestId: string
  method: HttpMethod
  /** URL absoluta. La pestaña ejecutora debe ser same-origin para cargar cookies. */
  url: string
  /** Headers opcionales (ej. Accept, X-CSRF-Token). Los provee mapi. */
  headers?: Record<string, string>
  /** Body opcional (string ya serializado por mapi). */
  body?: string
}

/** Cómo viene serializado el body de la respuesta. */
export type BodyEncoding = 'text' | 'base64'

/**
 * Respuesta cruda del fetch, correlacionada por `requestId`. El body se
 * serializa como texto (JSON/texto) o base64 (binario: PDF/imagen/octet-stream)
 * según el `content-type` de la respuesta.
 */
export interface FetchResult {
  requestId: string
  /** true si la red respondió con status 2xx; false en error de red o no-2xx. */
  ok: boolean
  /** Status HTTP. 0 cuando hubo error de red (no hubo respuesta). */
  status: number
  /** Headers de la respuesta (lowercased por la API de fetch). */
  headers: Record<string, string>
  /** Body serializado. Vacío en error de red. */
  body: string
  /** Cómo está codificado `body`. */
  bodyEncoding: BodyEncoding
  /** Mensaje de error en fallo de red. Ausente en respuestas con status. */
  error?: string
}

/** Orden de chequeo de sesión. El dominio lo dicta quien llama (mapi). */
export interface CheckSessionInstruction {
  /**
   * Dominio (host) del portal a verificar, ej. "example.com". AGNÓSTICO: el
   * plugin no hardcodea dominios bancarios — los recibe como parámetro.
   */
  bank: string
}

/** Resultado del chequeo de sesión. */
export interface CheckSessionResult {
  bank: string
  /** true si existe al menos una pestaña abierta cuyo host coincide con `bank`. */
  authenticated: boolean
  /** Cuántas pestañas del dominio se encontraron (0 si ninguna). */
  tabCount: number
}

// --- Capa de transporte agnóstica (bridge) ---

export interface ExecuteFetchCommand {
  type: 'execute_fetch'
  instruction: FetchInstruction
}

export interface CheckSessionCommand {
  type: 'check_session'
  instruction: CheckSessionInstruction
}

/** Unión de comandos que el handler del bridge sabe despachar. */
export type BridgeCommand = ExecuteFetchCommand | CheckSessionCommand

/** Respuesta del despacho del bridge, según el comando. */
export type BridgeCommandResult = FetchResult | CheckSessionResult
