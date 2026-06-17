import { Controller, Get, Param, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitDerivedReportsService, type UncatAmaRow } from './intuit-derived-reports.service'
import { uncatAmasQuerySchema, type UncatAmasQuery } from './dto/intuit.dto'

const uuidPipe = new ZodValidationPipe(z.string().uuid())
const queryPipe = new ZodValidationPipe(uncatAmasQuerySchema)

/**
 * Reports DERIVADOS de QBO (read-through, GET-only). Ruta literal bajo
 * `/v1/intuit/:clientId/reports/...`, igual que los passthrough pero con lógica
 * propia (no pertenece al catálogo `QBO_REPORTS`). Bajo el `AdminGuard` global.
 */
@Controller('intuit')
export class IntuitDerivedReportsController {
  constructor(private readonly derived: IntuitDerivedReportsService) {}

  @Get(':clientId/reports/uncat-amas')
  uncatAmas(
    @Param('clientId', uuidPipe) clientId: string,
    @Query(queryPipe) q: UncatAmasQuery,
  ): Promise<UncatAmaRow[]> {
    return this.derived.uncatAmas(clientId, {
      startDate: q.start_date,
      endDate: q.end_date,
      accountingMethod: q.accounting_method,
      category: q.category,
    })
  }
}
