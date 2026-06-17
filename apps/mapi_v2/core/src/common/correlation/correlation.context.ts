import { AsyncLocalStorage } from 'node:async_hooks'

export interface CorrelationContext {
  correlationId: string
}

/**
 * Storage por request para propagar el `correlation_id` a logs y a cualquier
 * código async-aware sin necesidad de pasarlo explícitamente como argumento.
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationContext>()

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId
}
