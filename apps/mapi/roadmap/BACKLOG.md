# BACKLOG — `mapi`

Items diferidos del TDD del backend, agrupados por **trigger concreto** que los reactiva. Sin trigger claro, el item no entra aquí — entra en notas de la versión activa.

> **Regla:** cada item declara un trigger objetivo (no "cuando haya tiempo"). Si el trigger nunca llega, el item se queda aquí indefinidamente, eso es OK.

---

## Por trigger

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

---

## Histórico

Items que entraron y se cerraron (mover aquí cuando se complete el trabajo, con link a la versión que los cerró).

(vacío — primera versión es v0.1.0)
