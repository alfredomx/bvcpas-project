# bvcpas-project — Documentación cross-app

Esta carpeta contiene documentación que aplica a los 3 apps (`mapi`, `bvcpas`, `kiro`) del proyecto. Para roadmap y TDD de cada app, ver:

- [`apps/mapi/roadmap/`](../apps/mapi/roadmap/README.md) — backend NestJS
- [`apps/bvcpas/roadmap/`](../apps/bvcpas/roadmap/README.md) — frontend Next.js
- [`apps/kiro/roadmap/`](../apps/kiro/roadmap/README.md) — Chrome extension

---

## 1. Qué es este proyecto

### Problema raíz

El operador (Alfredo) es bookkeeper que maneja 40-45 clientes con QuickBooks Online. Quiere escalar a 80 clientes sin duplicar sus horas, sin depender de su memoria, y sin que el sistema falle silencioso.

### North Star

**Horas/cliente/mes invertidas en bookkeeping.**

| Estado               | Valor                                              |
| -------------------- | -------------------------------------------------- |
| Baseline pre-sistema | 2-4 h/cliente/mes                                  |
| Meta intermedia      | 60-90 min/cliente/mes                              |
| Meta final           | 30-60 min/cliente típico, 15-30 min cliente maduro |

Si esa métrica no baja, el sistema no funciona, independiente de lo bonita que se vea cada feature.

### Qué SÍ es

Un sistema que **reemplaza progresivamente los Google Sheets internos frágiles** que el operador usa hoy para controlar el cierre mensual de sus clientes. Es una herramienta operativa diaria del bookkeeper, no un experimento técnico.

### Qué NO es

- No es un ETL de QuickBooks.
- No es un dashboard genérico.
- No es un experimento de IA.
- No es multi-firm / SaaS / white-label. **El proyecto muere cuando el operador salga.**
- No soporta QBO Desktop, Xero, NetSuite. QBO Online único.
- No hay mobile app. Push notifications a Telegram cubren.
- No hay reportes financieros generales (QBO ya los hace).
- No hay cashflow forecasting / FP&A.
- No hay auto-filing al IRS / state. Sistema prepara, humano filea.
- No reemplaza n8n donde funciona bien (sigue corriendo durante Etapa 1).
- No usa Plaid / Yodlee. Browser-tethered + OCR cubren.
- No hace fine-tuning de LLM propio.

### Histórico (mapi v0.x congelado)

mapi v0.x corrió 19 versiones (v0.0.1 → v0.19.1, cerrada 2026-04-29) con 77 clientes en producción Coolify. Tenía OAuth Intuit, sync qbo-dev (11 entidades), bridge WebSocket, encryption AES-256-GCM, JWT auth, BullMQ, observability completa, backups diarios. **Diagnóstico:** 19 versiones en plumbing sin entregar producto visible al bookkeeper. El operador NO bajó horas/cliente/mes.

`bvcpas-project` es repo limpio. Reusa lógica de mapi v0.x (OAuth, refresh, encryption, mappers) pero **el naming, schema y flujo se rediseñan** para que los dashboards sean consumibles.

mapi v0.x sigue corriendo como referencia hasta que P1 (Intuit Core) migre los 77 clientes y se apague.

---

## 2. Arquitectura — Modelo B

3 apps independientes (sin npm workspaces):

```
┌──────────────┐  ws/http  ┌─────────────┐  http+sse  ┌──────────────┐
│   kiro       │ <──────> │   mapi      │ <───────>  │   bvcpas     │
│ (plugin      │           │ (backend    │            │ (frontend    │
│  Chrome)     │           │  NestJS)    │            │  Next.js)    │
└──────────────┘           └─────────────┘            └──────────────┘
       │                          │                          │
   ejecutor mínimo:           toda la lógica            UI dashboards
   solo cosas que             + persistencia            + interacción
   requieren sesión           + orquestación            con operador
   humana en QBO/bancos
```

**Reglas no negociables del Modelo B:**

- **El plugin habla SOLO con el backend.** Nunca habla directo al frontend.
- **El backend es la única fuente de verdad.**
- **El frontend lee siempre del backend.**
- **Apaga el plugin** → la mayoría de dashboards siguen funcionando.
- **Apaga el frontend** → backend sigue procesando webhooks y syncs.
- **Apaga el backend** → todo muere (es la pieza central).

**Reparto de responsabilidades:**

- **kiro (plugin):** ejecutor mínimo. Solo cosas que requieren sesión humana en QBO o bancos. Sin lógica de negocio. Sin UI compleja.
- **bvcpas (frontend):** UI de los dashboards. Lee del backend.
- **mapi (backend):** toda la lógica de negocio + persistencia + orquestación.

### Despliegue

| Pieza    | Subdominio             | Cómo se despliega                                                  |
| -------- | ---------------------- | ------------------------------------------------------------------ |
| Backend  | `mapi.kodapp.com.mx`   | Coolify auto-deploy on push a `main` (ya activo desde 2026-05-03)  |
| Frontend | `bvcpas.kodapp.com.mx` | Coolify auto-deploy cuando entre la primera UI funcional           |
| Plugin   | n/a                    | Build local + zip, instalación manual en Chrome del operador       |
| Postgres | resource Coolify       | Compartido entre apps via DATABASE_URL                             |
| Redis    | resource Coolify       | Cuando un módulo lo pida (no antes)                                |
| Backups  | Coolify container      | Diario a Google Drive vía rclone (cuando se reactive de mapi v0.x) |

**Cloudflare Tunnel:** wildcard `*.kodapp.com.mx` apunta al server Coolify vía tunnel ya configurado.

---

## 3. Filosofía del proyecto

Estas filosofías se mantienen del diseño-original de mapi v0.x porque siguen siendo correctas:

### Los números los hace código. La narrativa la hace el LLM.

El LLM jamás sale en un camino donde el resultado sea un número contable. Clasificar una transacción → código. Calcular un accrual → código. Decidir si dos transacciones matchean → código. Generar el monto de un ajuste → código.

El LLM entra cuando el output es texto para humanos: explicar por qué una anomalía es anomalía, redactar el memo mensual, sugerir texto para una pregunta al cliente.

### Idempotencia obligatoria

Toda operación del sistema debe poder repetirse sin efecto secundario. Importar el mismo statement dos veces no crea duplicados. Reclasificar la misma transacción con la misma regla es no-op. Postear el mismo journal entry dos veces: la segunda es detectada y abortada.

### Híbrido primero, autónomo después — por cliente, por categoría

No es "el sistema es autónomo" o "el sistema es asistente". Es una matriz: cada categoría por cliente puede estar en modo `auto` o `sugiere` independiente. Una categoría pasa de `sugiere` a `auto` cuando durante N meses el humano aceptó >99% de las sugerencias sin corrección.

### Todo flag accionable o es basura

Si el sistema genera una alerta que no sabes qué hacer con ella, la alerta se elimina o se refina hasta que sí lo sepas. Un flag debe incluir: qué pasó, por qué es raro, qué acción propones, en cuánto tiempo deberías resolverlo.

### El cliente es la unidad de configuración. Las reglas globales son sospechosas.

Cada cliente tiene su COA mapeado, sus vendors recurrentes, sus reglas de clasificación, su baseline estadístico, su modo (auto/sugiere) por categoría, sus particularidades. Reglas globales solo para compliance (1099, Sales Tax), formatos estándar de QBO, security.

### Recuperabilidad > performance

Preferimos un sistema 3× más lento pero que sobrevive a un apagón sin intervención manual, que uno rápido que requiere reiniciar cosas a mano. Todo job es reanudable desde checkpoint. Todo proceso es monitorizable desde otra máquina. Todo estado crítico está en Postgres, no en memoria.

### Auditable por defecto

Toda decisión del sistema debe ser reconstruible 2 años después: qué input recibió, qué regla aplicó (versión específica), qué modelo usó (hash + prompt + temperatura), qué salida produjo, qué humano aprobó/corrigió y cuándo.

### No optimizar para casos que no existen

Hay tentación de construir abstracciones para "el día que tengamos otro bookkeeper", "el día que soportemos Xero", "el día que seamos SaaS". Ese día no llega y mientras tanto el sistema pesa el doble. Si no está en la lista de clientes reales de este mes, no se diseña para ello.

### Construcción incremental

El schema crece con la operación real. No escribimos las 30 tablas de golpe en Fase 0 para luego "implementar". Cada fase propone solo las tablas que necesita esa fase.

### Cero trabajo sin hipótesis

Antes de tocar datos, código o configuración: ¿qué creo que está pasando y cómo lo verifico?

---

## 4. Reglas duras del repo

1. **Cada módulo entrega valor usable día a día.** No "deja la base lista", no "habilita módulos futuros". Excepción: pre-requisitos técnicos (P0, P1, P2).
2. **Lo que NO entra es igual o más largo que lo que SÍ entra.** Si la sección NO entra es más corta que SÍ entra, no se pensó suficiente.
3. **Auth mínima del módulo, no auth completa del proyecto.** Cada módulo siguiente que requiera más auth la agrega como parte de su entregable.
4. **Naming review antes de cualquier migration.** Si el nombre no se entiende leyéndolo, se cambia. Aplica también a endpoints. (NAM-1, ver sección 6).
5. **Cero tests decorativos.** Si rompes la lógica y el test no falla, el test no sirve. Se borra.
6. **Persistencia diferida.** No se crea tabla hasta que un módulo concreto la pida. Por defecto los datos se calculan en vivo.
7. **API interna QBO solo por gap comprobado.** No se construye sync interno completo "por si acaso". Primero Developer API, luego API interna puntual si hay gap real.
8. **Reuso de mapi v0.x con rename, no copia ciega.** La lógica que ya funciona se trae. Los nombres se renombran.
9. **Un módulo a la vez.** No se arranca el siguiente hasta que el actual está en uso real ≥3 días distintos por el operador.
10. **TDD del módulo se itera EN el módulo.** No se diseñan los TDDs de los 7 módulos al mismo tiempo.
11. **"Ya que estamos" prohibido.** Si aparece, va a "NO entra" del módulo actual o a backlog futuro.
12. **`suzy` activa modo restrictivo.** No asumir, preguntar antes de actuar, no escribir nada no pedido.
13. **Si el orden no ahorra tiempo, se cambia.** El orden de módulos puede reordenarse si la presión operativa cambia.
14. **Todo finding accionable o no es finding.** Si no hay acción concreta, no se muestra. Genera ruido.
15. **kiro = ejecutor mínimo. bvcpas = UI. mapi = lógica.** No se mezclan.
16. **No borrar lo viejo hasta tener reemplazo.** mapi v0.x queda congelado como referencia.
17. **Cada commit toca un solo app y solo cosas relacionadas con la versión activa.** No mezclar fixes "de paso" en otros apps.
18. **Solo una versión `🚧` a la vez en todo el proyecto** (no por app — por proyecto entero). Trabajamos un Mx a la vez.

### Reglas operativas heredadas de mapi v0.x

| Decisión                                            | Razón                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| **No `nest build`, usar `tsc` directo**             | Webpack de Nest falla silencioso. Heredado D-071 mapi v0.x.               |
| **Clean antes de build y antes de start:dev**       | Evita cache TS stale. Heredado D-007.                                     |
| **`--max-warnings=0` en ESLint**                    | Cero tolerancia a warnings.                                               |
| **`prettier --check` en lint-staged, no `--write`** | Falla si no está formateado, en vez de auto-formatear silencioso.         |
| **TSC type-check en pre-commit**                    | Un archivo puede romper types en otro lado aunque no esté en este commit. |
| **NUNCA `git commit --no-verify`**                  | Si el hook falla, root cause. Bypassear convierte el sistema en teatro.   |
| **Engines lock `node: >=22`**                       | Evita drift entre máquinas y server.                                      |
| **Override ESLint en tests**                        | Mocks producen falsos positivos type-aware. Heredado D-063.               |

---

## 5. Glosario

### Convenciones del proyecto

| Abreviación           | Significado                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `P0`, `P1`, `P2`      | **Pre-requisito** técnico. Trabajo que NO entrega valor directo al día a día del bookkeeper, pero sin él los módulos no pueden existir.     |
| `M1`, `M2`, ..., `M7` | **Módulo** de Etapa 1. Cada uno reemplaza un Google Sheet interno y SÍ entrega valor día a día.                                             |
| `Mx`                  | Módulo genérico (placeholder para "el módulo N").                                                                                           |
| `TDD`                 | Technical Design Document. Vive en `apps/<app>/roadmap/<NN-bloque>/README.md` o sub-carpeta.                                                |
| `GS`                  | Google Sheet. Los 7 GS internos del operador son el origen de los módulos M1-M7.                                                            |
| `Etapa 1`             | Conjunto cerrado de 7 módulos (M1-M7) que reemplazan los 7 GS internos. Cuando los 7 estén commit-eados y en uso día a día, Etapa 1 cierra. |
| `Etapa 2+`            | Lo que viene después de Etapa 1. Se planea con datos de uso real, no antes.                                                                 |
| `vX.Y.Z`              | Versión SemVer por app. Cada app versiona independiente: `mapi-v0.2.0`, `bvcpas-v0.1.0`, `kiro-v0.1.0`.                                     |

### Técnicas (estándar industria)

| Abreviación | Significado                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| `QBO`       | QuickBooks Online (la plataforma contable de Intuit).                                    |
| `OAuth`     | Open Authorization. Protocolo de autorización de Intuit.                                 |
| `JWT`       | JSON Web Token. Token de sesión que el frontend manda al backend.                        |
| `REST`      | Representational State Transfer. Estilo de API HTTP (GET, POST, PATCH, DELETE).          |
| `WS` / `ws` | WebSocket. Canal bidireccional persistente. Lo usa el plugin para hablar con el backend. |
| `SSE`       | Server-Sent Events. Canal del backend al frontend para push en tiempo real.              |
| `UI`        | User Interface. La parte visual con la que el operador interactúa.                       |
| `DB`        | Database. La base de datos Postgres.                                                     |
| `PK`        | Primary Key. Llave primaria de una tabla.                                                |
| `FK`        | Foreign Key. Llave foránea (referencia a otra tabla).                                    |
| `OCR`       | Optical Character Recognition. Extracción de texto desde imágenes/PDFs.                  |
| `LLM`       | Large Language Model. Modelos como Gemma, Claude.                                        |
| `RAG`       | Retrieval-Augmented Generation.                                                          |
| `CDC`       | Change Data Capture. Endpoint de QBO que devuelve solo lo cambiado desde una fecha.      |
| `ORM`       | Object-Relational Mapper. Drizzle es el ORM del proyecto.                                |
| `CI`        | Continuous Integration. Pipeline que corre tests al hacer commit/push.                   |
| `CRUD`      | Create, Read, Update, Delete.                                                            |

### Reglas

| Abreviación | Significado                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `suzy`      | Palabra clave del operador que activa **modo restrictivo** en el modelo (no asumir, preguntar antes de actuar, no escribir nada no pedido). |
| `ji eun`    | Palabra clave del operador que activa **modo control total** (autonomous, no pide permisos para cada paso).                                 |

---

## 6. Reglas de naming (NAM-1, NAM-2, NAM-3)

### NAM-1 — Acuerdo previo de naming (CRÍTICA)

Esta regla nació porque en mapi v0.x, los nombres de tablas/endpoints no eran claros para el operador y le costaba consumirlos desde dashboards. **No se repite el problema.**

**Antes de codear cualquier módulo, el modelo propone naming al operador:**

- Tablas: nombre + columnas + tipos + enums.
- Endpoints: path + método + tag.
- Eventos: `<dominio>.<recurso>.<acción>`.
- Códigos de error: el `code` que devuelve el API.
- Estados/enums visibles al operador.
- Identificadores que el operador va a leer.

**Si durante codeo aparece algo no previsto, el modelo PARA y pregunta.** No improvisa nombres.

### NAM-2 — Naming interno y documentación

Aunque no requieran acuerdo previo, los nombres internos también deben ser legibles:

- **Sin abreviaciones crípticas** (`gacbo()` ❌, `getActiveClientsByOwner()` ✅).
- **JSDoc obligatorio** en funciones, clases, types e interfaces públicas/exportadas.
- **`.describe()` en cada campo de schema Zod** para que aparezca en IntelliSense + Scalar.

### NAM-3 — Política de types

**Sí usar types customs cuando:**

- Es un ID o valor con semántica de negocio → branded type (`type ClientId = string & { __brand: 'ClientId' }`).
- Es input/output de endpoint o evento → schema Zod + `z.infer` + `createZodDto` (una declaración, 4 cosas: type + validación + OpenAPI + IntelliSense).
- Es shape de tabla → Drizzle infiere automático (`typeof clients.$inferSelect`).
- Es enum visible → siempre tipo, nunca `string` libre.

**NO crear types cuando:**

- Variables locales triviales.
- Primitivos sin brand (`type Name = string` no aporta).
- One-off literals.

---

## 7. Etapa 1 — Los 7 GS y los 3 pre-requisitos

### Pre-requisitos técnicos

| ID     | Nombre                         | Resuelve                                                                                     | Bloque(s) en mapi      | Bloque(s) en bvcpas | Bloque(s) en kiro   |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------- | ------------------- | ------------------- |
| **P0** | Fundación                      | Bootstrap NestJS + DB/Health + Metrics/Scalar + deploy Coolify                               | `00-foundation` ✅     | `00-foundation` ✅  | `00-foundation` ✅  |
| **P1** | Intuit Core                    | Conectar clientes QBO, mantener tokens vivos, refresh, migración 77 clientes desde mapi v0.x | `20-intuit/01-oauth/`  | —                   | —                   |
| **P2** | Plugin v2 base + Consola Debug | Plugin Manifest v3 desde cero + bridge con mapi + extension page para query/report/raw QBO   | `20-intuit/02-bridge/` | —                   | `10-bridge-client/` |

**Orden:** P0 ✅ → P1 → P2. P2 puede arrancar mientras los módulos M1+ se discuten.

### Módulos Etapa 1: descripción detallada de los 7 GS

Estos son los 7 Google Sheets internos del operador hoy. Cada módulo de Etapa 1 reemplaza UNO de estos GS.

#### M1 — Dashboard Administrator (reemplaza GS Dashboard Administrator)

**Columnas actuales del GS:**

```
realmId | company | enabled | draft | sheetId | filter | startDate | endDate | contact | email | ccEmail | notes
```

**Cómo funciona hoy (n8n):**

- n8n toma este GS para revisar mediante el sheetId si existen uncats.
- Si `enabled=false`, se lo salta y no revisa nada.
- Si hay transacciones y `draft=enabled`, n8n genera un draft en Outlook listo para enviar plantilla al cliente.
- `startDate` y `endDate` son los rangos de fecha que otro proceso de n8n toma para sacar el listado de uncats.
- Filter: `all`, `expense`, `income`.

**Qué resuelve M1:** control central. Por cliente: qué fechas procesar, si manda email, si está enabled, qué filtro aplicar. Es el dashboard de control que orquesta los siguientes módulos.

#### M2 — Uncats Pipeline (reemplaza GS Uncat por cliente)

**Columnas actuales del GS Uncat:**

```
Id | Date | Type | Check # | Name | Memo/Description | Split | Category | Amount | Notes
```

**Cómo funciona hoy:**

- Información extraída del reporte Uncats de QuickBooks.
- Mediante n8n se leen los GS de uncats: los que tengan nota escrita se separan de los que no tienen notas.
- Ese filtro se manda al servidor del operador y con un script se actualizan las notas y memo en QuickBooks directamente.
- El proceso sigue dejando la transacción en uncat (no recategoriza), pero al menos el operador ya no tiene que copiar/pegar todas las notas en QuickBooks.

**Qué resuelve M2:** extrae uncats de QBO + recibe notas del cliente + escribe notas+memo a QBO automático. **Plus opcional (NO entra en MVP):** un modelo que intentara recategorizar en base a vendor + nota del cliente.

#### M3 — Customer Support Dashboard (reemplaza GS Customer Support)

**Columnas actuales del GS:**

```
Company | Notific. | Status | Amount | Progress | AMA's | Uncats | 2025 | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec
```

**Cómo funciona hoy:**

- Reporte/dashboard donde están listados todos los clientes.
- `Notific`: fecha en que se le mandó correo avisándole de uncats.
- `Status`: estado del progreso. Valores: `Need to review`, `Ready to Email`, `Email sent`, `No Uncats`, `Banking not Done`, `Sin Acceso a QB`.
- `Amount`: cifra total de todos los uncats de ese cliente.
- `Progress`: porcentaje del total vs lo que ha contestado el cliente.
- `AMA's`: información traída por fórmula del GS de uncats del cliente.
- `Uncats`: total de uncats.
- `2025`: total de uncats del año pasado.
- `Jan-Dec`: total de uncats por mes.

**Qué resuelve M3:** vista cross-cliente con status del proceso de uncats. **Mejora pedida:** dejar de depender de n8n para el llenado, que con un click se actualice todo.

#### M4 — Stmts/Recon Dashboard (reemplaza GS Stmts/Recon)

**Columnas actuales del GS:**

```
Client | Bank | Account | Account Type | Jan/Stmt | Jan/Recon | ... | Dec/Stmt | Dec/Recon | Notes
```

**Cómo funciona hoy:**

- Dashboard para saber si un estado de cuenta ya se descargó o si ya está conciliado.
- Se marca con estatus: paloma (ya se hizo), tacha (no se hizo), warning (falta algo por hacer), también si no existe un estado de cuenta.

**Convención de nombres de archivos en Dropbox:**

- Statement nuevo (sin conciliar): `2026-03.pdf`
- Statement conciliado: `#7244 - 2026-01.pdf` (prefijo `#account` indica que ya está conciliado)

**Mejora pedida:** que el dashboard se llene automático dependiendo de si encuentra los archivos en Dropbox.

#### M5 — Receipts Dropbox (mejora flujo de recibos)

**Estado actual:** El cliente sube recibos a Dropbox. No hay automatización.

**Mejoras pedidas:**

- Algo que avise cuando el cliente subió un recibo.
- **Plus (opcional):** renombrar los recibos automáticamente en base a `Vendor - Fecha - $Total.pdf`.

#### M6 — 1099 Dashboard (reemplaza GS 1099's)

**Columnas actuales del GS:**

```
Owner | Status for 2025 | Date of Final Request Letter Sent | Client | Form | Link (AGG) | IAV Reviewed | 1099 Submitted | Notes
```

**Cómo funciona hoy:**

- Dashboard donde se listan todos los clientes y los diferentes estatus.
- `Owner`: encargado de ese cliente de sacar el listado.
- `Status` valores: `Required`, `Not Required`, `Not Engaged`, `Completed`, `Partially Complete`, `On Hold`, `Good To Process`, `Ready Review`.
- `Form`: link al GS de ese cliente.
- `IAV Reviewed`, `1099 Submitted`: estatus con palomita/tachita/warning.

**Qué resuelve M6:** tracking anual de 1099 con dashboard cross-cliente.

#### M7 — W9 Dashboard con filtros guardados (reemplaza GS W9 cliente)

**Columnas actuales del GS W9 cliente:**

```
Vendor | Rent | Subcontractors | Address | Tax ID | Mailed | Notes
```

**Cómo funciona hoy:**

- `Vendor`: auto-descriptivo.
- `Rent` y `Subcontractor`: totales de todos los expenses del vendor en esas categorías.
- `Address` y `Tax ID`: status (palomita / tachita) de si se tiene esa información dada de alta en QuickBooks.

**Mejora pedida (la más compleja de los 7):**

- Dashboard donde el operador pueda hacer un seleccionado de categorías QBO.
- Ese filtrado se queda guardado.
- En automático, en base al filtro, se llena el GS W9.
- En el dashboard debe poder filtrar lo que NO quiere. Ejemplo: en `Repairs` podría tener Home Depot y también Juan Pérez. El operador necesita filtrar por Repairs pero excluir Home Depot. **El sistema debe recordar la exclusión** ("no agregar Home Depot a Repairs nunca más").

### Orden tentativo de los Mx

```
P0 Fundación ✅
  └── P1 Intuit Core (mapi)
        └── P2 Plugin base + Consola Debug (mapi + kiro)
              ├── M1 Dashboard Administrator (control central)
              │     └── M2 Uncats Pipeline (consume M1 para saber qué clientes procesar)
              │           └── M3 Customer Support Dashboard (visualiza estado de M2)
              ├── M4 Stmts/Recon (independiente, lee Dropbox)
              ├── M5 Receipts Dropbox (independiente, watcher Dropbox)
              ├── M6 1099 Dashboard (independiente, tracking anual)
              └── M7 W9 Dashboard (más complejo, al final)
```

**Riesgo conocido:** si llega temporada de 1099 (oct-ene) sin M6, hay que pausar M2/M3 para atacar M6. Las reglas permiten reordenar.

---

## 8. Mapa maestro Mx → bloques en cada app

Este es el **acomodo concreto** de los M1-M7 dentro de la estructura de roadmap por app. Cada Mx se reparte entre los apps que necesita.

### Convención de numeración

- **Bloques de primer nivel** (`00-foundation`, `10-core-ui`, `20-dashboards-clientes`): siempre numerados con decenas (`NN-`).
- **Sub-bloques con dependencia secuencial** (oauth → bridge → connectors): numerar con `01-`, `02-`, etc.
- **Sub-bloques que mapean a Mx del producto** (M1-M7): prefijo `m1-`, `m2-`, etc. (vocabulario del operador).
- **Sub-bloques paralelos sin Mx específico** (auth, users dentro de core-auth; qbo-dev, qbo-internal dentro de connectors): sin numerar.

### Tabla cruzada Mx → bloques en cada app

| Mx                      | mapi (backend)                                                                 | bvcpas (frontend)                             | kiro (plugin)                              |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------ |
| **P0** ✅               | `00-foundation/` ✅                                                            | `00-foundation/` ✅                           | `00-foundation/` ✅                        |
| **P1 Intuit Core**      | `20-intuit/01-oauth/`                                                          | —                                             | —                                          |
| **P2 Plugin base**      | `20-intuit/02-bridge/`                                                         | —                                             | `10-bridge-client/`                        |
| **M1 Dashboard Admin**  | `11-clients/` (extender) + `50-features/m1-admin/`                             | `20-dashboards-clientes/m1-admin/`            | —                                          |
| **M2 Uncats Pipeline**  | `50-features/m2-uncats/` + `40-classification/` (opcional) + `60-posting-qbo/` | `20-dashboards-clientes/m2-uncats/`           | `20-qbo-scripts/m2-uncats-write/`          |
| **M3 Customer Support** | `50-features/m3-customer-support/`                                             | `20-dashboards-clientes/m3-customer-support/` | —                                          |
| **M4 Stmts/Recon**      | `25-dropbox-watcher/` + `50-features/m4-stmts-recon/`                          | `20-dashboards-clientes/m4-stmts-recon/`      | — (futuro: scraping bancos en `30-banks/`) |
| **M5 Receipts Dropbox** | `25-dropbox-watcher/` (extender) + `50-features/m5-receipts/`                  | `20-dashboards-clientes/m5-receipts/`         | — (futuro: upload en `40-receipts/`)       |
| **M6 1099 Dashboard**   | `50-features/m6-form-1099/`                                                    | `20-dashboards-clientes/m6-form-1099/`        | —                                          |
| **M7 W9 Dashboard**     | `50-features/m7-w9/`                                                           | `20-dashboards-clientes/m7-w9/`               | —                                          |

### Estructura final de cada app

#### apps/mapi/roadmap/

```
00-foundation/                          ✅ v0.1.0
10-core-auth/                           (futuro: cuando un módulo lo pida)
   ├── auth/
   ├── users/
   └── setup/
11-clients/                             P1: CRUD base + config (sync_start_date, enabled, draft, etc.)
20-intuit/                              P1 + P2
   ├── 01-oauth/                        P1 — OAuth + tokens encriptados + refresh
   ├── 02-bridge/                       P2 — WebSocket gateway con plugin
   └── 03-connectors/
       ├── qbo-dev/                     (cuando entre, paralelo a qbo-internal)
       └── qbo-internal/                (cuando entre)
30-staging/                             (cuando un módulo concreto lo pida)
40-classification/                      (M2 opcional + futuros — categorización ML)
50-features/                            Etapa 1 — features cross-cutting de los GS
   ├── m1-admin/                        M1 — endpoints admin + extensión de clients para config
   ├── m2-uncats/                       M2 — extracción uncats QBO + write notas/memo
   ├── m3-customer-support/             M3 — agregados cross-cliente de uncats
   ├── m4-stmts-recon/                  M4 — Dropbox watcher + reconciliation
   ├── m5-receipts/                     M5 — Dropbox notif + renamer opcional
   ├── m6-form-1099/                    M6 — tracking anual 1099
   └── m7-w9/                           M7 — filtros guardados con exclusiones por vendor
60-posting-qbo/                         (M2 backend para escritura — write notes/memo via plugin)
25-dropbox-watcher/                     (M4 + M5 — connector tipo "fuente externa")
95-event-log/                           (cuando entre auditoría)
96-admin-jobs/                          (cuando entre)
```

#### apps/bvcpas/roadmap/

```
00-foundation/                          ✅ v0.1.0
10-core-ui/                             (auth-client, layout, design system, theming)
   ├── auth-client/
   └── design-system/
20-dashboards-clientes/                 Etapa 1 — los 7 dashboards de los GS
   ├── m1-admin/                        M1 — control central del operador
   ├── m2-uncats/                       M2 — UI uncats por cliente
   ├── m3-customer-support/             M3 — vista cross-cliente
   ├── m4-stmts-recon/                  M4 — dashboard de statements/reconciliation
   ├── m5-receipts/                     M5 — notificaciones de recibos
   ├── m6-form-1099/                    M6 — tracking 1099
   └── m7-w9/                           M7 — filtros guardados
30-settings/                            (Etapa 2+ — settings, perfil, admin general)
```

#### apps/kiro/roadmap/

```
00-foundation/                          ✅ v0.1.0
10-bridge-client/                       P2 — WebSocket + auth con mapi
20-qbo-scripts/                         Etapa 1 — content scripts QBO
   └── m2-uncats-write/                 M2 — escribe notas/memo en QBO
30-banks/                               (M4 futuro — scraping statements de bancos, si entra)
40-receipts/                            (M5 futuro — upload de recibos, si entra)
```

### Reglas para acomodar un Mx

1. **Un Mx = N módulos en cada app**, NO una carpeta única. Ejemplo: M1 toca `11-clients` (extensión) + `50-features/m1-admin/` en mapi, y `20-dashboards-clientes/m1-admin/` en bvcpas.

2. **Las versiones se sincronizan por entrega del Mx**, no por app. Ejemplo: M1 puede cerrar con `mapi-v0.3.0` + `bvcpas-v0.2.0` que se commitean por separado pero se prueba el end-to-end juntos.

3. **Cada commit toca un solo app** (regla 17). Pero un Mx **toma varios commits** alternando entre apps. Termina cuando todas las piezas del Mx están vivas y el operador lo usa día a día.

4. **Solo una versión `🚧` a la vez en todo el proyecto** (regla 18). No abrimos M1 y M2 simultáneo aunque sean apps distintos.

5. **Pre-requisitos antes de Mx:** P1 (Intuit Core en mapi → `20-intuit/01-oauth/`) y P2 (Plugin v2 base en kiro → `10-bridge-client/`). Hasta que esos no estén, los Mx no pueden arrancar.

6. **El TDD vivo de cada bloque agrupado** (ej. `20-dashboards-clientes/README.md`) cubre los 7 sub-dashboards con sub-secciones por cada uno. Así entiendes el bloque entero sin abrir 7 carpetas.

---

## 9. Stack confirmado (resumen)

### Runtime

- Node.js 22 LTS (lockeado en `engines.node` de cada app).
- TypeScript ^5.7+ estricto.
- npm como package manager local de cada app. Sin workspaces.

### Backend (apps/mapi/)

- NestJS 11.x.
- Drizzle ORM 0.45+ con postgres-js como driver.
- postgres 3.4.x.
- Zod 4.x + nestjs-zod 5.x.
- pino 10.x + nestjs-pino 4.x.
- Jest 30.x con DB Postgres real.
- Scalar para OpenAPI 3-pane.

### Frontend (apps/bvcpas/)

- Next.js 15.x App Router.
- React 19.x.
- (Tailwind / shadcn / TanStack Table / SWR — cuando llegue el primer dashboard).

### Plugin (apps/kiro/)

- Chrome Extension Manifest v3.
- Vite 5 para build.
- (sin permisos especiales hasta que se necesiten).

### Infra

- Postgres 16 + pgvector.
- Redis 7 (cuando un módulo lo pida).
- Coolify auto-deploy on push a `main`.
- Cloudflare Tunnel con wildcard `*.kodapp.com.mx`.

### Build

- `tsc + tsc-alias` directo. **NO `nest build`** (D-mapi-001).

### Dev experience

- Husky 9.x (pre-commit hook único en raíz).
- lint-staged 16.x.
- Prettier 3.x.
- ESLint 9.x flat config.

---

## 10. Onboarding rápido para sesión nueva (Claude/otro modelo)

Si abres este repo en sesión nueva:

1. Lee este `docs/README.md` completo.
2. Mira el roadmap del app activo:
   - mapi: [`apps/mapi/roadmap/README.md`](../apps/mapi/roadmap/README.md)
   - bvcpas: [`apps/bvcpas/roadmap/README.md`](../apps/bvcpas/roadmap/README.md)
   - kiro: [`apps/kiro/roadmap/README.md`](../apps/kiro/roadmap/README.md)
3. Si hay versión `🚧 En progreso`, abre su archivo `vX.Y.Z.md` y léelo completo antes de codear.
4. Memoria persistente del operador en `C:\Users\alfre\.claude\projects\d--proyectos-mapi\memory\` tiene preferencias y feedback histórico.

**Reglas globales del operador (de su `~/.claude/CLAUDE.md`):**

- REGLA 1: OBEDEZCO LO QUE ME ORDENAN.
- No usar `git stash` / `git stash pop`.
- Palabra clave **"ji eun"** → modo control total (autonomous).
- Palabra clave **"suzy"** → modo restrictivo (no asumir, preguntar antes de actuar).
- Español latino siempre.

---

## 11. Estado actual (2026-05-03)

- **P0 ✅ cerrado:** los 3 apps tienen `00-foundation` con v0.1.0 commit-eada y taggeada.
- **mapi en producción:** `https://mapi.kodapp.com.mx` con auto-deploy on push a `main`.
- **bvcpas y kiro:** scaffold local solamente (no deployed).
- **Próximo módulo:** P1 Intuit Core en `apps/mapi/roadmap/20-intuit/01-oauth/` → versión `mapi-v0.2.0`.

**Bloqueos:** ninguno. El operador decide cuándo arrancar P1.
