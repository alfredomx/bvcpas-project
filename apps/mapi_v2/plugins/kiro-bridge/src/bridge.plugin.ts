import type { ModuleDef } from '@/registry/module-def'
import { BridgeModule } from './bridge.module'

/** Manifiesto del plugin Kiro-Bridge para el registro del core. Sin `config`. */
export const kiroBridgePlugin: ModuleDef = {
  name: 'kiro-bridge',
  type: 'plugin',
  module: BridgeModule,
}
