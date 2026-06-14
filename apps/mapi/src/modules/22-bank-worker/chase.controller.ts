import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import { ChaseAdapter } from './adapters/chase.adapter'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import {
  ChaseRangeDto,
  ChaseRangeSchema,
  ChaseSearchDto,
  ChaseSearchSchema,
  ChaseStatementsDto,
  ChaseStatementsSchema,
  ChaseTransactionsDto,
  ChaseTransactionsSchema,
} from './dto/chase.dto'

/**
 * Endpoints del adapter Chase (v0.18.0, Design B). El adapter corre en mapi y
 * ejecuta cada fetch en la sesión viva de Chase vía el bridge (kiro).
 *
 * `:id` (clientId) NO lo usa el adapter (opera sobre la pestaña abierta); va en
 * la URL para control de acceso (`ClientAccessGuard`) y para dejar la ruta lista
 * cuando se persistan descargas por cliente. Permiso `banking.read`.
 *
 * Pre-requisitos en vivo: el operador con Chase logueado en una pestaña y kiro
 * conectado al bridge. Si no hay plugin → 503; si Chase no responde → 504/502.
 */
@ApiTags('Banking - Chase')
@ApiBearerAuth('bearer')
@Controller('clients/:id/banking/chase')
@UseGuards(ClientAccessGuard)
export class ChaseController {
  constructor(private readonly executor: BridgeFetchExecutor) {}

  private adapter(): ChaseAdapter {
    return new ChaseAdapter(this.executor)
  }

  @Get('accounts')
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'Lista las cuentas visibles en la sesión Chase del plugin' })
  @ApiResponse({ status: 200, description: 'Cuentas { id, mask, type, name }.' })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  async accounts(@Param('id', ParseUUIDPipe) _id: string): Promise<{ accounts: unknown[] }> {
    return { accounts: await this.adapter().getAllAccounts() }
  }

  @Post('search')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'Busca transacciones CHECK/DEPOSIT (paginado) en un rango' })
  @ApiResponse({ status: 200, description: 'Transacciones encontradas (crudas de Chase).' })
  async search(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body(new ZodValidationPipe(ChaseSearchSchema)) body: ChaseSearchDto,
  ): Promise<{ transactions: unknown[] }> {
    return {
      transactions: await this.adapter().searchTransactions(
        body.accountMask,
        body.from,
        body.to,
        body.type,
      ),
    }
  }

  @Post('checks')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'Descarga imágenes de cheques (base64) en un rango' })
  @ApiResponse({ status: 200, description: 'Cheques con imágenes front/rear en base64.' })
  async checks(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body(new ZodValidationPipe(ChaseRangeSchema)) body: ChaseRangeDto,
  ): Promise<{ checks: unknown }> {
    return { checks: await this.adapter().downloadChecks(body.accountMask, body.from, body.to) }
  }

  @Post('deposits')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'Descarga depósitos + slips + cheques asociados (base64)' })
  @ApiResponse({ status: 200, description: 'Depósitos con slip y cheques en base64.' })
  async deposits(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body(new ZodValidationPipe(ChaseRangeSchema)) body: ChaseRangeDto,
  ): Promise<{ deposits: unknown }> {
    return { deposits: await this.adapter().downloadDeposits(body.accountMask, body.from, body.to) }
  }

  @Post('transactions')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'Descarga transacciones en CSV/QBO (texto)' })
  @ApiResponse({ status: 200, description: '{ format, content } con el archivo como texto.' })
  async transactions(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body(new ZodValidationPipe(ChaseTransactionsSchema)) body: ChaseTransactionsDto,
  ): Promise<{ format: 'CSV' | 'QBO'; content: string }> {
    const buffer = await this.adapter().downloadTransactions(
      body.accountMask,
      body.from,
      body.to,
      body.format,
    )
    return { format: body.format, content: buffer.toString('utf8') }
  }

  @Post('statements')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga estados de cuenta (PDF base64) desde year/month al mes actual',
  })
  @ApiResponse({ status: 200, description: 'Statements con pdfBase64.' })
  async statements(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body(new ZodValidationPipe(ChaseStatementsSchema)) body: ChaseStatementsDto,
  ): Promise<{ statements: unknown }> {
    return {
      statements: await this.adapter().downloadStatements(body.accountMask, body.year, body.month),
    }
  }
}
