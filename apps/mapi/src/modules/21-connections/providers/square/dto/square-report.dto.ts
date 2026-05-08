import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ReportQuerySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe ser YYYY-MM-DD')
      .describe('Fecha del reporte (un solo día)'),
  })
  .describe('Query del endpoint reporte Square')

export class SquareReportQueryDto extends createZodDto(ReportQuerySchema) {}

const ReportResponseSchema = z
  .object({
    message: z.string(),
    clientId: z.string().uuid(),
    locationId: z.string(),
    merchantId: z.string(),
    date: z.string(),
  })
  .describe('Respuesta placeholder del reporte (la lógica real entra en v0.12.1+)')

export class SquareReportResponseDto extends createZodDto(ReportResponseSchema) {}
