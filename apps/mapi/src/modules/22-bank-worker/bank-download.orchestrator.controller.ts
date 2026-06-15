import { Body, Controller, HttpCode, Post } from '@nestjs/common'
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
 * Verbo único de descarga bancaria (v0.27.0). Una sola llamada hace todo:
 * resuelve el cliente por nombre, elige la credencial descargable, hace login en
 * vivo, descarga y (al terminar) desloguea + cierra la pestaña.
 *
 * `POST /v1/banking/download { client, what, params }`. Reemplaza el encadenado
 * manual de 4 endpoints (`credentials` → `accounts` → `download_*`). Los step
 * endpoints por `:id` siguen existiendo para control fino.
 */
@ApiTags('Banking - Download')
@ApiBearerAuth('bearer')
@Controller('banking/download')
export class BankDownloadOrchestratorController {
  constructor(private readonly orchestrator: BankDownloadOrchestratorService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'Descarga bancaria en 1 llamada (resuelve cliente + login + descarga + logout)',
    description:
      'Verbo único: `client` (nombre o UUID) + `what` (checks/deposits/statements/transactions) + ' +
      '`params` (range/from/to/year/month/format/save según el tipo). Resuelve el cliente por ' +
      'nombre (auto-elige si solo uno tiene credencial descargable; si hay varios → 409 con ' +
      'candidatos), elige la credencial con adapter (Chase), hace login en vivo, descarga por la ' +
      'cola, y al terminar desloguea + cierra la pestaña. `accounts:"all"` (default) = todas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Descarga completada (incluye el resultado del download_* en `result`).',
    type: OrchestrateDownloadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos para el tipo.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'Cliente ambiguo o varias credenciales descargables (ver `details`).',
  })
  @ApiResponse({ status: 422, description: 'El cliente no tiene credencial descargable.' })
  @ApiResponse({ status: 502, description: 'No se pudo establecer la sesión (login/MFA/banco).' })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  async download(
    @Body(new ZodValidationPipe(OrchestrateDownloadSchema)) body: OrchestrateDownloadDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<OrchestrateDownloadResponse> {
    return this.orchestrator.orchestrate(body, actor.userId)
  }
}
