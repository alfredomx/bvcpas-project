import type { ModuleDef } from '@/registry/module-def'
import { BridgeModule } from './bridge.module'

/** Manifiesto del plugin Bridge para el registro del core. Sin `config`. */
export const bridgePlugin: ModuleDef = {
  name: 'bridge',
  type: 'plugin',
  module: BridgeModule,
}
