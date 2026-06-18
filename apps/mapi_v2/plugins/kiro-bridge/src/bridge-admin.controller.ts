import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import type { DomResult, ListTabsResult } from '@/contracts/bridge.port'
import { BridgeCommandService } from './bridge-command.service'
import { ExecuteDomSchema, type ExecuteDomDto } from './dto/bridge.dto'

/**
 * Endpoints admin del bridge (bajo el `AdminGuard` global). Exponen por HTTP las
 * capacidades genéricas de kiro: listar pestañas y ejecutar una receta DOM.
 * Design B: mapi manda la receta como DATA; kiro la ejecuta a ciegas.
 *
 * Si no hay plugin → 503; si el plugin no responde a tiempo → 504.
 */
@Controller('bridge')
export class BridgeAdminController {
  constructor(private readonly commands: BridgeCommandService) {}

  @Post('tabs')
  @HttpCode(200)
  async tabs(): Promise<ListTabsResult> {
    return (await this.commands.send({ type: 'list_tabs' })) as ListTabsResult
  }

  @Post('dom')
  @HttpCode(200)
  async dom(
    @Body(new ZodValidationPipe(ExecuteDomSchema)) body: ExecuteDomDto,
  ): Promise<DomResult> {
    return (await this.commands.send({
      type: 'execute_dom',
      payload: { tabId: body.tabId, steps: body.steps },
    })) as DomResult
  }
}
