import { z } from 'zod'

/** Body de `POST /v1/intuit/oauth/connect`. */
export const connectDtoSchema = z.object({
  clientId: z.string().uuid(),
})
export type ConnectDto = z.infer<typeof connectDtoSchema>

/** Body del proxy `POST /v1/intuit/realms/:realmId/call`. */
export const callDtoSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  path: z.string().min(1),
  body: z.unknown().optional(),
})
export type CallDto = z.infer<typeof callDtoSchema>

/** Query de paginación de las listas tipadas (`GET .../<entidad>`). */
export const listQuerySchema = z.object({
  startPosition: z.coerce.number().int().min(1).optional(),
  maxResults: z.coerce.number().int().min(1).max(1000).optional(),
})
export type ListQuery = z.infer<typeof listQuerySchema>
