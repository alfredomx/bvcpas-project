import { z } from 'zod'
import { CLIENT_STATUSES } from '@/core/db/schema/clients'

/**
 * DTOs (Zod) del módulo clients. Se aplican por-ruta con `ZodValidationPipe`
 * en el controller. Solo campos genéricos del core (nada de QBO ni uncats).
 */
export const createClientSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  dba: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  fiscalYearStart: z.coerce.number().int().min(1).max(12).optional(),
  timezone: z.string().trim().max(60).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  primaryContactName: z.string().trim().max(120).optional(),
  primaryContactEmail: z.string().trim().email().max(255).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type CreateClientDto = z.infer<typeof createClientSchema>

/** Update = todos los campos opcionales (PATCH parcial). */
export const updateClientSchema = createClientSchema.partial()
export type UpdateClientDto = z.infer<typeof updateClientSchema>

/** Query de la lista: filtros + paginación. */
export const listClientsQuerySchema = z.object({
  status: z.enum(CLIENT_STATUSES).optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
