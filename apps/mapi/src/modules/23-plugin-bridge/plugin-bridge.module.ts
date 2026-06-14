import { Module } from '@nestjs/common'
import { BridgeAdminController } from './bridge-admin.controller'
import { BridgeCommandService } from './bridge-command.service'
import { PluginBridgeGateway } from './plugin-bridge.gateway'

/**
 * Módulo del bridge WS mapi↔plugin (kiro). Expone `BridgeCommandService` para
 * que otros módulos (ej. 22-bank-worker) manden comandos al plugin.
 *
 * Requiere `app.useWebSocketAdapter(new WsAdapter(app))` en el bootstrap
 * (ver main.ts) para que el gateway use `ws` en vez de socket.io.
 */
@Module({
  controllers: [BridgeAdminController],
  providers: [PluginBridgeGateway, BridgeCommandService],
  exports: [BridgeCommandService],
})
export class PluginBridgeModule {}
