import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * DTOs de request para los endpoints del adapter Chase (v0.18.0).
 * Fechas en `MM-DD-YYYY` (formato público del adapter). `accountMask` = 4 dígitos.
 */

const mask = z
  .string()
  .regex(/^\d{4}$/, 'accountMask deben ser 4 dígitos')
  .describe('Últimos 4 dígitos de la cuenta Chase.')

const mmddyyyy = (label: string) =>
  z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/, `${label} debe ser MM-DD-YYYY`)
    .describe(`${label} en formato MM-DD-YYYY.`)

export const ChaseSearchSchema = z
  .object({
    accountMask: mask,
    from: mmddyyyy('from'),
    to: mmddyyyy('to'),
    type: z.enum(['CHECK', 'DEPOSIT']).describe('Tipo de actividad a buscar.'),
  })
  .strict()
export class ChaseSearchDto extends createZodDto(ChaseSearchSchema) {}

export const ChaseRangeSchema = z
  .object({
    accountMask: mask,
    from: mmddyyyy('from'),
    to: mmddyyyy('to'),
  })
  .strict()
export class ChaseRangeDto extends createZodDto(ChaseRangeSchema) {}

export const ChaseTransactionsSchema = z
  .object({
    accountMask: mask,
    from: mmddyyyy('from'),
    to: mmddyyyy('to'),
    format: z.enum(['CSV', 'QBO']).describe('Formato del archivo a descargar.'),
  })
  .strict()
export class ChaseTransactionsDto extends createZodDto(ChaseTransactionsSchema) {}

export const ChaseStatementsSchema = z
  .object({
    accountMask: mask,
    year: z
      .string()
      .regex(/^\d{4}$/, 'year debe ser YYYY')
      .describe('Año de inicio (YYYY).'),
    month: z
      .string()
      .regex(/^([1-9]|1[0-2])$/, 'month debe ser 1-12')
      .describe('Mes de inicio (1-12).'),
  })
  .strict()
export class ChaseStatementsDto extends createZodDto(ChaseStatementsSchema) {}
