import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { BankSessionService } from './bank-session.service'
import { BankDownloadService } from './bank-download.service'
import { BankDownloadQueueService } from './bank-download.queue'
import {
  downloadChecksSchema,
  downloadDepositsSchema,
  downloadStatementsSchema,
  downloadTransactionsSchema,
  listAccountsRequestSchema,
  listActivitySchema,
  listStatementRefsSchema,
  type DownloadChecksDto,
  type DownloadChecksResponse,
  type DownloadDepositsDto,
  type DownloadDepositsResponse,
  type DownloadStatementsDto,
  type DownloadStatementsResponse,
  type DownloadTransactionsDto,
  type DownloadTransactionsResponse,
  type ListAccountsRequestDto,
  type ListAccountsResponse,
  type ListActivityDto,
  type ListActivityResponse,
  type ListStatementRefsDto,
  type ListStatementRefsResponse,
} from './dto/bank-download.dto'

/**
 * Descarga bancaria (bajo el `AdminGuard` global). Rutas flat `/v1/bank/download/*`;
 * `clientId` se deriva del `credentialId` (vía `BANK_CREDENTIALS_PORT`), nunca va
 * en la ruta.
 *
 * - **accounts**: login + cuentas EN VIVO (síncrono, no encolado — necesita la
 *   sesión viva para responder y arrancar el step-flow).
 * - **checks/deposits/statements/transactions**: descargas pesadas → cola
 *   (`runAndWait`, 1 sesión de banco a la vez, respuesta inline).
 * - **`.../list`**: preview/read sin imágenes (síncrono, directo al service).
 *
 * Si no hay plugin conectado → 503; si el portal no tiene adapter → 501.
 */
@Controller('bank/download')
export class BankDownloadController {
  constructor(
    private readonly session: BankSessionService,
    private readonly service: BankDownloadService,
    private readonly queue: BankDownloadQueueService,
  ) {}

  @Post('accounts')
  @HttpCode(200)
  accounts(
    @Body(new ZodValidationPipe(listAccountsRequestSchema)) dto: ListAccountsRequestDto,
  ): Promise<ListAccountsResponse> {
    return this.session.listAccounts(dto.credentialId)
  }

  @Post('checks')
  @HttpCode(200)
  checks(
    @Body(new ZodValidationPipe(downloadChecksSchema)) dto: DownloadChecksDto,
  ): Promise<DownloadChecksResponse> {
    return this.queue.runAndWait({ kind: 'checks', dto }, `checks:${dto.credentialId}`)
  }

  @Post('deposits')
  @HttpCode(200)
  deposits(
    @Body(new ZodValidationPipe(downloadDepositsSchema)) dto: DownloadDepositsDto,
  ): Promise<DownloadDepositsResponse> {
    return this.queue.runAndWait({ kind: 'deposits', dto }, `deposits:${dto.credentialId}`)
  }

  @Post('statements')
  @HttpCode(200)
  statements(
    @Body(new ZodValidationPipe(downloadStatementsSchema)) dto: DownloadStatementsDto,
  ): Promise<DownloadStatementsResponse> {
    return this.queue.runAndWait({ kind: 'statements', dto }, `statements:${dto.credentialId}`)
  }

  @Post('transactions')
  @HttpCode(200)
  transactions(
    @Body(new ZodValidationPipe(downloadTransactionsSchema)) dto: DownloadTransactionsDto,
  ): Promise<DownloadTransactionsResponse> {
    return this.queue.runAndWait({ kind: 'transactions', dto }, `transactions:${dto.credentialId}`)
  }

  @Post('checks/list')
  @HttpCode(200)
  listChecks(
    @Body(new ZodValidationPipe(listActivitySchema)) dto: ListActivityDto,
  ): Promise<ListActivityResponse> {
    return this.service.listChecks(dto)
  }

  @Post('deposits/list')
  @HttpCode(200)
  listDeposits(
    @Body(new ZodValidationPipe(listActivitySchema)) dto: ListActivityDto,
  ): Promise<ListActivityResponse> {
    return this.service.listDeposits(dto)
  }

  @Post('statements/list')
  @HttpCode(200)
  listStatementRefs(
    @Body(new ZodValidationPipe(listStatementRefsSchema)) dto: ListStatementRefsDto,
  ): Promise<ListStatementRefsResponse> {
    return this.service.listStatementRefs(dto)
  }
}
