# BACKLOG — `mapi`

Items diferidos del TDD del backend, agrupados por **trigger concreto** que los reactiva. Sin trigger claro, el item no entra aquí — entra en notas de la versión activa.

> **Regla:** cada item declara un trigger objetivo (no "cuando haya tiempo"). Si el trigger nunca llega, el item se queda aquí indefinidamente, eso es OK.

---

## Por trigger

### Trigger: cuando se reactive deploy (limpieza Intuit legacy)

> v0.8.0 cerró el refactor URLs + Intuit a Connections. Quedan 2 items;
> el move es organización interna sin valor funcional, el drop necesita
> deploy. Ambos en pausa hasta nuevo aviso del operador.

- **Drop tabla `intuit_tokens_deprecated`** (NECESITA DEPLOY). Renombrada en migration 0007.
  Ya NO está en el schema de Drizzle (solo comentarios). Sigue existiendo en la DB de prod.
  Borrarla es un `DROP TABLE` que aplica en el próximo migrate/deploy → hacer cuando deploy
  se reactive, no antes (evita migración colgada). Revisado 2026-06-13.
- **Mover controllers Intuit a `21-connections/providers/intuit/`** (refactor grande, cero
  valor funcional). Hoy `IntuitOauthController`, `IntuitAdminController`, `ClientIntuitController`,
  `IntuitOauthService`, `IntuitApiService`, `IntuitOauthClientFactory` y `IntuitTokensMetricsCron`
  viven en `20-intuit-oauth/`. Las URLs ya están en su path final (Forma C); el move es solo
  file system + imports. Se difiere por riesgo/tiempo vs cero beneficio. Si se hace: borrar
  también `roadmap/20-intuit-oauth/` conservando histórico v0.3.x en `21-connections/`.
- ~~**Reescribir `migrate-from-v0x`**~~ ✅ RESUELTO 2026-06-13: la migración de los 77 clientes
  ya se ejecutó (one-time, mayo 2026). El script no existe en `src/` y el e2e spec en
  `describe.skip` se borró (código muerto). No hay nada que reescribir — nunca se re-ejecuta.

### Trigger: cuando los 77 clientes lleven ≥3 días estables en bvcpas-project prod

> Migración v0.3.1 cerrada el 2026-05-03. Tokens migrados, refresh transparente verificado. mapi v0.x prod sigue corriendo en paralelo durante el periodo de validación.

- Apagar mapi v0.x prod (server `mapi.alfredo.mx`): detener stack docker compose, desuscribir tunnel cloudflared, dejar postgres en cold storage por si hay que rollback.
- Quitar redirect URI `https://mapi.alfredo.mx/v1/intuit/callback` de la app Intuit "BV CPAs, PLLC" (ya no se usa).
- Dejar último dump `db-2026-05-03-060001.dump` archivado en gdrive como punto de regreso.

### Trigger: cuando arranque el segundo connector (no qbo-dev)

> Connector base genérico que abstrae lógica común. Hoy con un solo connector (qbo-dev) la abstracción sería prematura. Heredado de mapi v0.x D-096.

- (placeholder — se llenan items concretos cuando entren mappers/connectors aquí)

### Trigger: cuando aparezca el primer worker BullMQ pesado

> Hoy mapi corre worker en mismo proceso que API (heredado de mapi v0.x D-090). Cuando un job pesado afecte latencia HTTP, separar.

- (placeholder)

### Trigger: cuando llegue módulo de classification

> staging_transactions reclassify endpoint, mappers source-específicos extra, etc.

- (placeholder)

### Trigger: cuando llegue módulo de receipts/dropbox

> staging_receipts table + endpoints de OCR/dropbox.

- (placeholder)

### Trigger: cuando se valide auth pública en /v1/docs (Scalar)

> Hoy `/v1/docs` es público (heredado de mapi v0.x D-029). Cuando AuthModule entre, decidir si protegerlo.

- (placeholder)

### Trigger: cuando un viewer tenga datos sensibles vinculados

> Diferidos de 10-core-auth v0.2.0 (sección "NO entra"):
>
> - **TOTP / 2FA**: agregar segundo factor para viewers con acceso a datos sensibles.
> - **Recovery de password por email**: hoy admin asigna password inicial. Cuando entre algún flujo donde el user pueda recuperar sin contactar admin, agregar.
> - **OAuth social** (Google login): solo si el operador lo pide.

### Trigger: cuando entre rol `bookkeeper` (probable M3 si crece equipo)

> Rol intermedio entre admin y viewer. Bookkeeper puede operar clientes asignados (consume `clients.owner_id`). Diferido de 10-core-auth v0.2.0.

- Extender enum `users.role` con `bookkeeper` (migration con CHECK constraint update).
- `RolesGuard` ya soporta múltiples roles (`@Roles('admin', 'bookkeeper')`).
- Definir scoping (qué clientes ve un bookkeeper).

### Trigger: cuando una sesión robada granular sea problema operativo

> 10-core-auth v0.2.0 ya tiene `user_sessions` con revoke individual. Pero el cache Redis tiene TTL 30s, lo que significa que revocar puede tardar hasta 30s en propagar SI Redis DEL falla. Si esto se vuelve crítico, evaluar:
>
> - SETNX con timestamp de revocación en Redis.
> - O Redis pub/sub para invalidación cross-process.

### Trigger: cuando AuthModule v0.2.0 acumule fricción operativa

> Posibles iteraciones de 10-core-auth en versiones futuras (v0.2.x patches o v0.3.0+):
>
> - Audit log de IP geolocation, device fingerprint avanzado.
> - Política password con verificación contra haveibeenpwned.com.
> - Self-service "olvidé mi contraseña" sin involucrar admin.

### Trigger: cuando se quieran usar drafts de correo (v0.6.3 o posterior)

> v0.6.2 quitó `Mail.ReadWrite` del scope OAuth porque dispara "Need
> admin approval" en el tenant bv-cpas.com (app unverified + política
> del tenant). Solo se quedó con `Mail.Send + User.Read + offline_access`
> que sí pasan user-consent.
>
> Para entrar drafts en v0.6.3 hay que:
>
> - Re-agregar `Mail.ReadWrite` al SCOPES en `microsoft-oauth.service.ts`.
> - Resolver el admin consent: dos caminos.
>   - **Admin consent puntual**: con cuenta admin del tenant
>     `bv-cpas.com`, abrir
>     `https://login.microsoftonline.com/common/adminconsent?client_id=<MICROSOFT_CLIENT_ID>&redirect_uri=<MICROSOFT_REDIRECT_URI>`.
>     Una vez aceptado, todos los usuarios del tenant pueden consentir
>     individualmente sin admin approval.
>   - **Publisher verification**: registrar la app como verificada por
>     Microsoft (proceso multi-día, requiere identidad de la
>     organización). Más esfuerzo pero más confiable a largo plazo.
> - Actualizar test `CR-msft-008` con el nuevo SCOPES esperado.

### Trigger: cuando los AMAs de Journal Entries sean operativamente necesarios

> **Diagnóstico (2026-05-10, validado contra realm 9130350335321926):**
>
> El sync actual usa `/reports/TransactionList` para detectar uncats/AMA.
> Ese reporte **NO expone** las líneas AMA dentro de Journal Entries
> multi-línea — las consolida con `ColData[7] = "-Split-"`. Por eso JEs
> con líneas a "92000 ASK MY ACCOUNTANT" aparecen en QBO (en el reporte
> agrupado por cuenta) pero NO en `client_transactions` de mapi.
>
> El parámetro `&group_by=Account` agrupa por cuenta **principal** (primera
> línea), no por todas las líneas. `&account=<id>` es ignorado por QBO.
>
> **Solución validada:** query directa
> `SELECT * FROM JournalEntry WHERE TxnDate ...` y filtrar en backend las
> que tengan `Line[].JournalEntryLineDetail.AccountRef.value === <id_AMA>`.
> Funciona — encuentra todas las JE-AMA del rango.
>
> **Decisiones pendientes a tomar al retomar:**
>
> 1. **¿Cómo se identifica la cuenta AMA por cliente?**
>    - A) Lookup por nombre en cada sync (`SELECT * FROM Account WHERE Name LIKE '%Ask My Accountant%'`).
>    - B) Columna nueva `clients.qbo_ama_account_id` que admin configura.
>    - C) Match por regex en cada línea (`/ask my accountant/i`).
>    - Mi voto inicial: A (cacheable, sin migración, robusto a cambios de ID).
> 2. **¿1 row por JE o 1 row por línea AMA?**
>    - A) 1 row por JE, monto = suma de líneas AMA.
>    - B) 1 row por línea AMA (más granular).
>    - Mi voto inicial: A (refleja la UI de QBO).
> 3. **¿Aplicar también a líneas Uncategorized Income/Expense en JEs?** Sí muy
>    probable — el patrón es el mismo.
> 4. **Writeback de JEs**: hoy `qbo-writeback.service.ts` solo soporta
>    Purchase/Deposit. Editar AMA en una JE requiere modificar la línea
>    específica (no `Line[0]`). Es un trabajo aparte.
>
> **Implementación tentativa cuando se retome:**
>
> - Modificar `transactions-sync.service.ts` para hacer un segundo fetch
>   `SELECT * FROM JournalEntry WHERE TxnDate BETWEEN ...`, filtrar por
>   líneas AMA, y mergear al snapshot.
> - El `qbo_txn_type` se guardaría como `'Journal Entry'` (o `'JournalEntry'`
>   estandarizado).
> - Agregar `'Journal Entry'` y `'JournalEntry'` al `TYPE_TO_V3` map del
>   writeback (lanzando `TXN_TYPE_NOT_SUPPORTED` o implementando soporte real).

### Trigger: cuando aplicar migraciones a prod sea fricción operativa

> Hoy las migraciones se aplican a mano desde local (`npm run db:migrate`
> apuntando al `DATABASE_URL` de prod) o vía SSH al server. Cada vez que
> hay schema change hay que recordar aplicarlas antes/después del deploy.
>
> Cuando esto se vuelva fricción real (olvidos, deploy roto por schema
> desactualizado, varios collaborators), implementar:
>
> - Script `apps/mapi/scripts/migrate-prod.ts` que se ejecute
>   automáticamente al arrancar el container (entrypoint o
>   `release_command` en Coolify) antes de levantar el server.
> - Decisión a tomar entonces: ¿corre en cada arranque (idempotente,
>   drizzle skipea las ya aplicadas) o solo en el primer arranque post-deploy?
> - Plan de rollback: si la migración falla, el container NO debe
>   levantar — fail-fast con log claro para que Coolify abortee el deploy.
> - Considerar `pg_advisory_lock` para evitar que 2 réplicas corran
>   migraciones en paralelo (no aplica hoy con 1 réplica, pero útil a futuro).

### Trigger: cuando entre el primer adapter bancario (v0.16.0+)

> Decisiones de carpeta destino para los PDFs descargados por los
> adapters. Se aterriza con un caso real cuando llegue Chase.

- **Script de descubrimiento de carpeta Dropbox por regex + mask**.
  El operador propuso: dado un `account_mask`, buscar recursivamente
  en su Dropbox compartido la carpeta destino aunque el nombre exacto
  no se conozca. Más costoso que tener path fijo pero garantiza que
  siempre da con la carpeta correcta aunque cambien los nombres. Se
  implementa con la primera versión que escriba PDFs (v0.16.0).

### Trigger: rehacer adapters delgados (v0.22.0)

> Refactor del contrato `BankAdapter`: los métodos `downloadX` están
> gordos (mezclan operación cruda del banco + política de orquestación
> — rango, qué descargar, loops). Se parten en **primitivas** (1 op de
> banco c/u) y la política (rango/latest/nombrado/guardado) sube al
> `BankDownloadService` en mapi. El smoke en vivo pendiente de v0.21.0
> se cubre AQUÍ con el formato nuevo (no se duplica trabajo).

- **Adapters delgados (v0.22.0)**. Primitivas en el adapter:
  `getAllAccounts`, `searchTransactions`, `getDepositDetails`,
  `downloadImage`, `listStatements(mask,{yearsBack})` (solo metadata,
  sin PDF, sin filtro de rango), `downloadStatementPdf(mask,ref)`,
  `exportTransactions`. mapi orquesta: "último statement" =
  `listStatements → max(date) → downloadStatementPdf` (resuelve el
  hueco de que hoy no hay modo "latest", solo rango). Abrir con TDD
  primero. Es refactor de contrato → version-worthy.
- **Smoke en vivo de `download_transactions`** (CSV/QBO) — diferido de
  v0.21.0; se corre contra Chase real con el adapter ya delgado.
- **Smoke en vivo de depósitos con cheques internos** — diferido de
  v0.21.0 (el depósito de prueba 2026-06-14 fue solo slip). Esperar un
  depósito real con cheques o ampliar el rango para cazarlo; valida la
  ruta `MM-DD-YYYY - <checkNumber> (<amount>).pdf` con datos reales.

---

## Histórico

Items que entraron y se cerraron (mover aquí cuando se complete el trabajo, con link a la versión que los cerró).

(vacío — primera versión es v0.1.0)
