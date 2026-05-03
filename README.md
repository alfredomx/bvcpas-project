# bvcpas-project

Sistema operativo del bookkeeper. Reemplaza progresivamente los Google Sheets internos del operador para manejar 40-80 clientes sin duplicar horas.

**Estado:** En construcción. Etapa 1 (módulos M1-M7) en desarrollo.

---

## Arquitectura

3 apps independientes (sin npm workspaces):

```
apps/
├── mapi/      Backend NestJS (REST + WebSocket gateway)
├── bvcpas/    Frontend Next.js (dashboards)
└── kiro/      Chrome extension (ejecutor en QBO)
```

**El plugin habla solo con el backend. Frontend lee solo del backend. Backend es la única fuente de verdad.**

Detalle completo en `docs/_CONTEXTO_TEMPORAL.md`.

---

## Cómo arrancar local

### Pre-requisitos

- Node.js 22 LTS.
- Docker + Docker Compose.
- Git.

### Setup inicial

```bash
# 1. Clonar
git clone git@github.com:alfredomx/bvcpas-project.git
cd bvcpas-project

# 2. Instalar husky + lint-staged en raíz
npm install

# 3. Levantar infra local (Postgres + Redis)
docker compose -f docker-compose.local.yml up -d

# 4. Instalar deps de cada app (cuando existan)
cd apps/mapi && npm install && cd ../..
cd apps/bvcpas && npm install && cd ../..
cd apps/kiro && npm install && cd ../..

# 5. Configurar env vars
cp .env.example apps/mapi/.env
cp .env.test.example apps/mapi/.env.test
# Editar apps/mapi/.env con valores reales (Intuit, encryption key, etc.)
```

### Arrancar backend en local

```bash
cd apps/mapi
npm run db:migrate    # aplicar migrations
npm run start:dev     # levanta en http://localhost:4000
```

URLs locales:

- API: `http://localhost:4000/v1`
- Health: `http://localhost:4000/v1/healthz`
- Métricas: `http://localhost:4000/metrics`
- Docs OpenAPI: `http://localhost:4000/v1/docs`

### Arrancar frontend en local

```bash
cd apps/bvcpas
npm run dev    # levanta en http://localhost:3000
```

### Build del plugin

```bash
cd apps/kiro
npm run build    # genera dist/
# Cargar dist/ en Chrome via chrome://extensions/ → Load unpacked
```

---

## Convenciones del repo

- **Cada app es independiente:** su propio `package.json`, `node_modules/`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`.
- **Pre-commit hook único en raíz** (`.husky/pre-commit`) corre prettier + eslint + tsc en archivos staged. NUNCA usar `git commit --no-verify`.
- **3 entornos:** `local | test | production`. Cada uno con su DB y Redis separados.
- **NODE_ENV** usa `local` (no `development`) para evitar ambigüedad con frameworks JS.

---

## Documentación

- `docs/INDICE.md` — estado vivo de módulos.
- `docs/_CONTEXTO_TEMPORAL.md` — contexto general del proyecto (decisiones, arquitectura, naming).
- `docs/modulos/` — TDD de cada módulo conforme se trabaja.

---

## Repo

- **Path local:** `d:\proyectos\bvcpas-project\`.
- **GitHub:** `git@github.com:alfredomx/bvcpas-project.git`.
