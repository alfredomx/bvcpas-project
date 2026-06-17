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
