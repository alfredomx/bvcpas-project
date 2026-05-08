import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ReportQuerySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe ser YYYY-MM-DD')
      .describe('Fecha del reporte (un solo día)'),
  })
  .describe('Query del endpoint reporte Clover')

export class CloverReportQueryDto extends createZodDto(ReportQuerySchema) {}

const ReportResponseSchema = z
  .object({
    message: z.string(),
    clientId: z.string().uuid(),
    merchantId: z.string(),
    date: z.string(),
  })
  .describe('Respuesta placeholder del reporte (la lógica real entra en v0.11.1+)')

export class CloverReportResponseDto extends createZodDto(ReportResponseSchema) {}
