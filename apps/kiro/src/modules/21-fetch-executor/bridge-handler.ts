// Capa de transporte agnóstica al bridge.
//
// `handleBridgeCommand` despacha un comando del bridge al ejecutor correcto.
// Es invocable y testeable SIN el bridge real (`10-bridge-client` está 📅).
// No abre WebSocket ni conoce el protocolo de transporte: solo mapea
// type → función. El wiring al bridge real se hace en el punto de integración
// marcado abajo cuando `10-bridge-client` exista.

import { checkSession, executeFetch } from './fetch-executor'
import type { BridgeCommand, BridgeCommandResult } from './types'

/**
 * Despacha un comando recibido del bridge:
 *  - `execute_fetch` → `executeFetch`
 *  - `check_session` → `checkSession`
 *
 * Lanza en comando desconocido (el bridge debe filtrar antes de llegar aquí;
 * llegar con un type fuera del contrato es un bug del lado que envía).
 */
export async function handleBridgeCommand(command: BridgeCommand): Promise<BridgeCommandResult> {
  switch (command.type) {
    case 'execute_fetch':
      return executeFetch(command.instruction)
    case 'check_session':
      return checkSession(command.instruction)
    default: {
      // Exhaustividad: si se agrega un comando al contrato y no se maneja aquí,
      // TypeScript marca error en esta línea.
      const exhaustive: never = command
      throw new Error(
        `[21-fetch-executor] comando de bridge desconocido: ${JSON.stringify(exhaustive)}`,
      )
    }
  }
}

// --- PUNTO DE INTEGRACIÓN CON EL BRIDGE REAL (10-bridge-client) ---
//
// Cuando `10-bridge-client` exista, su cliente WebSocket debe:
//   1. Recibir el mensaje del bridge (mapi → kiro), parsearlo/validarlo a un
//      `BridgeCommand` tipado.
//   2. Llamar `await handleBridgeCommand(command)`.
//   3. Enviar de vuelta el `BridgeCommandResult` por el mismo canal,
//      correlacionado por `requestId` (execute_fetch) o `bank` (check_session).
//
// Además, `executeFetch` corre en el CONTENT SCRIPT de la pestaña del banco
// (same-origin). Si el service worker recibe el comando, debe reenviarlo al
// content script de la pestaña correcta vía `chrome.tabs.sendMessage` y este
// archivo se carga del lado del content script. Ese routing service-worker →
// content-script es trabajo de la versión que conecte el bridge (mapi v0.17.0
// acoplado), no de este módulo, que se mantiene puro y testeable.
//
// Ejemplo de wiring (NO se activa aquí; solo referencia):
//
//   bridgeClient.onCommand(async (raw) => {
//     const command = parseBridgeCommand(raw) // validación en 10-bridge-client
//     const result = await handleBridgeCommand(command)
//     bridgeClient.send(result)
//   })
