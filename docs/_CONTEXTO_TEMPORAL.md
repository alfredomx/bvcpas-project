# CONTEXTO TEMPORAL

> **Este archivo es memoria externa de Claude.** No es documentación del proyecto, no es base, no es guía. Solo existe para que cuando se resetee el contexto del modelo, no se pierdan las decisiones tomadas en chat largo.
>
> **Se borra cuando los TDDs reales de cada módulo existan.**
>
> **Fecha de creación:** 2026-05-02.
> **Operador:** Alfredo Guerrero.
> **Modelo:** Claude.

---

## 1. Para el Claude que esté leyendo esto

Si estás abriendo este archivo porque eres un Claude nuevo o porque tu contexto se resetó:

1. **Lee este archivo COMPLETO antes de proponer cualquier cosa.** No lo escanees, léelo.
2. **No improvises.** Cada decisión aquí fue tomada después de iterar. Si algo te parece "obvio" hacer distinto, primero pregunta al operador por qué se decidió así.
3. **No agregues "ya que estamos".** Si vas a tocar código o docs, hazlo solo en lo pedido.
4. **Si el operador escribe `suzy`, vuelves a modo restrictivo:** no asumir, no escribir nada no pedido, preguntar antes de actuar.
5. **Cuando los TDDs reales de cada módulo existan, este archivo se borra.** Mientras no se borre, sigue siendo la fuente de verdad para tu contexto.

---

## 2. Qué es este proyecto

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

### Qué NO es este proyecto

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

### Qué SÍ es

Un sistema que **reemplaza progresivamente los Google Sheets internos frágiles** que el operador usa hoy para controlar el cierre mensual de sus clientes. Es una herramienta operativa diaria del bookkeeper, no un experimento técnico.

---

## 3. Histórico del proyecto: por qué llegamos aquí

### Mapi v0.x (proyecto previo, congelado)

El operador construyó **mapi v0.x** durante 19 versiones (v0.0.1 a v0.19.1, cerrada 2026-04-29). Mapi v0.x está corriendo en producción Coolify con:

- 77 clientes autorizados con OAuth Intuit.
- Sync qbo-dev funcionando (11 entidades).
- Sync qbo-internal vía plugin Chrome (qubot).
- Bridge WebSocket plugin↔backend.
- Encryption AES-256-GCM, JWT auth, BullMQ workers, observability completa.
- Backups diarios a Google Drive.

**Diagnóstico crítico:** mapi v0.x invirtió 19 versiones en **plumbing (ingesta + staging + sync)** sin entregar producto visible al bookkeeper. El operador NO bajó horas/cliente/mes. La razón: el TDD original organizaba por capas técnicas (ingesta → staging → lógica → acciones → UI), forzando construir el 70% del plumbing antes del primer feature útil.

### El pivote

Después de iterar en este chat, el operador y Claude llegaron a la conclusión:

> **El proyecto nuevo no es continuación de mapi v0.x. Es repo separado, naming nuevo, schema nuevo. Mapi v0.x queda congelado como referencia.**

El proyecto nuevo se llama **bvcpas-project** (path: `d:\proyectos\bvcpas-project\`).

Razón de no continuar mapi v0.x:

- Naming de tablas/columnas/endpoints no es consumible desde dashboards (estaba pensado para espejear QBO).
- Refactor de naming en sitio sería más caro que arrancar limpio (303 tests acoplados, 3 sistemas externos consumiendo).
- Migrations de mapi v0.x atadas a decisiones que no aplican.

Lo que SE REUSA de mapi v0.x:

- Lógica de OAuth, refresh tokens, encryption AES-256-GCM, IntuitApiService, JWT auth, mappers QBO.
- Configuraciones de tooling (eslint, prettier, husky, lint-staged, tsconfig).
- Convención de módulos numerados del backend.

Lo que NO se reusa:

- Naming de tablas/columnas/endpoints.
- `staging_*` tablas (diferidas).
- Bridge WebSocket actual (se rediseña desde cero).
- Plugin actual (se borra y se hace nuevo Manifest v3).

---

## 4. Decisiones arquitectónicas tomadas

### Modelo B: monorepo con apps independientes

```
┌──────────────┐  ws/http  ┌─────────────┐  http+sse  ┌──────────────┐
│   Plugin     │ <──────> │   Backend   │ <───────>  │   Frontend   │
│  (Chrome)    │           │  (NestJS)   │            │  (Next.js)   │
└──────────────┘           └─────────────┘            └──────────────┘
       │                          │                          │
       │                          │                          │
   ejecutor mínimo:           toda la lógica            UI de los
   solo cosas que             + persistencia            dashboards
   requieren sesión           + orquestación            + interacción
   humana en QBO/bancos                                 con operador
```

**Reglas no negociables del Modelo B:**

- **El plugin habla SOLO con el backend.** Nunca habla directo al frontend.
- **El backend es la única fuente de verdad.**
- **El frontend lee siempre del backend.**
- **Apaga el plugin** → la mayoría de dashboards siguen funcionando.
- **Apaga el frontend** → backend sigue procesando webhooks y syncs.
- **Apaga el backend** → todo muere (es la pieza central).

**Reparto de responsabilidades:**

- **Plugin:** ejecutor mínimo. Solo cosas que requieren sesión humana en QBO o bancos. Sin lógica de negocio. Sin UI compleja.
- **Frontend:** UI de los dashboards. Lee del backend.
- **Backend:** toda la lógica de negocio + persistencia + orquestación.

### NO se usa npm workspaces

**Decisión consciente.** Cada app (`api`, `web`, `plugin`) es un proyecto independiente con su propio `package.json` y `node_modules/`.

**Razón:** simplicidad. Workspaces agrega magia (hoisting, lockfile compartido, scripts cross-app) que no se necesita para 3 apps de un solo operador. Cada app es 100% portable: si en el futuro se separa a su propio repo, se mueve la carpeta y listo.

**Lo que SÍ está compartido:**

- Tipos TypeScript en `shared/` (importados via tsconfig paths).
- Husky + pre-commit hook en raíz (git solo lee hooks de raíz, no se puede mover).
- `.gitignore` raíz.

**Lo que NO está compartido:**

- `package.json` (uno por app + uno mínimo en raíz solo para husky).
- `node_modules/` (uno por app).
- `eslint.config.mjs` y `.prettierrc` (uno por app, configuración base copiable).
- `tsconfig.json` (uno por app).

### `shared/` plano, fuera de `apps/`

```
<repo>/
├── apps/
│   ├── api/
│   ├── web/
│   └── plugin/
├── shared/                       ← aquí. plano. archivos .ts directo.
│   ├── client.ts
│   ├── connection.ts
│   └── ...
```

**Razón:**

- `shared/` no es app ejecutable, no debe vivir en `apps/`.
- Sin `packages/`, sin `src/` interno, sin `package.json` propio.
- Solo archivos `.ts` planos.

**Cómo se importan:**

```typescript
// con alias en tsconfig.json: "@shared/*": ["../../shared/*"]
import { Client } from '@shared/client'
```

`tsc-alias` reescribe el path en runtime durante el build.

### Convención de módulos del backend (heredada de mapi v0.x)

Cada módulo de negocio del backend vive en `apps/mapi/src/modules/NN-nombre/`, con número que indica su bloque.

| Rango   | Tipo                                       | Ejemplos                                               |
| ------- | ------------------------------------------ | ------------------------------------------------------ |
| `10-19` | Core / plataforma                          | `10-core-auth`, `11-clients`, `12-config`              |
| `20-29` | Connectors (ingesta de servicios externos) | `20-intuit-oauth`, `21-intuit-bridge`, `22-connectors` |
| `30-39` | Staging / datos                            | `30-staging`                                           |
| `40-49` | Lógica central                             | `40-classification` (futuro)                           |
| `50-59` | Lógica de dominio                          | `50-reconciliation` (futuro)                           |
| `60-69` | Escritura externa                          | `60-posting-qbo` (futuro)                              |
| `70-79` | Operación visible                          | `70-flags` (futuro)                                    |
| `80-89` | Knowledge / bot                            | `80-rag-bot` (futuro)                                  |
| `90-99` | Operación transversal                      | `95-event-log`, `96-admin-jobs`, `health`              |

**Reglas:**

1. Todo módulo de negocio vive en `modules/NN-nombre/`. Servicios transversales (logger, encryption, config) viven en `core/`, sin número.
2. Numeración por bloque de 10, deja espacio para inserciones futuras.
3. `health` es excepción: es módulo pero sin número porque su path es estable.
4. Sub-carpetas dentro de un módulo cuando tiene 3+ sub-dominios y 8+ archivos (D-027 mapi v0.x).
5. Sub-módulos numerados como sub-carpetas cuando un bloque crece. Ej: `22-connectors/qbo-dev/`, `22-connectors/qbo-internal/`.

**Estructura típica de un módulo:**

```
apps/mapi/src/modules/11-clients/
├── clients.module.ts
├── clients.controller.ts
├── clients.service.ts
├── clients.repository.ts
├── clients.errors.ts
├── dto/
│   ├── create-client.dto.ts
│   └── update-client.dto.ts
└── clients.controller.spec.ts
```

### Despliegue en Coolify con subdominios separados

| Pieza    | Subdominio                   | Cómo se despliega                                              |
| -------- | ---------------------------- | -------------------------------------------------------------- |
| Backend  | `api.<dominio>`              | Coolify auto-deploy en push a `main` con filter `apps/mapi/**` |
| Frontend | `app.<dominio>`              | Coolify auto-deploy en push a `main` con filter `apps/web/**`  |
| Plugin   | n/a                          | Build local + zip, instalación manual en Chrome                |
| Postgres | resource separado en Coolify | Compartido entre apps via DATABASE_URL                         |
| Redis    | resource separado            | Cuando un módulo lo pida (no antes)                            |
| Backups  | Coolify container con rclone | Diario a Google Drive                                          |

**Cloudflare tunnel:** dos reglas para los 2 subdominios apuntando al server Ubuntu.

**WebSocket:** mismo subdominio del backend (`wss://api.<dominio>/ws/...`). No hace falta subdominio separado.

**Auth WebSocket:**

- Frontend → backend: JWT en cookie httpOnly compartida con `domain=.<dominio>` o query param `?token=`.
- Plugin → backend: JWT específico para el plugin (no la cookie del frontend).

### Stack confirmado

#### Runtime

- Node.js 22 LTS (lockeado en `engines.node` de cada app).
- TypeScript ^6.x estricto.
- npm como package manager local de cada app. Sin workspaces.

#### Backend (`apps/mapi/`)

- NestJS 11.x (mismo que mapi v0.x).
- Drizzle ORM 0.45+ con postgres-js como driver.
- postgres 3.4.x.
- Zod 4.x + nestjs-zod ^5.x.
- @nestjs/jwt 11.x.
- bcrypt 6.x.
- pino 10.x + nestjs-pino ^4.x.
- Jest 30.x con DB Postgres real.

#### Frontend (`apps/web/`)

- Next.js 15.x App Router.
- React 19.x.
- Tailwind CSS 4.x.
- shadcn/ui (copia local, no dependency).
- TanStack Table v8.
- react-hook-form + Zod resolver.
- SWR.

#### Plugin (`apps/kiro/`)

- Chrome Extension Manifest v3.
- TypeScript ^6.x.
- Vite para build.

#### Infra

- Postgres 16 (P0).
- Redis 7 (cuando un módulo lo pida).
- Docker / Compose para dev local + prod.
- pino-loki ^3.x (cuando observability lo justifique).

#### Build

- `tsc` directo. **NO `nest build`** (D-071: webpack falla silencioso).
- `tsc-alias` para reescribir `@/*` y `@shared/*` paths en el dist.

#### Dev experience

- Husky ^9.x (pre-commit hook, instalado solo en raíz).
- lint-staged ^16.x (solo archivos staged).
- Prettier ^3.x.
- ESLint ^9.x flat config.
- typescript-eslint ^8.x.
- tsx 4.x para scripts CLI.

### Estructura de archivos del repo

```
<repo>/
├── package.json                  ← raíz mínimo (solo husky + lint-staged + scripts orquestadores)
├── .husky/
│   └── pre-commit                ← hook único, llama a cada app
├── .gitignore
├── README.md
├── docker-compose.yaml
├── docker-compose.local.yml
│
├── shared/                       ← tipos compartidos, archivos .ts planos
│   ├── client.ts
│   ├── connection.ts
│   ├── finding.ts
│   └── ...
│
├── apps/
│   ├── api/                      ← backend NestJS, INDEPENDIENTE
│   │   ├── package.json
│   │   ├── node_modules/
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── eslint.config.mjs
│   │   ├── .prettierrc
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── core/             ← infra transversal
│   │       │   ├── config/
│   │       │   ├── encryption/
│   │       │   ├── logger/
│   │       │   └── correlation/
│   │       └── modules/          ← módulos numerados
│   │           ├── 10-core-auth/
│   │           ├── 11-clients/
│   │           ├── 20-intuit-oauth/
│   │           └── ...
│   │
│   ├── web/                      ← frontend Next.js, INDEPENDIENTE
│   │   ├── package.json
│   │   ├── node_modules/
│   │   ├── tsconfig.json
│   │   ├── eslint.config.mjs
│   │   ├── .prettierrc
│   │   ├── next.config.mjs
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── app/
│   │       └── components/
│   │
│   └── plugin/                   ← Chrome extension, INDEPENDIENTE
│       ├── package.json
│       ├── node_modules/
│       ├── tsconfig.json
│       ├── eslint.config.mjs
│       ├── .prettierrc
│       ├── manifest.json
│       └── src/
│
└── (durante Etapa 1, los TDDs de cada módulo van aquí o donde el operador decida)
```

---

## 5. Glosario de abreviaciones

### Convenciones del proyecto

| Abreviación           | Significado                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P0`, `P1`, `P2`      | **Pre-requisito** técnico. Trabajo que NO entrega valor directo al día a día del bookkeeper, pero sin él los módulos no pueden existir. Ej: P0 Fundación = auth + encryption + health. |
| `M1`, `M2`, ..., `M7` | **Módulo** de Etapa 1. Cada uno reemplaza un Google Sheet interno y SÍ entrega valor día a día.                                                                                        |
| `MN`                  | Módulo genérico (placeholder para "el módulo N", sea P o M).                                                                                                                           |
| `M?.X`                | **Sub-etapa** del módulo. Cada sub-etapa = un commit. Ej: M2.1, M2.2, M2.3.                                                                                                            |
| `TDD`                 | Technical Design Document. Documento de diseño técnico de un módulo.                                                                                                                   |
| `GS`                  | Google Sheet. Los 7 GS internos del operador son el origen de los módulos M1-M7.                                                                                                       |
| `Etapa 1`             | Conjunto cerrado de 7 módulos (M1-M7) que reemplazan los 7 GS internos. Cuando los 7 estén commit-eados y en uso día a día, Etapa 1 cierra.                                            |
| `Etapa 2+`            | Lo que viene después de Etapa 1. Se planea con datos de uso real, no antes.                                                                                                            |

### Técnicas (estándar industria)

| Abreviación | Significado                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `QBO`       | QuickBooks Online (la plataforma contable de Intuit).                                                      |
| `OAuth`     | Open Authorization. Protocolo de autorización de Intuit.                                                   |
| `JWT`       | JSON Web Token. Token de sesión que el frontend manda al backend.                                          |
| `REST`      | Representational State Transfer. Estilo de API HTTP (GET, POST, PATCH, DELETE).                            |
| `WS` / `ws` | WebSocket. Canal bidireccional persistente. Lo usa el plugin para hablar con el backend.                   |
| `SSE`       | Server-Sent Events. Canal del backend al frontend para push en tiempo real.                                |
| `UI`        | User Interface. La parte visual con la que el operador interactúa.                                         |
| `DB`        | Database. La base de datos Postgres.                                                                       |
| `PK`        | Primary Key. Llave primaria de una tabla (típicamente `id`).                                               |
| `FK`        | Foreign Key. Llave foránea (referencia a otra tabla, ej. `client_id`).                                     |
| `OCR`       | Optical Character Recognition. Extracción de texto desde imágenes/PDFs.                                    |
| `LLM`       | Large Language Model. Modelos como Gemma, Claude.                                                          |
| `RAG`       | Retrieval-Augmented Generation. Patrón de buscar contexto en una base y dárselo al LLM antes de responder. |
| `CDC`       | Change Data Capture. Endpoint de QBO que devuelve solo lo cambiado desde una fecha.                        |
| `ORM`       | Object-Relational Mapper. Drizzle es el ORM del proyecto.                                                  |
| `CI`        | Continuous Integration. Pipeline que corre tests al hacer commit/push.                                     |
| `CRUD`      | Create, Read, Update, Delete. Operaciones básicas sobre una tabla.                                         |

### Reglas

| Abreviación | Significado                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `suzy`      | Palabra clave del operador que activa **modo restrictivo** en el modelo (no asumir, preguntar antes de actuar, no escribir nada no pedido). |

---

## 6. Reglas operativas heredadas de mapi v0.x

| Decisión                                            | Razón                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **No `nest build`, usar `tsc` directo**             | Webpack de Nest falla silencioso. Heredado D-071 mapi v0.x.                                                           |
| **Clean antes de build y antes de start:dev**       | Evita cache TS stale. Heredado D-007.                                                                                 |
| **`--max-warnings=0` en ESLint**                    | Cero tolerancia a warnings.                                                                                           |
| **`prettier --check` en lint-staged, no `--write`** | Falla si no está formateado, en vez de auto-formatear silencioso. Operador siempre corre `npm run format` consciente. |
| **TSC type-check en pre-commit**                    | Un archivo puede romper types en otro lado aunque no esté en este commit.                                             |
| **NUNCA `git commit --no-verify`**                  | Si el hook falla, root cause. Bypassear convierte el sistema en teatro.                                               |
| **Engines lock `node: >=22`**                       | Evita drift entre máquinas y server.                                                                                  |
| **Override ESLint en tests**                        | Mocks producen falsos positivos type-aware. Heredado D-063.                                                           |
| **Módulos numerados en backend**                    | `apps/mapi/src/modules/NN-nombre/`.                                                                                   |

### Reglas duras del repo (filosofía mapi v0.x)

1. **Cada módulo entrega valor usable día a día.** No "deja la base lista", no "habilita módulos futuros". Excepción: pre-requisitos técnicos (P0, P1, P2).
2. **Lo que NO entra es igual o más largo que lo que SÍ entra.** Si la sección NO entra es más corta que SÍ entra, no se pensó suficiente.
3. **Auth mínima del módulo, no auth completa del proyecto.** P0 construye solo lo mínimo: login admin + JWT + bcrypt + encryption. Cada módulo siguiente que requiera más auth la agrega como parte de su entregable.
4. **Naming review antes de cualquier migration.** Si el nombre no se entiende leyéndolo, se cambia. Aplica también a endpoints.
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
15. **Plugin = ejecutor mínimo. Frontend = UI. Backend = lógica.** No se mezclan.
16. **No borrar lo viejo hasta tener reemplazo.** Mapi v0.x queda congelado como referencia.

---

## 7. Configuraciones canónicas (copiar tal cual)

### `package.json` raíz (mínimo)

```json
{
  "name": "bvcpas-project",
  "private": true,
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "format": "npm run format --prefix apps/mapi && npm run format --prefix apps/web && npm run format --prefix apps/kiro",
    "format:check": "npm run format:check --prefix apps/mapi && npm run format:check --prefix apps/web && npm run format:check --prefix apps/kiro",
    "lint": "npm run lint --prefix apps/mapi && npm run lint --prefix apps/web && npm run lint --prefix apps/kiro",
    "typecheck": "npm run typecheck --prefix apps/mapi && npm run typecheck --prefix apps/web && npm run typecheck --prefix apps/kiro",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0"
  },
  "lint-staged": {
    "apps/mapi/**/*.{ts,tsx,js,mjs}": [
      "prettier --check --config apps/mapi/.prettierrc",
      "eslint --max-warnings=0 --config apps/mapi/eslint.config.mjs"
    ],
    "apps/web/**/*.{ts,tsx,js,mjs}": [
      "prettier --check --config apps/web/.prettierrc",
      "eslint --max-warnings=0 --config apps/web/eslint.config.mjs"
    ],
    "apps/kiro/**/*.{ts,tsx,js,mjs}": [
      "prettier --check --config apps/kiro/.prettierrc",
      "eslint --max-warnings=0 --config apps/kiro/eslint.config.mjs"
    ],
    "shared/**/*.ts": ["prettier --check --config apps/mapi/.prettierrc"],
    "*.{json,md,yml,yaml}": ["prettier --check"]
  }
}
```

### `.husky/pre-commit` (raíz)

```sh
#!/usr/bin/env sh
set -e

echo "→ lint-staged (prettier + eslint sobre archivos staged)"
npx lint-staged

echo "→ typecheck en apps modificadas"
npm run typecheck

echo "✓ pre-commit OK"
```

Permisos: `chmod +x .husky/pre-commit`. Husky lo hace al primer install.

### `apps/mapi/package.json` (ejemplo)

```json
{
  "name": "@bvcpas/api",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "build": "rimraf dist && tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "start": "node dist/main.js",
    "start:dev": "rimraf dist && nest start --watch",
    "lint": "eslint \"src/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@nestjs/common": "11.x",
    "@nestjs/core": "11.x"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/jest": "^30.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.0.0",
    "tsc-alias": "^1.8.16",
    "rimraf": "^6.0.0"
  }
}
```

### `apps/mapi/.prettierrc` (idéntico para web y plugin)

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "overrides": [
    {
      "files": ["*.json", "*.jsonc"],
      "options": { "tabWidth": 2 }
    },
    {
      "files": ["*.md"],
      "options": { "tabWidth": 2, "proseWrap": "preserve" }
    }
  ]
}
```

### `apps/mapi/eslint.config.mjs` (idéntico para web y plugin con ajustes mínimos)

```javascript
// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Tests: relajamos reglas type-aware (heredado D-063 mapi v0.x)
  {
    files: ['**/*.spec.ts', '**/*.integration-spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
)
```

### `apps/mapi/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "sourceMap": true,
    "incremental": true,
    "removeComments": true,

    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,

    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,

    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../shared/*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*", "../../shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `apps/mapi/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

### Garantías antes de cada commit

Tres barreras automáticas en el pre-commit hook (raíz). Si pasan las tres, el commit se hace. Si una falla, `git commit` aborta.

| Barrera                           | Qué garantiza                                        | Qué pasa si falla                                      |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| **Prettier check**                | Todos los archivos staged tienen formato consistente | Commit abortado. Correr `npm run format` y re-stagear. |
| **ESLint con `--max-warnings=0`** | Cero warnings                                        | Commit abortado. Arreglar warnings.                    |
| **TSC type-check**                | Ningún archivo tiene errores de tipos                | Commit abortado. Arreglar tipos.                       |

**Política no negociable:** **NUNCA usar `git commit --no-verify`**. Si el hook falla, root cause.

---

## 8. Etapa 1: los 7 GS y los 3 pre-requisitos

### Pre-requisitos técnicos (P0, P1, P2)

| ID     | Nombre                         | Resuelve                                                                                     |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| **P0** | Fundación                      | Auth admin + encryption + health para manejar tokens reales                                  |
| **P1** | Intuit Core                    | Conectar clientes QBO, mantener tokens vivos, refresh, migración 77 clientes desde mapi v0.x |
| **P2** | Plugin v2 base + Consola Debug | Plugin Manifest v3 desde cero + extension page para query/report/raw QBO                     |

**Orden:** P0 → P1 → P2. P2 puede arrancar mientras los módulos M1+ se discuten.

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

**Qué resuelve M2:** extrae uncats de QBO + recibe notas del cliente + escribe notas+memo a QBO automático. **Plus mencionado por el operador (opcional, NO entra en MVP):** un modelo que intentara recategorizar en base a vendor + nota del cliente.

#### M3 — Customer Support Dashboard (reemplaza GS Customer Support)

**Columnas actuales del GS:**

```
Company | Notific. | Status | Amount | Progress | AMA's | Uncats | 2025 | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec
```

**Cómo funciona hoy:**

- Reporte/dashboard donde están listados todos los clientes.
- `Notific`: fecha en que se le mandó correo avisándole de uncats.
- `Status`: estado del progreso. Valores: `Need to review`, `Ready to Email`, `Email sent`, `No Uncats`, `Banking not Done`, `Sin Acceso a QB`.
- `Amount`: cifra total de todos los uncats de ese cliente (extraído por fórmula del GS del cliente).
- `Progress`: porcentaje del total vs lo que ha contestado el cliente.
- `AMA's`: información traída por fórmula del GS de uncats del cliente. Proceso de n8n se conecta a la API del operador, extrae total de uncats y lo guarda en el GS de uncats.
- `Uncats`: total de uncats.
- `2025`: total de uncats del año pasado.
- `Jan-Dec`: total de uncats por mes.

**Qué resuelve M3:** vista cross-cliente con status del proceso de uncats. **Mejora pedida explícita:** dejar de depender de n8n para el llenado, que con un click se actualice todo. Hoy el operador tiene que actualizar info de cada cliente en su GS de uncats, luego por fórmula obtener resultados, agregarlos al dashboard. Esto debe ser 1 click.

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

**Mejora pedida:** que el dashboard se llene automático dependiendo de si encuentra los archivos en Dropbox. Detección de status:

- Si existe archivo con la fecha del mes pasado → tenemos statement.
- Si no existe → no lo tenemos.
- Si está con formato `#account - YYYY-MM` → ya está conciliado.

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
- A partir de ahí se obtiene la información necesaria automático.

### Orden tentativo de los 7 módulos

Basado en dependencias conceptuales, NO es contrato. El operador puede reordenar según presión operativa.

```
P0 Fundación
  └── P1 Intuit Core
        └── P2 Plugin base + Consola Debug
              ├── M1 Dashboard Administrator (control central)
              │     └── M2 Uncats Pipeline (consume M1 para saber qué clientes procesar)
              │           └── M3 Customer Support Dashboard (visualiza estado de M2)
              ├── M4 Stmts/Recon (independiente, lee Dropbox)
              ├── M5 Receipts Dropbox (independiente, watcher Dropbox)
              ├── M6 1099 Dashboard (independiente, tracking anual)
              └── M7 W9 Dashboard (más complejo, al final)
```

**Razones:**

- M1 antes de M2: M1 controla qué clientes están enabled y qué fechas procesar.
- M2 antes de M3: M3 visualiza el estado que M2 produce.
- M4, M5, M6, M7 son independientes entre sí.
- M7 al final por complejidad (filtros persistentes con exclusiones por vendor).

**Riesgo conocido:** si el operador llega a temporada de 1099 (oct-ene) sin M6, va a tener que pausar M2/M3 para atacar M6. Eso está OK, las reglas permiten reordenar.

---

## 9. Filosofía del proyecto (heredada del diseño-original de mapi v0.x)

Estas filosofías se mantienen del proyecto original porque siguen siendo correctas:

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

## 10. Cómo se construirá cada módulo (NUEVO flujo)

Este es el flujo final acordado tras descartar el flujo Claude/GPT iterativo.

### Flujo:

1. **Operador da el alcance** del módulo en chat.
   - Ejemplo: "Vamos a hacer P0. Alcance: login admin con email + password + JWT. Encryption helper para tokens. Health endpoint. NO entra: TOTP, recovery, multi-user, roles."

2. **Claude escribe el TDD cerrado del módulo** estilo mapi v0.x.
   - Sin plantilla cuestionario.
   - Sin sección de notas Claude/GPT.
   - Es un contrato: qué entra, qué NO entra, qué decisiones, schema, endpoints, eventos, errores, tests, sub-etapas.
   - Cada sub-etapa = un commit con título `MN.X — <título>`.

3. **Operador lee el TDD.**
   - Si le gusta, dice "dale".
   - Si quiere ajustar, lo dice. Claude ajusta. Repite.

4. **Claude codea siguiendo el TDD AL PIE DE LA LETRA.**
   - Sub-etapa por sub-etapa.
   - Si encuentra algo no previsto en el TDD (caso edge, decisión no tomada), **PARA y pregunta al operador**. No improvisa.

5. **Cuando todas las sub-etapas están commit-eadas y el operador usa el módulo en operación real**, el módulo cierra.

### Lo que ESTÁ prohibido en este flujo:

- Improvisar decisiones no documentadas en el TDD.
- Agregar features "ya que estamos".
- Borrar features del TDD sin avisar al operador.
- Codear sin TDD aprobado primero.
- Usar `git commit --no-verify`.

### Estructura de un TDD cerrado (formato esperado):

```markdown
# MN — Nombre del módulo

**Estado:** 🚧 En progreso
**Inicio:** YYYY-MM-DD

## Alcance

### Sí entra

- Item 1
- Item 2
- ...

### NO entra

- Item 1 (con razón)
- Item 2 (con razón)
- ...

## Schema

### Tabla `nombre`

- columnas con tipo + constraint + razón

### Migrations

- `XXXX_<descripcion>.sql`

## Endpoints

### `MÉTODO /v1/path`

- Body, response, side effects, auth

## Eventos system_events

- `<dominio>.<recurso>.<accion>` — cuándo + payload

## Errores de dominio

- `<NombreError>` → HTTP status, code, cuándo se lanza

## Tests

- Comportamientos críticos a proteger (con criterio "debe fallar si...")
- Fixtures necesarios
- Smoke test

## Decisiones

- D-001: descripción + razón
- D-002: descripción + razón

## TODOs (sub-etapas)

- [ ] MN.1 — Setup + scaffolding
- [ ] MN.2 — Schema + migration
- [ ] MN.3 — Endpoint X + tests
- ...

## Hitos de cierre

- [ ] Todas las sub-etapas commit-eadas
- [ ] Smoke test pasa
- [ ] Tests críticos pasan en CI
- [ ] Operador usó el módulo ≥3 días distintos
- [ ] CHANGELOG actualizado
```

---

## 11. Lo que se intentó y se descartó (para que ningún Claude futuro lo reviva)

### Documentación de proceso con plantilla cuestionario y notas Claude/GPT

Se intentó crear una plantilla de TDD tipo cuestionario (`00-template-tdd-modulo.md`) con secciones `<RESPUESTA>` para que GPT proponga y Claude revise vía notas en sección 11 del propio TDD. El operador descartó este enfoque porque:

- Agrega coordinación que no necesita (es 1 operador, no equipo).
- Convierte cada módulo en iteración GPT/Claude que toma tiempo sin aportar al producto.
- El TDD cerrado estilo mapi v0.x fue lo que funcionó las primeras 19 versiones. No hay razón de cambiar el patrón que sí dio resultados.

**Conclusión:** GPT NO participa en el flujo. Solo Claude propone TDD cerrado. Operador aprueba o ajusta.

### npm workspaces

Se intentó usar npm workspaces para compartir dependencias entre `apps/mapi`, `apps/web`, `apps/kiro`. El operador descartó porque:

- Agrega complejidad innecesaria para 3 apps de 1 operador.
- Hoisting de dependencias y lockfile compartido son magia que no se necesita.
- Si en el futuro se separa una app, mover `node_modules/` propio es más simple.

**Conclusión:** cada app tiene su propio `package.json` y `node_modules/`. Tipos compartidos viven en `shared/` plano, importados via tsconfig paths.

### Carpeta `packages/shared-types/src/`

Se intentó organizar tipos compartidos como `packages/shared-types/src/...`. El operador descartó por anidación innecesaria. **Conclusión:** carpeta `shared/` plana con archivos `.ts` directo, sin `src/`, sin `package.json`, sin `node_modules/`.

### Múltiples archivos de documentación de proceso

Se intentó tener `START_HERE.md`, `00-template-tdd-modulo.md`, `01-reglas-de-trabajo.md`, `02-indice-modulos.md`, `03-stack-y-tooling.md` como sistema de documentación.

El operador detectó que el problema raíz es que la documentación está organizada por archivo en vez de por necesidad de quien la consume, y que cada Claude nuevo se pierde entre archivos.

**Conclusión:** se borra todo lo de `docs/`. Cuando los TDDs reales de cada módulo existan, ellos son la documentación. Antes de eso, este `_CONTEXTO_TEMPORAL.md` es la única fuente de verdad para Claudes que pierden contexto.

### Claude/GPT con roles invertidos

Se intentó primero "GPT propone, Claude revisa", luego se invirtió a "Claude propone, GPT revisa". Ambos modelos descartados al final.

**Conclusión:** solo Claude trabaja con el operador. GPT queda fuera del proyecto.

### Versionado por header en lugar de `/v1/` en path

Se propuso versionar la API por header (`Accept: application/vnd.bookie.v1+json`) en vez de `/v1/` en path. El operador descartó por simplicidad.

**Conclusión:** prefijo `/v1/` explícito en backend.

---

## 12. Estado actual del proyecto

**Fecha:** 2026-05-02.

**Mapi v0.x:** congelado en producción Coolify. Sirve como referencia. Se apagará tras Etapa 1 del proyecto nuevo.

**Repo nuevo:**

- **Path local:** `d:\proyectos\bvcpas-project\`.
- **Repo Git remoto:** `git@github.com:alfredomx/bvcpas-project.git` (GitHub).
- **Estructura actual:**

```
d:\proyectos\bvcpas-project\
├── .git/
└── docs/
    ├── INDICE.md                  ← estado vivo de módulos
    ├── _CONTEXTO_TEMPORAL.md      ← este archivo
    └── modulos/
        └── P0-fundacion.md        ← TDD del primer módulo (estado: 🔬 en discusión)
```

**Próximo paso concreto:**

1. Arrancar P0.1: crear archivos del repo (`package.json` raíz, `.husky/`, `.gitignore`, `README.md`, `.env.example`, `.env.test.example`).
2. `git remote add origin git@github.com:alfredomx/bvcpas-project.git` (ya hecho).
3. Primer commit + push a `main`.

**Bloqueos:** ninguno operativo. El operador decide cuándo arrancar P0.

**Decisiones pendientes del operador:**

- Nombre del subdominio (¿`api.bvcpas.com`? ¿`api.alfredo.mx`?).
- Nombre del paquete npm (`@bvcpas/api` está propuesto pero no firmado).
- Si Vaultwarden entra desde P0 o se queda con `.env` hasta que duela.
- Configuración exacta de Cloudflare tunnel para los nuevos subdominios.

---

## 13. Información de contacto y entornos del operador

### Entorno actual del operador

- **Plataforma:** Windows 11 Pro 10.0.26200 (laptop personal del operador).
- **Server prod:** Ubuntu con Coolify (mapi v0.x corriendo).
- **Cloudflare tunnel** ya configurado con dominios HTTPS.
- **PC del operador** tiene tunnel `dev-mapi` que apunta `dev.alfredo.mx` → `localhost:4000`.
- **App "BV CPAs Dev"** registrada en Intuit Developer Portal para dev local.
- **App "BV CPAs, PLLC"** en producción para mapi.alfredo.mx.
- **77 clientes autorizados** en mapi v0.x con tokens activos.

### Memoria del operador (contexto adicional)

El operador tiene `C:\Users\alfre\.claude\projects\d--proyectos-mapi\memory\` con notas persistentes que ayudan a entender preferencias y feedback histórico. Si el contexto se resetea, ese directorio tiene memoria de sesiones anteriores.

### Reglas globales del operador (de su CLAUDE.md global)

- **REGLA 1:** OBEDEZCO LO QUE ME ORDENAN.
- **No usar `git stash` / `git stash pop`** — destruye trabajo en progreso.
- **Palabra clave "ji eun"** — modo control total (autonomous).
- **Palabra clave "suzy"** — modo restrictivo (no asumir, preguntar antes de actuar).
- **Español latino siempre.** Operador es mexicano.

---

## 14. Autocrítica del proceso de hoy (lecciones para Claude futuro)

Durante este chat largo, Claude (yo) cometió varios errores que vale la pena documentar para que no se repitan:

1. **Sobre-construir documentación de proceso.** Confundí "documentación de proceso" (cómo trabajamos) con "documentación de contrato" (qué construimos). El operador necesita lo segundo, no lo primero.

2. **Asumí que mantener el flujo Claude/GPT iterativo era valioso.** Era complejidad agregada para 1 operador. Cuando el operador descartó GPT, no debí haber resistido.

3. **Agregué npm workspaces sin preguntar.** Reflejo automático de "monorepo profesional" sin validar si el operador lo necesitaba. Sesgo de sobre-ingeniería.

4. **Usé carpetas anidadas (`packages/shared-types/src/`)** sin razón funcional. Reflejo de "cómo se hace en otros proyectos". El operador me obligó a justificar cada nivel y no pude.

5. **Escribí archivos en path equivocado** (`d:\proyectos\docs\` en vez de `d:\proyectos\bvcpas-project\docs\`). No verifiqué la ubicación correcta antes de escribir.

6. **Renumerada de secciones sin propagar referencias.** Cuando borré la sección 1 del template y renumeré, las referencias en otros archivos quedaron rotas. Me forzó a corregir 6 ediciones después.

7. **No detecté antes que el problema raíz era "documentación organizada por archivo, no por necesidad de quien consume".** El operador lo detectó después de varias horas. Yo debí haber preguntado antes "¿esto te está ayudando o estorbando?".

### Reglas que Claude futuro debe seguir

1. **Pregunta antes de agregar complejidad.** Cualquier cosa que no esté explícitamente pedida, se confirma.
2. **Verifica el path de los archivos antes de escribir.**
3. **Si renombras o renumeras, busca todas las referencias en el repo antes de hacerlo.**
4. **Cada vez que detectes "esto puede ser sobre-ingeniería", pregunta.**
5. **El operador es un solo individuo, no un equipo.** Diseñar para coordinación es desperdicio.
6. **El TDD cerrado estilo mapi v0.x es el patrón.** No inventar plantillas cuestionario.
7. **GPT no está en el proyecto.** Solo Claude trabaja con el operador.
8. **Cuando el operador escribe `suzy`, vuelves a modo restrictivo inmediato.**

---

## 15. Cómo usar este archivo

### Si eres Claude y acabas de abrir el repo

1. Lee este archivo COMPLETO antes de hacer nada.
2. Identifica con el operador: ¿estamos arrancando un módulo nuevo? ¿continuando uno?
3. Si arrancando, sigue el flujo de la sección 10.
4. Si continuando, abre el TDD del módulo activo y léelo completo.

### Si el operador te pide cambiar este archivo

- Solo cambias secciones específicas que él te indique.
- No reorganices, no resumas, no agregues "ya que estamos".
- Cualquier decisión nueva tomada en chat se agrega a la sección correspondiente.

### Cuándo se borra este archivo

Cuando todos los TDDs reales de los pre-requisitos (P0, P1, P2) y al menos M1 estén escritos y aprobados, el operador puede decidir borrar este archivo. La información ya estará en los TDDs y en las decisiones documentadas en cada uno.

Antes de borrarlo, verificar que toda decisión crítica ya esté en algún TDD o en `STACK.md` / `DECISIONES.md` (si los crearon).

---

## 16. Cierre

Este archivo es memoria externa, no documentación. Cuando los TDDs reales existan, este archivo se borra.

Mientras exista, es la fuente única de verdad para cualquier Claude que pierda contexto.

**Operador:** Alfredo.
**Proyecto:** bvcpas-project.
**Etapa actual:** pre-arranque de P0.
**Siguiente paso:** operador da alcance de P0, Claude escribe TDD cerrado.
