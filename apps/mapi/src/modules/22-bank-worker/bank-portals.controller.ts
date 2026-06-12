import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import {
  CreateBankPortalDto,
  CreateBankPortalSchema,
  UpdateBankPortalDto,
  UpdateBankPortalSchema,
  type BankPortalResponse,
} from './dto/bank-worker.dto'
import { BankPortalsService } from './bank-portals.service'

@ApiTags('Banking - Portals')
@ApiBearerAuth('bearer')
@Controller('banking/portals')
export class BankPortalsController {
  constructor(private readonly service: BankPortalsService) {}

  @Get()
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'GET /v1/banking/portals — lista todos los portales bancarios' })
  @ApiResponse({ status: 200, description: 'Lista de portales.' })
  async list(): Promise<{ data: BankPortalResponse[] }> {
    const data = await this.service.listAll()
    return { data }
  }

  @Get(':portalId')
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'GET /v1/banking/portals/:portalId — detalle de un portal' })
  @ApiResponse({ status: 200, description: 'Portal.' })
  @ApiResponse({ status: 404, description: 'Portal no existe.' })
  async findOne(@Param('portalId', ParseUUIDPipe) portalId: string): Promise<BankPortalResponse> {
    return this.service.findById(portalId)
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('banking.create')
  @ApiOperation({ summary: 'POST /v1/banking/portals — crea un portal' })
  @ApiResponse({ status: 201, description: 'Portal creado.' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado.' })
  async create(
    @Body(new ZodValidationPipe(CreateBankPortalSchema)) dto: CreateBankPortalDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<BankPortalResponse> {
    return this.service.create(dto, actor.userId)
  }

  @Patch(':portalId')
  @RequirePermission('banking.update')
  @ApiOperation({ summary: 'PATCH /v1/banking/portals/:portalId — edita un portal' })
  @ApiResponse({ status: 200, description: 'Portal actualizado.' })
  @ApiResponse({ status: 404, description: 'Portal no existe.' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado.' })
  async update(
    @Param('portalId', ParseUUIDPipe) portalId: string,
    @Body(new ZodValidationPipe(UpdateBankPortalSchema)) dto: UpdateBankPortalDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<BankPortalResponse> {
    return this.service.update(portalId, dto, actor.userId)
  }

  @Delete(':portalId')
  @HttpCode(204)
  @RequirePermission('banking.delete')
  @ApiOperation({ summary: 'DELETE /v1/banking/portals/:portalId — borra un portal' })
  @ApiResponse({ status: 204, description: 'Portal borrado.' })
  @ApiResponse({ status: 404, description: 'Portal no existe.' })
  @ApiResponse({ status: 409, description: 'Portal tiene credenciales asociadas.' })
  async delete(
    @Param('portalId', ParseUUIDPipe) portalId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.delete(portalId, actor.userId)
  }
}
