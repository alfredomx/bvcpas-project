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

---

## Histórico

Items que entraron y se cerraron (mover aquí cuando se complete el trabajo, con link a la versión que los cerró).

(vacío — primera versión es v0.1.0)
