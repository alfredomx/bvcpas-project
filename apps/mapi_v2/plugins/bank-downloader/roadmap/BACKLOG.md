# BACKLOG — `plugins/bank-downloader`

Diferidos del plugin, agrupados por **trigger concreto**. No es roadmap: es lo que sabemos que falta pero no se construye hasta que toque.

> **Cerrados/obsoletos:** el orquestador `client-download` (login→descarga→logout en el worker) **se cerró en v0.2.0** (el worker ya hace todo). El item "propagar el código de error a través de la cola (500 vs 502)" quedó **obsoleto** en v0.2.0: sin `runAndWait`, el caller no espera el resultado y el error vive en el job/bull-board.

## Trigger: cuando el flujo del dashboard lo pida

- [ ] **`accountMasks: "all"`** — el worker ya logueó y tiene las cuentas vía `listAccounts`; resolver "all" sería trivial. v0.2.0 usa masks explícitas (las sacas de `accounts`). _Trigger: cuando el frontend quiera "descargar todas las cuentas" sin pasar masks._
- [ ] **`GET /v1/bank/download/jobs/:jobId`** — estado/resumen de un job (progreso, resultado, fallo) sin abrir bull-board. _Trigger: cuando el frontend necesite mostrar el avance/resultado de una descarga encolada._
- [ ] **Listado de credenciales para el step-flow** — hoy el caller manda `credentialId` directo. Si el dashboard necesita "¿qué credenciales tiene este cliente?" para armar el flujo, ese listado lo expone `bank-credentials` (no este plugin). _Trigger: cuando se arme la pantalla de descarga._

## Trigger: cuando el core tenga `event_log`

- [ ] **Emitir eventos de descarga** — `bank_download.started` / `.completed` / `.failed` por cuenta/credencial. El mapi viejo no los persistía (solo logs); con `event_log` en el core conviene auditarlos (D-bank-down-005). _Trigger: cuando se monte un `event_log` en el core._

> **Resuelto en v0.2.1:** el "Chase 401 en `secure.chase.com`" era síntoma de que el login corría en la pestaña equivocada (reuso por host → ruta dashboard). Con `ensureTab` abriendo el logon fresco, el login autentica y los fetches de documentos funcionan same-origin (probado: descarga real de cheque end-to-end).

## Trigger: cuando entre un banco nuevo

- [ ] **Más adapters** — hoy solo Chase está portado (`adapter-registry`). RBFCU, Wells Fargo, Frost, etc. devuelven `null` → `BankAdapterNotSupportedError`. Cada banco es ingeniería inversa propia (referencia: `D:\archived\sandbox\bankify`). _Trigger: cuando un cliente real use un portal sin adapter._

## Trigger: cuando se defina el destino final

- [ ] **Subida a Dropbox por carpeta de cliente** — hoy `saveChecks/Deposits/Statements` escriben a `.downloads/<cliente>/<mask>/` (disco local, no es el destino real). El destino productivo (Dropbox del cliente) sigue diferido. _Trigger: cuando se conecte el provider de almacenamiento del cliente._
