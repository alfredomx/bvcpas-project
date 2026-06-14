import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { BankDownloadService } from './bank-download.service'
import { BankSessionService } from './bank-session.service'
import {
  DownloadChecksDto,
  DownloadChecksResponseDto,
  DownloadChecksSchema,
  DownloadDepositsDto,
  DownloadDepositsResponseDto,
  DownloadDepositsSchema,
  DownloadStatementsDto,
  DownloadStatementsResponseDto,
  DownloadStatementsSchema,
  DownloadTransactionsDto,
  DownloadTransactionsResponseDto,
  DownloadTransactionsSchema,
  ListAccountsRequestDto,
  ListAccountsRequestSchema,
  ListAccountsResponseDto,
  ListCredentialsQueryDto,
  ListCredentialsQuerySchema,
  ListCredentialsResponseDto,
  type DownloadChecksResponse,
  type DownloadDepositsResponse,
  type DownloadStatementsResponse,
  type DownloadTransactionsResponse,
  type ListAccountsResponse,
  type ListCredentialsResponse,
} from './dto/bank-download.dto'

/**
 * Step-flow de descarga bancaria (v0.21.0). Pasos del flujo
 * "descarga de <cliente> de <banco> todos los cheques":
 *
 *  1. `GET  /v1/clients/:id/banking/download/credentials` — elegir credencial (vault).
 *  2. `POST /v1/clients/:id/banking/download/accounts` — login + cuentas EN VIVO.
 *  3. `POST /v1/clients/:id/banking/download/checks` — descargar cheques.
 *
 * El `:id` (clientId) va en la URL para control de acceso (`ClientAccessGuard`).
 * Corre sobre la sesión viva del banco vía el bridge (Design B): requiere kiro
 * conectado. Sin plugin → 503; sin respuesta → 504; el banco falla → 502; portal
 * sin adapter → 501.
 */
@ApiTags('Banking - Download')
@ApiBearerAuth('bearer')
@Controller('clients/:id/banking/download')
@UseGuards(ClientAccessGuard)
export class BankDownloadController {
  constructor(
    private readonly service: BankDownloadService,
    private readonly session: BankSessionService,
  ) {}

  @Get('credentials')
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Lista las credenciales del cliente (vault) para elegir cuál usar',
    description:
      'Devuelve cada credencial bancaria del cliente con su portal. NUNCA expone username/password. ' +
      '`?portal=` filtra difuso por nombre de portal (ej. "rbfcu"). `download_supported` indica si ' +
      'el portal tiene adapter implementado. Las cuentas individuales se listan EN VIVO con ' +
      '`POST .../accounts` (el operador no las registra en vault).',
  })
  @ApiResponse({
    status: 200,
    description: 'Credenciales del cliente.',
    type: ListCredentialsResponseDto,
  })
  async listCredentials(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(ListCredentialsQuerySchema)) query: ListCredentialsQueryDto,
  ): Promise<ListCredentialsResponse> {
    return this.service.listCredentials(clientId, query.portal)
  }

  @Post('accounts')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Auto-login + lista las cuentas EN VIVO del banco para elegir cuáles descargar',
    description:
      'Si ya hay sesión viva la usa; si no, abre/ubica la pestaña del logonbox (`list_tabs`/' +
      '`open_tab`), manda la receta de login (`execute_dom`) con las credenciales del vault, y ' +
      'lista las cuentas reales del banco. Devuelve también `today` (zona del cliente) como ancla ' +
      'para traducir rangos libres a `from`/`to`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuentas en vivo + ancla de fecha.',
    type: ListAccountsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Credencial no encontrada.' })
  @ApiResponse({ status: 501, description: 'Portal sin adapter o sin login automatizado.' })
  @ApiResponse({ status: 502, description: 'No se pudo establecer la sesión (login/MFA/banco).' })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  async listAccounts(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(ListAccountsRequestSchema)) body: ListAccountsRequestDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ListAccountsResponse> {
    return this.session.listAccounts(clientId, body.credentialId, actor.userId)
  }

  @Post('checks')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga cheques de N cuentas en un rango (preset o explícito)',
    description:
      'Resuelve el rango: `range` preset (today, yesterday, last_7_days, last_week, last_30_days, ' +
      'this_month, last_month, this_year, last_year) o `from`+`to` (MM-DD-YYYY). Descarga cada ' +
      'cuenta de `accountMasks` (las elegidas de `.../accounts`) sobre la sesión viva. Cuentas sin ' +
      'cheques regresan `count: 0`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cheques (imágenes base64) por cuenta.',
    type: DownloadChecksResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Credencial o mask (en el banco) no encontrada.' })
  @ApiResponse({ status: 501, description: 'El portal no tiene adapter de descarga implementado.' })
  @ApiResponse({ status: 502, description: 'El banco falló el fetch (vía plugin).' })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  async checks(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(DownloadChecksSchema)) body: DownloadChecksDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<DownloadChecksResponse> {
    return this.service.downloadChecks(clientId, body, actor.userId)
  }

  @Post('deposits')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga depósitos (slip + cheques del depósito) en un rango',
    description:
      'Por cada cuenta baja el slip y los cheques de cada depósito. Con `save=true` los guarda como ' +
      'PDF `MM-DD-YYYY - <checkNumber> (<amount>).pdf` (CON monto) en `.downloads/<cliente>/<mask>/`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Depósitos por cuenta.',
    type: DownloadDepositsResponseDto,
  })
  async deposits(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(DownloadDepositsSchema)) body: DownloadDepositsDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<DownloadDepositsResponse> {
    return this.service.downloadDeposits(clientId, body, actor.userId)
  }

  @Post('statements')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga estados de cuenta (PDF) desde year/month al mes actual',
    description:
      'Con `save=true` los guarda como `YYYY-MM.pdf` en `.downloads/<cliente>/<mask>/` (como el ' +
      'plugin original). `month` opcional (sin él, desde enero del `year`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Statements por cuenta.',
    type: DownloadStatementsResponseDto,
  })
  async statements(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(DownloadStatementsSchema)) body: DownloadStatementsDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<DownloadStatementsResponse> {
    return this.service.downloadStatements(clientId, body, actor.userId)
  }

  @Post('transactions')
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga el export de transacciones (CSV/QBO) por cuenta en un rango',
    description:
      'Con `save=true` guarda `<mask> (<from> to <to>).<csv|qbo>` en `.downloads/<cliente>/<mask>/` ' +
      '(como el plugin original). Sin `save`, devuelve el contenido en la respuesta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export por cuenta.',
    type: DownloadTransactionsResponseDto,
  })
  async transactions(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(DownloadTransactionsSchema)) body: DownloadTransactionsDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<DownloadTransactionsResponse> {
    return this.service.downloadTransactions(clientId, body, actor.userId)
  }
}
