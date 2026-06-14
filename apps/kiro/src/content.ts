// Entry del content script (kiro). Se inyecta en `<all_urls>` (ver manifest).
// Registra el listener que ejecuta `execute_fetch` ruteado por el SW.

import { registerContentListener } from './modules/10-bridge-client'

registerContentListener()
