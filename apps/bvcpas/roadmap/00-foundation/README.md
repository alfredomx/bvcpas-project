# 00-foundation — Bootstrap del frontend Next.js

**App:** bvcpas
**Status:** ✅ Completo
**Versiones que lo construyen:** [v0.1.0](v0.1.0.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este módulo

`00-foundation` es la base del frontend `bvcpas`. No resuelve un problema del operador directamente — establece el scaffold mínimo de Next.js 15 + React 19 sobre el que se construyen los dashboards de los módulos M1-M7 (los 7 Google Sheets que el operador quiere reemplazar). Sin este scaffold, no hay dónde montar la primera UI.

Decisión consciente: arrancar **sin** Tailwind, shadcn/ui ni librerías de UI. El stack visual se decide cuando un módulo concreto lo pida (probablemente M1 — Dashboard Administrator). Comprometerse al stack visual antes de tener un dashboard real lleva a refactor caro.

Lo que cambia con `00-foundation` listo:

- Hay un `bvcpas` que compila con Next.js 15 + React 19 y sirve `/` con HTTP 200.
- El pre-commit hook bloquea código con type errors, lint errors o formato prettier inválido.
- La carpeta `apps/bvcpas/` está integrada al tooling cross-app del repo (el orquestador `scripts/run-in-apps.mjs` la corre junto con mapi y kiro).

---

## Alcance

### Sí entra

- Scaffold Next.js 15 + React 19 (`apps/bvcpas/`) sin librerías de UI.
- `package.json` con next, react, react-dom, eslint 9 con `eslint-config-next`. Scripts `dev | build | start | lint | typecheck | format`.
- `tsconfig.json` con paths `@/*`, jsx preserve, lib dom + esnext, plugin `next`.
- `next.config.mjs` con `reactStrictMode: true`.
- `eslint.config.mjs` flat config v9 con `FlatCompat` para extends de `next/core-web-vitals` y `next/typescript`.
- `src/app/{layout.tsx, page.tsx, globals.css}` mínimos.
- `.env.example` con `NEXT_PUBLIC_API_URL` placeholder.
- `.prettierignore` excluye `next-env.d.ts`.
- `.gitignore` raíz extiende para excluir `apps/*/next-env.d.ts`.
- Rename `apps/web` → `apps/bvcpas` (carpeta + package name + referencias en raíz).

### NO entra

- Tailwind CSS, shadcn/ui u otras libs de UI.
- Páginas reales (login, dashboards, etc.) — entran con cada módulo M1-M7.
- AuthClient o JWT handling — entra cuando mapi tenga AuthModule funcional.
- Conexión real al backend (sin fetch a `/v1/*`).
- Deploy a Coolify — `00-foundation` no se deploya. La primera versión que se deploya será cuando entre la primera UI funcional (`bvcpas.kodapp.com.mx` candidato como subdominio).
- i18n / dark mode / theming.
- Tests automatizados (sin Jest/Vitest configurado).

---

## Naming visible al operador

Únicamente el copy estático del scaffold (`Hello bvcpas`, `Frontend scaffold inicial. Stack visual TBD.`). No requiere aprobación NAM-1 — es placeholder que desaparece cuando entre la primera UI real. Cualquier copy futuro (botones, labels, mensajes de error visibles, headers de tablas) sí pasa por NAM-1 en el módulo correspondiente.

---

## Diseño técnico

### Páginas / rutas

| Ruta | Renderiza                                                            | Notas                                          |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `/`  | `src/app/page.tsx` con `<h1>Hello bvcpas</h1>` y párrafo placeholder | Sin componentes reutilizables ni datos remotos |

### Endpoints de mapi consumidos

Ninguno. v0.1.0 es scaffold puro. La env var `NEXT_PUBLIC_API_URL` está como placeholder para cuando entre AuthClient.

### Errores de UX manejados

Ninguno. Sin lógica de negocio que pueda fallar.

### Configuración / env vars

| Variable            | Tipo | Required    | Default | Notas                                      |
| ------------------- | ---- | ----------- | ------- | ------------------------------------------ |
| NEXT_PUBLIC_API_URL | URL  | No (v0.1.0) | —       | Placeholder; se usará en futuro AuthClient |

Cuando entre AuthClient real se promueve a required y se valida.

### Dependencias externas

Ninguna en runtime. Build/test:

- **next 15** + **react 19** + **react-dom 19**.
- **eslint 9** + **eslint-config-next 15**.
- **typescript 5.7+**.

---

## Decisiones tomadas

Las 3 decisiones están en [v0.1.0.md](v0.1.0.md) y en el índice del [`README.md` raíz del roadmap](../README.md).

- D-bvcpas-001 — Sin Tailwind/shadcn en v0.1.0 (stack visual TBD hasta primer dashboard).
- D-bvcpas-002 — App renombrado de `web` a `bvcpas` (carpeta y package name).
- D-bvcpas-003 — `next-env.d.ts` gitignored y prettier-ignored (autogenerado por Next).

---

## Tareas

Todas cerradas en v0.1.0. Ver [v0.1.0.md](v0.1.0.md) para detalle.

- [x] Estructura `apps/bvcpas/src/app/`.
- [x] `package.json` con Next 15 + React 19 + scripts.
- [x] `tsconfig.json` + `next.config.mjs` + `eslint.config.mjs`.
- [x] `src/app/{layout.tsx, page.tsx, globals.css}` mínimos.
- [x] `.env.example` con `NEXT_PUBLIC_API_URL`.
- [x] `.prettierignore` y `.gitignore` raíz extendido para `next-env.d.ts`.
- [x] Validar `npm run typecheck` + `build` + `start` sirviendo `/` HTTP 200.
- [x] Rename `apps/web` → `apps/bvcpas` con referencias actualizadas en raíz.

---

## Migración de datos

Ninguna. No hay frontend previo desde el cual migrar.

---

## Smoke test del módulo

Todos pasados al cierre de v0.1.0:

- [x] `cd apps/bvcpas && npm run typecheck` OK.
- [x] `npm run build` genera `.next/` sin errores.
- [x] `npm run start` sirve `/` con HTTP 200 y markup esperado (`<h1>Hello bvcpas</h1>`).
- [x] `npm run lint` desde raíz orquesta bvcpas también y pasa.
- [x] Pre-commit hook bloquea código con type error, lint error o formato prettier inválido en `apps/bvcpas/src/`.

---

## Notas

- **No deployed todavía.** v0.1.0 sólo existe en local + repo. Cuando entre la primera UI funcional (probablemente nuevo módulo `1x-` o `2x-`), se decide subdominio en Coolify.
- **Stack visual TBD.** Cuando llegue el primer módulo UI, ese momento es el cierre de la decisión Tailwind/shadcn/etc. — anotar como `D-bvcpas-NNN` en su versión.
- Numeración de módulos en `bvcpas` arrancará con un dominio funcional (probablemente `1x-auth-client` cuando entre AuthClient, o `2x-dashboards` para los M1-M7). Los huecos quedan grandes mientras el frontend tenga pocos módulos — eso está bien.
