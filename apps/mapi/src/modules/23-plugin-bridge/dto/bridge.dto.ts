import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * DTO de request para `POST /v1/bridge/dom` (v0.20.0).
 *
 * La "receta" es DATA genérica: una lista de pasos DOM que el plugin (kiro)
 * ejecuta en la pestaña `tabId`. mapi NO interpreta los selectores — los arma
 * quien llama (el frontend, o más adelante la receta de login de Chase, Fase 4).
 */

const selector = z.string().min(1).describe('Selector CSS del elemento objetivo.')

const DomStepSchema = z
  .discriminatedUnion('op', [
    z
      .object({
        op: z.literal('fill'),
        selector,
        value: z.string().describe('Valor a escribir (native setter + eventos input/change).'),
      })
      .strict(),
    z.object({ op: z.literal('click'), selector }).strict(),
    z
      .object({
        op: z.literal('waitFor'),
        selector,
        timeoutMs: z.number().int().positive().optional().describe('Timeout del polling (ms).'),
      })
      .strict(),
    z.object({ op: z.literal('getText'), selector }).strict(),
  ])
  .describe('Paso DOM: fill | click | waitFor | getText.')

export const ExecuteDomSchema = z
  .object({
    tabId: z
      .number()
      .int()
      .describe('Id de la pestaña objetivo (obtenido de POST /v1/bridge/tabs).'),
    steps: z.array(DomStepSchema).min(1).describe('Receta de pasos a ejecutar en orden.'),
  })
  .strict()
export class ExecuteDomDto extends createZodDto(ExecuteDomSchema) {}
