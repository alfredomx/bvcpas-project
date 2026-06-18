import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { BankSessionService } from './bank-session.service'
import { BankDownloadService } from './bank-download.service'
import { BankDownloadQueueService, type BankDownloadJob } from './bank-download.queue'
import {
  downloadChecksSchema,
  downloadDepositsSchema,
  downloadStatementsSchema,
  downloadTransactionsSchema,
  listAccountsRequestSchema,
  listActivitySchema,
  listStatementRefsSchema,
  type DownloadChecksDto,
  type DownloadDepositsDto,
  type DownloadStatementsDto,
  type DownloadTransactionsDto,
  type ListAccountsRequestDto,
  type ListAccountsResponse,
  type ListActivityDto,
  type ListActivityResponse,
  type ListStatementRefsDto,
  type ListStatementRefsResponse,
} from './dto/bank-download.dto'

/** Respuesta de un verbo de descarga: el job quedó encolado (fire-and-forget). */
interface EnqueuedJob {
  jobId: string
}

/**
 * Descarga bancaria (bajo el `AdminGuard` global). Rutas flat `/v1/bank/download/*`;
 * `clientId` se deriva del `credentialId` (vía `BANK_CREDENTIALS_PORT`), nunca va
 * en la ruta.
 *
 * - **accounts**: login + cuentas EN VIVO (síncrono — interactivo: ver qué hay y
 *   sacar masks antes de encolar).
 * - **checks/deposits/statements/transactions**: **fire-and-forget** → `202
 *   { jobId }` al instante; el worker hace TODO (login → descarga → logout),
 *   persiste a disco, y el resultado/fallo queda en bull-board.
 * - **`.../list`**: preview/read sin imágenes (síncrono, directo al service).
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
  @HttpCode(202)
  checks(
    @Body(new ZodValidationPipe(downloadChecksSchema)) dto: DownloadChecksDto,
  ): Promise<EnqueuedJob> {
    return this.enqueue({ kind: 'checks', dto }, `checks:${dto.credentialId}`)
  }

  @Post('deposits')
  @HttpCode(202)
  deposits(
    @Body(new ZodValidationPipe(downloadDepositsSchema)) dto: DownloadDepositsDto,
  ): Promise<EnqueuedJob> {
    return this.enqueue({ kind: 'deposits', dto }, `deposits:${dto.credentialId}`)
  }

  @Post('statements')
  @HttpCode(202)
  statements(
    @Body(new ZodValidationPipe(downloadStatementsSchema)) dto: DownloadStatementsDto,
  ): Promise<EnqueuedJob> {
    return this.enqueue({ kind: 'statements', dto }, `statements:${dto.credentialId}`)
  }

  @Post('transactions')
  @HttpCode(202)
  transactions(
    @Body(new ZodValidationPipe(downloadTransactionsSchema)) dto: DownloadTransactionsDto,
  ): Promise<EnqueuedJob> {
    return this.enqueue({ kind: 'transactions', dto }, `transactions:${dto.credentialId}`)
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

  /** Encola el job y devuelve su `jobId` (el worker lo procesa después). */
  private async enqueue(job: BankDownloadJob, label: string): Promise<EnqueuedJob> {
    return { jobId: await this.queue.enqueue(job, label) }
  }
}
