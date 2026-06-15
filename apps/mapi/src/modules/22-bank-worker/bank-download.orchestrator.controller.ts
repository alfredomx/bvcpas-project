import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { BankDownloadOrchestratorService } from './bank-download.orchestrator.service'
import {
  OrchestrateDownloadDto,
  OrchestrateDownloadResponseDto,
  OrchestrateDownloadSchema,
  type OrchestrateDownloadResponse,
} from './dto/bank-download.dto'

/**
 * Verbo único de descarga bancaria (v0.27.0 → batch v0.28.0). `client` es uno o
 * **varios** nombres/UUIDs. mapi resuelve cada cliente + credencial y **encola 1
 * job por cliente**; el worker hace login → descarga → logout serializado por la
 * cola (1 sesión de banco a la vez). Async: responde **202** con `{ jobs }` —
 * jobId o error por cliente. El avance/resultado/fallos quedan en bull-board.
 *
 * `POST /v1/banking/download { client, what, params }`. Reemplaza el encadenado
 * manual de 4 endpoints. Los step endpoints por `:id` siguen para control fino.
 */
@ApiTags('Banking - Download')
@ApiBearerAuth('bearer')
@Controller('banking/download')
export class BankDownloadOrchestratorController {
  constructor(private readonly orchestrator: BankDownloadOrchestratorService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga bancaria de 1 o N clientes (encola; resuelve + login + descarga + logout)',
    description:
      'Verbo único: `client` (nombre/UUID o array) + `what` (checks/deposits/statements/' +
      'transactions) + `params` (range/from/to/year/month/format/save según el tipo). Resuelve ' +
      'cada cliente por nombre (auto-elige si solo uno tiene credencial descargable; si hay ' +
      'varios → error en ese entry), elige la credencial con adapter (Chase) y **encola 1 job por ' +
      'cliente**. El worker corre cada job (login en vivo → descarga → logout + cerrar pestaña) ' +
      'serializado por la cola = 1 sesión de banco a la vez. Responde 202 con `{ jobs }`; el ' +
      'avance/resultado/fallos se ven en bull-board. `accounts:"all"` (default) = todas.',
  })
  @ApiResponse({
    status: 202,
    description:
      'Jobs encolados. `jobs[]` lleva jobId (status=queued) o code/message (status=error) por cliente.',
    type: OrchestrateDownloadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parámetros (`params`) inválidos para el tipo.' })
  async download(
    @Body(new ZodValidationPipe(OrchestrateDownloadSchema)) body: OrchestrateDownloadDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<OrchestrateDownloadResponse> {
    return this.orchestrator.orchestrate(body, actor.userId)
  }
}
