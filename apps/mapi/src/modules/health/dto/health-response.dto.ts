import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ComponentHealthSchema = z
  .object({
    status: z.enum(['up', 'down']).describe('Estado del componente'),
    latency_ms: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Latencia de la última comprobación'),
    error: z.string().optional().describe('Mensaje de error si status=down'),
  })
  .describe('Estado de un componente individual (DB, Redis, etc.)')

const HealthResponseSchema = z
  .object({
    status: z.enum(['up', 'down']).describe('Estado agregado del servicio'),
    version: z.string().describe('Versión del backend'),
    env: z.enum(['local', 'test', 'production']).describe('Entorno de ejecución'),
    uptime_s: z.number().int().nonnegative().describe('Segundos desde el arranque'),
    timestamp: z.string().datetime().describe('Timestamp ISO de la respuesta'),
    components: z
      .object({
        db: ComponentHealthSchema,
      })
      .describe('Estado de cada dependencia externa'),
  })
  .describe('Respuesta del healthcheck principal')

export class HealthResponseDto extends createZodDto(HealthResponseSchema) {}
