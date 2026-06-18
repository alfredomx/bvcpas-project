import type { ModuleDef } from '@/registry/module-def'
import { BankDownloadModule } from './bank-download.module'

/**
 * Manifiesto del plugin Bank Downloader para el registro del core. Sin `config`:
 * no tiene env vars propias (usa el `BANK_CREDENTIALS_PORT`, el
 * `BRIDGE_COMMAND_PORT` y la `REDIS_URL` del core).
 */
export const bankDownloaderPlugin: ModuleDef = {
  name: 'bank-downloader',
  type: 'plugin',
  module: BankDownloadModule,
}
