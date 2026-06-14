import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import { BridgeCommandService } from './bridge-command.service'
import type { DomResult, ListTabsResult } from './bridge.types'
import { ExecuteDomDto, ExecuteDomSchema } from './dto/bridge.dto'

/**
 * Endpoints admin del bridge (v0.20.0, Fase 2 de browser-automation).
 *
 * Exponen por HTTP las capacidades genéricas del plugin (kiro):
 *  - listar las pestañas abiertas (para elegir la del banco),
 *  - ejecutar una receta DOM (`fill`/`click`/`waitFor`/`getText`) en una pestaña.
 *
 * Design B: mapi manda la receta como DATA; kiro la ejecuta a ciegas (sin lógica
 * de banco). La receta concreta (selectores) la decide quien llama — el frontend
 * o, más adelante, la receta de login de Chase (Fase 4).
 *
 * Pre-requisitos en vivo: kiro conectado al bridge con la pestaña objetivo
 * abierta. Si no hay plugin → 503; si el plugin no responde a tiempo → 504.
 */
@ApiTags('Bridge')
@ApiBearerAuth('bearer')
@Controller('bridge')
@RequirePermission('banking.read')
export class BridgeAdminController {
  constructor(private readonly commands: BridgeCommandService) {}

  @Post('tabs')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Lista las pestañas abiertas en el Chrome del operador (vía el plugin)',
    description:
      'Manda `list_tabs` al plugin y devuelve la lista cruda de pestañas. Úsalo para ' +
      'obtener el `tabId` de la pestaña del banco antes de mandar una receta DOM.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pestañas { tabId, url, title, active, windowId }.',
  })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  @ApiResponse({ status: 504, description: 'El plugin no respondió a tiempo.' })
  async tabs(): Promise<ListTabsResult> {
    return (await this.commands.send({ type: 'list_tabs' })) as ListTabsResult
  }

  @Post('dom')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ejecuta una receta DOM (fill/click/waitFor/getText) en una pestaña',
    description:
      'Manda `execute_dom` al plugin con `{ tabId, steps }`. El plugin ejecuta los pasos en ' +
      'orden sobre el DOM de esa pestaña y devuelve el resultado. Los selectores los dicta el ' +
      'caller (Design B). Ejemplo (login): fill usuario, fill contraseña, click en Sign in.',
  })
  @ApiResponse({ status: 200, description: 'DomResult { ok, results, failedStep?, error? }.' })
  @ApiResponse({ status: 503, description: 'No hay plugin conectado.' })
  @ApiResponse({ status: 504, description: 'El plugin no respondió a tiempo.' })
  async dom(
    @Body(new ZodValidationPipe(ExecuteDomSchema)) body: ExecuteDomDto,
  ): Promise<DomResult> {
    return (await this.commands.send({
      type: 'execute_dom',
      payload: { tabId: body.tabId, steps: body.steps },
    })) as DomResult
  }
}
