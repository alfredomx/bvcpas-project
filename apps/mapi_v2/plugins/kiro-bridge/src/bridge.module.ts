import { Global, Module } from '@nestjs/common'
import { BRIDGE_COMMAND_PORT } from '@/contracts/bridge.port'
import { BridgeCommandService } from './bridge-command.service'
import { BridgeGateway } from './bridge.gateway'
import { BridgeAdminController } from './bridge-admin.controller'

/**
 * Plugin Bridge: transporte WS mapi↔kiro. Gateway (`/bridge`) + command service
 * (request/response correlacionado). `@Global` + export del `BRIDGE_COMMAND_PORT`:
 * otros plugins (bank-downloader) inyectan el token del core sin importar este
 * módulo (D-core-027). Requiere el `WsAdapter` en el bootstrap.
 */
@Global()
@Module({
  controllers: [BridgeAdminController],
  providers: [
    BridgeGateway,
    BridgeCommandService,
    { provide: BRIDGE_COMMAND_PORT, useExisting: BridgeCommandService },
  ],
  exports: [BRIDGE_COMMAND_PORT],
})
export class BridgeModule {}
