import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { BankPortalsService } from './bank-portals.service'
import { createPortalSchema, type CreatePortalDto } from './dto/bank-credentials.dto'
import type { BankPortal } from './bank-portals.schema'

const uuidPipe = new ZodValidationPipe(z.string().uuid())

/**
 * Catálogo GLOBAL de portales bancarios (bajo el `AdminGuard` global). Sin
 * cliente en la ruta: el catálogo es compartido (D-bank-003).
 */
@Controller('bank/portals')
export class BankPortalsController {
  constructor(private readonly portals: BankPortalsService) {}

  @Get()
  list(): Promise<BankPortal[]> {
    return this.portals.list()
  }

  @Get(':id')
  getById(@Param('id', uuidPipe) id: string): Promise<BankPortal> {
    return this.portals.getById(id)
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createPortalSchema)) dto: CreatePortalDto,
  ): Promise<BankPortal> {
    return this.portals.create(dto)
  }
}
