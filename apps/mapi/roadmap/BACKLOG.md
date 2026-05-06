# BACKLOG — `mapi`

Items diferidos del TDD del backend, agrupados por **trigger concreto** que los reactiva. Sin trigger claro, el item no entra aquí — entra en notas de la versión activa.

> **Regla:** cada item declara un trigger objetivo (no "cuando haya tiempo"). Si el trigger nunca llega, el item se queda aquí indefinidamente, eso es OK.

---

## Por trigger

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

---

## Histórico

Items que entraron y se cerraron (mover aquí cuando se complete el trabajo, con link a la versión que los cerró).

(vacío — primera versión es v0.1.0)
