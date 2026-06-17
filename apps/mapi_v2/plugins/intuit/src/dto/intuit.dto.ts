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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD')

/** Query del report derivado `GET .../reports/uncat-amas`. */
export const uncatAmasQuerySchema = z.object({
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  accounting_method: z.enum(['Accrual', 'Cash']).optional(),
  category: z
    .enum(['uncategorized_expense', 'uncategorized_income', 'ask_my_accountant'])
    .optional(),
})
export type UncatAmasQuery = z.infer<typeof uncatAmasQuerySchema>
