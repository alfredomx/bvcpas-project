// Service worker (Manifest v3). En P2 se agrega:
// - WebSocket client al backend mapi
// - Detección de pestañas QBO
// - Routing de comandos a content scripts
//
// En P0 sólo registra que está vivo para verificar que el manifest carga bien.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[kiro] service worker installed')
})
