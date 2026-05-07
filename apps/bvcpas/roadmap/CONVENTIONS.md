# bvcpas — convenciones del frontend

> Frontend Next.js 15 + React 19 + Tailwind v4 + shadcn/ui que consume el
> backend `mapi` (NestJS). Una sola persona lo opera (Alfredo), pero el
> trabajo se reparte entre varios modelos de IA — por eso este documento
> existe: para que cualquiera (humano o modelo) que toque este repo siga el
> mismo orden.

**Si vas a generar código aquí, lee este archivo de cabo a rabo antes de
tocar nada.** Si una regla no encaja con tu tarea, pregunta antes de
romperla.

---

## 1. Estructura de carpetas

```
apps/bvcpas/
├── package.json            ← versión activa
├── tsconfig.json           ← path alias @/* → ./src/*
├── postcss.config.mjs      ← Tailwind v4
├── components.json         ← config shadcn/ui
├── reference/              ← prototipos HTML/CSS de Alfredo (NO se importa
│                             desde src/, solo es referencia visual)
├── roadmap/                ← carpeta por bloque/módulo (igual que mapi)
│   ├── CONVENTIONS.md      ← este archivo
│   ├── README.md           ← índice + reglas + tabla de decisiones D-bvcpas-NNN
│   ├── BACKLOG.md          ← items diferidos por trigger
│   ├── 00-foundation/      ← scaffold base (Tailwind, shadcn, alias)
│   │   ├── README.md       ← TDD vivo del bloque
│   │   └── vX.Y.Z.md       ← bitácora de cada versión
│   ├── 10-core-auth/       ← login, sesión, guard
│   ├── 11-clients/         ← (futuro) lista en sidebar, detalle
│   ├── 12-customer-support/← (futuro) tab Customer Support
│   ├── 13-dashboards/      ← (futuro) detalle de cliente
│   └── 15-app-shell/       ← AppShell (sidebar + topbar + avatar)
└── src/
    ├── app/                ← Next.js App Router — SOLO routing y layouts
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx        ← redirect a login o dashboard
    │   ├── login/
    │   └── (authenticated)/                  ← group route con guard + AppShell
    │       ├── layout.tsx
    │       └── dashboard/
    │           ├── page.tsx                  ← /dashboard sin cliente
    │           └── clients/[clientId]/
    │               ├── layout.tsx            ← tabs del cliente
    │               ├── page.tsx              ← redirect → customer-support
    │               ├── customer-support/page.tsx
    │               ├── reconciliations/page.tsx
    │               ├── w9/page.tsx
    │               ├── 1099/page.tsx
    │               ├── mgt-report/page.tsx
    │               ├── tax-packet/page.tsx
    │               ├── qtr-payroll/page.tsx
    │               └── property-tax/page.tsx
    ├── modules/            ← código de dominio (ver §2)
    │   ├── 10-core-auth/
    │   ├── 11-clients/
    │   ├── 12-customer-support/
    │   ├── 13-dashboards/
    │   └── 15-app-shell/
    ├── lib/                ← helpers cross-cutting (utils, http, format)
    │   ├── http.ts         ← fetch wrapper, JWT, dispatch 401
    │   ├── utils.ts        ← cn() para Tailwind
    │   └── README.md
    └── components/         ← componentes compartidos (no-dominio)
        ├── ui/             ← primitivos shadcn/ui
        └── shared/         ← reutilizables (EmptyState, DataTable, etc)
```

### Regla mental: ¿dónde va este archivo?

| Tipo de código                       | Ubicación                      |
| ------------------------------------ | ------------------------------ |
| Ruta / pantalla                      | `src/app/...`                  |
| Componente del dominio X             | `src/modules/NN-x/components/` |
| Llamada al backend para el dominio X | `src/modules/NN-x/api/`        |
| Hook con estado del dominio X        | `src/modules/NN-x/hooks/`      |
| Tipos del dominio X                  | `src/modules/NN-x/types.ts`    |
| Sidebar, TopBar, AvatarMenu, Guard   | `src/modules/15-app-shell/`    |
| Botón / Input / Dialog (shadcn)      | `src/components/ui/`           |
| EmptyState, DataTable genérica       | `src/components/shared/`       |
| `cn()`, formatters, http base        | `src/lib/`                     |

---

## 2. Módulos (`src/modules/NN-name/`)

- **Numeración `NN-name`**: dos dígitos + nombre kebab. Match 1:1 con la
  carpeta `roadmap/NN-name/` cuando existe TDD.
- **No saltar números** dentro de una banda salvo razón documentada.
- Cada módulo es **autocontenido**: lo que un módulo necesita y solo él
  usa, vive dentro de él. Si lo necesitan ≥2 módulos, sube a `lib/` o
  `components/shared/`.
- **README por módulo**: qué hace, qué pantallas lo consumen, qué
  endpoints del backend toca.

### Bandas de numeración

Adaptadas de mapi. Cada banda tiene un significado y deja huecos para
crecer sin renombrar.

| Banda       | Significado                                                                                | Ejemplos en bvcpas                                                      |
| ----------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `00`        | Foundation / scaffold base                                                                 | `00-foundation` (Tailwind config, shadcn init, path alias, layout root) |
| `10–14`     | Núcleo del dominio (espejea mapi cuando hay match 1:1)                                     | `10-core-auth`, `11-clients`, `12-customer-support`, `13-dashboards`    |
| `15–19`     | UI shell / cross-cutting de pantallas autenticadas (no espejea mapi porque no existe allá) | `15-app-shell` (sidebar, topbar, avatar menu, guard, group route)       |
| `20–29`     | Integraciones con terceros (cuando entren)                                                 | (vacío hoy)                                                             |
| `90–99`     | Infraestructura transversal / observabilidad                                               | (vacío hoy; futuro: `95-error-tracking` si entra Sentry)                |
| Sin prefijo | Utilidades de plataforma cross-cutting que no son dominio                                  | `lib/`, `components/ui/`, `components/shared/`                          |

**Regla de asignación de número nuevo:**

1. ¿Existe módulo con el mismo dominio en `apps/mapi/src/modules/NN-name/`?
   - Sí → frontend usa el **mismo `NN-name`** (espejo 1:1).
   - No → frontend asigna número en la banda que corresponda (15–19 si es
     UI shell, 20–29 si es integración con tercero, etc.) y lo documenta
     en el TDD del módulo (sección "Por qué este número").
2. Banda `15–19` es para frontend puro (cosas que no tienen contraparte
   backend). NO usar números de `10–14` para módulos solo-frontend; eso
   rompe el espejo cuando mapi crezca.

### Estructura interna recomendada

```
src/modules/NN-name/
├── README.md
├── api/             ← fetch wrappers tipados (un archivo por recurso)
├── components/      ← UI específica del módulo
├── hooks/           ← (opcional) hooks de estado/fetching
└── types.ts         ← (opcional) tipos compartidos
```

### Naming dentro de un módulo

- Archivos en kebab-case: `client-list.tsx`, `use-clients.ts`,
  `clients.api.ts`.
- Componentes en PascalCase: `export function ClientList()`.
- Hooks en camelCase con prefijo `use`: `useClients()`.
- API functions descriptivas: `listClients()`, `getClient(id)`,
  `updateClient(id, body)`.

---

## 3. Rutas (`src/app/`)

- **Solo routing y composición**. Una `page.tsx` arma layout + importa
  componentes de módulos. No tiene lógica de negocio ni fetch directo.
- **Group routes con paréntesis** para layouts compartidos:
  `(authenticated)/layout.tsx` envuelve todas las rutas autenticadas con
  el AppShell + guard de sesión.
- **Server Components por default**. Solo marca `'use client'` cuando
  necesites hooks, eventos o estado.

```tsx
// src/app/(authenticated)/dashboard/page.tsx — ejemplo
import { DashboardHome } from '@/modules/13-dashboards/components/dashboard-home'

export default function DashboardPage() {
  return <DashboardHome />
}
```

---

## 4. Path alias

- `@/*` → `./src/*`. Configurado en `tsconfig.json` (`baseUrl: "."`).
- Usar siempre `@/...` para imports desde `src/`. Nunca `../../../`.

```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ClientList } from '@/modules/11-clients/components/client-list'
```

---

## 5. Estilos

- **Tailwind v4** vía `@import 'tailwindcss';` en `globals.css`. No hay
  `tailwind.config.ts` — el theme se define con `@theme {...}` dentro del
  CSS.
- **shadcn/ui style: new-york**. Sus aliases internos (`bg-primary`,
  `text-foreground`, `border-input`, etc.) se mapean a los tokens
  semánticos de bvcpas en `:root` de `globals.css`. Una sola fuente de
  verdad: el día que cambia la identidad, se toca solo `globals.css`.
- **No** escribir CSS suelto en archivos `.css` aparte (excepto
  `globals.css`). Toda la UI con clases Tailwind.
- **`cn()`** (de `@/lib/utils`) para combinar clases condicionales:
  ```tsx
  <div className={cn('rounded border', isActive && 'bg-primary')} />
  ```

### Identidad visual — sistema de tokens (D-bvcpas-009)

**Regla dura:** los componentes nunca usan colores literales
(`bg-[#1a2244]`, `text-[#fff]`, `border-[#ccd1de]`). Solo:

1. **Tokens semánticos bvcpas** (definidos en `@theme` de `globals.css`):
   - Surfaces: `bg-surface-canvas`, `bg-surface-soft`, `bg-surface-muted`,
     `bg-surface-strong`, `bg-surface-hover`, `bg-surface-selected`,
     `bg-surface-lavender`, etc.
   - Borders: `border-border-default`, `border-border-strong`,
     `border-border-soft`.
   - Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`,
     `text-text-tertiary`, `text-text-disabled`, `text-text-inverse`.
   - Brand: `bg-brand-navy`, `bg-brand-navy-soft`, `bg-brand-accent`,
     `text-brand-navy`, `text-brand-accent`, etc.
   - Status: `bg-status-success`, `text-status-warning`,
     `bg-status-danger-bg` (fondos sutiles con alpha), etc.

2. **Roles shadcn** cuando se use un componente shadcn que ya los
   consume internamente (`<Button variant="default">` → `bg-primary`).
   Eso es válido porque los roles shadcn están aliaseados a los tokens
   bvcpas en `:root`.

**Para cambiar la identidad** (ejemplo: navy → azul cobalto):
edita `--color-brand-navy` en `globals.css`. Se propaga a todos los
componentes automáticamente.

### Agregar un componente shadcn

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog input label ...
```

Quedan en `src/components/ui/`. **No los edites a mano salvo ajuste de
tema** — los aliases de `:root` ya los reconvierten a la identidad
bvcpas.

---

## 6. Comunicación con el backend

- Backend dev: `https://dev.alfredo.mx` (tunnel cloudflared → localhost:4000).
- Backend prod: `https://mapi.kodapp.com.mx`.
- La URL base se lee de `NEXT_PUBLIC_API_URL` (env var pública).
- Toda llamada HTTP al backend va por **`@/lib/http.ts`** (futuro): wrapper
  con baseURL, header `Authorization: Bearer <token>`, parseo de errores
  Zod del backend.
- Cada módulo expone funciones tipadas en `api/`:

  ```ts
  // src/modules/11-clients/api/clients.api.ts
  import { http } from '@/lib/http'
  import type { Client } from '../types'

  export async function listClients(): Promise<Client[]> {
    return http.get('/v1/clients')
  }
  ```

### Tipos request/response

- Si el backend expone Zod schemas (mapi los expone vía `nestjs-zod`), los
  tipos los derivamos manualmente o vía `z.infer` si compartiéramos schemas.
  Por simplicidad, hoy tipamos a mano en `types.ts` del módulo siguiendo lo
  que documenta `apps/mapi/docs/api-routes.md`.

---

## 7. Roadmap y versiones

Estructura **por carpetas** (igual que mapi):

```
roadmap/
├── README.md                ← índice + reglas + tabla decisiones D-bvcpas-NNN
├── BACKLOG.md               ← items diferidos por trigger
├── 00-foundation/
│   ├── README.md            ← TDD vivo del bloque
│   └── vX.Y.Z.md            ← bitácora de cada versión
├── 10-core-auth/
│   ├── README.md
│   └── vX.Y.Z.md
└── ...
```

- **Una versión 🚧 a la vez en todo el app.** Excepción: hotfix urgente
  que pausa la activa.
- **Cada bloque tiene un `README.md`** (TDD vivo del módulo) y uno o
  varios `vX.Y.Z.md` (bitácora de cada versión que lo construyó).
- **Tabla cronológica de versiones** vive en `roadmap/README.md` (cada
  `vX.Y.Z.md` solo existe una vez en todo el repo, dentro de la carpeta
  del módulo principal de esa versión).
- **No bumpear `apps/bvcpas/package.json` hasta cerrar la versión.**

### Estructura del archivo `vX.Y.Z.md`

Sigue el patrón de mapi adaptado al frontend:

- **Header:** Estado / Inicio / Cierre estimado / Módulo / TDD ref.
- **Objetivo** — qué se entrega.
- **Alcance** — Sí entra / NO entra.
- **Eventos a agregar (event_log)** — frontend NO emite eventos, esta
  sección dice "Ninguno" pero NO se omite.
- **Errores de dominio nuevos** — frontend solo consume; esta sección
  lista el mapeo `code de mapi → mensaje en UI`.
- **Endpoints API nuevos** — frontend NO expone; esta sección lista los
  endpoints de mapi que la versión consume.
- **Flujo** — narrativa paso a paso.
- **Pre-requisitos** — qué debe estar listo antes de arrancar.
- **TODOs (orden TDD-first, secuencial)** — bloques con commits
  granulares.
- **Decisiones tomadas durante esta versión** — `D-bvcpas-NNN` con
  Diverge TDD / Razón / Consecuencia.
- **Fixes durante desarrollo** — mini-correcciones cosméticas.
- **Smoke test del módulo** — checklist manual de cierre.
- **Notas operativas** — cosas que el operador hace fuera del código.

### Mensajes de commit

- Setup/refactor sin cambio de feature: `chore(bvcpas): ...`
- Feature nueva: `feat(bvcpas): <descripción>`
- Test: `test(bvcpas): ...` (cuando exista infra de testing)
- Documentación: `docs(bvcpas): ...`
- Cierre de versión: `release(bvcpas): vX.Y.Z — <título>`
- Bug fix puntual: `fix(bvcpas): ...`

### Branches y tags git (D-bvcpas-019)

Convención unificada con mapi:

- **Branch por módulo:** `<app>/<NN-modulo>` (sin versión en el nombre).
  - `bvcpas/15-app-shell`, `bvcpas/11-clients`, `mapi/21-microsoft-oauth`.
  - Si el módulo se trabaja en varias versiones, el branch se **reusa**.
  - Slash (`/`) válido en Git; GitHub lo agrupa visualmente como
    namespace.
- **Tag por versión:** `<app>-vX.Y.Z` (con guión).
  - `bvcpas-v0.3.0`, `mapi-v0.7.0`.
  - No colisiona con branches (slash vs guión).

### Flujo de trabajo por versión

```bash
# Abrir versión
git checkout main && git pull
git checkout -b <app>/<NN-modulo>

# Trabajar (commits granulares por bloque del TDD)
# ...

# Push remoto (primera vez, backup)
git push -u origin <app>/<NN-modulo>

# Cerrar versión
git checkout main && git pull
git merge --no-ff <app>/<NN-modulo>
git tag <app>-vX.Y.Z
git push origin main && git push origin <tag>
git branch -d <app>/<NN-modulo>
git push origin --delete <app>/<NN-modulo>
```

`--no-ff` preserva la historia del feature como un sub-grafo en main.

### Reglas duras

1. **Solo una versión 🚧 a la vez.**
2. **No bumpear `package.json` hasta cerrar.**
3. **No mezclar features y fixes mayores en la misma versión.**
4. **El TDD manda salvo decisión documentada como `D-bvcpas-NNN`.**
5. **Branches `<app>/<NN-modulo>`, tags `<app>-vX.Y.Z`.**
6. **Cada commit toca un solo app** y solo cosas relacionadas con la
   versión activa. No mezclar fixes "de paso" en otros apps.
7. **El frontend solo consume mapi, no emite eventos ni errores propios.**
   Las secciones de event_log y errores de dominio en cada `vX.Y.Z.md`
   se llenan con "Ninguno" + tabla de mapeo, pero no se omiten.
8. **Trabajar siempre en branch del módulo, nunca commits directos a
   main.** Excepción: hotfix urgente sigue su propio flujo (ver §7
   "Cómo manejar fixes" y abrir branch igual).
9. **Naming de campos: snake_case 1:1 con el backend** (D-bvcpas-020).
   Los `types.ts` y `*.api.ts` del frontend reflejan exactamente las
   keys del response de mapi (que serializa en snake_case). No hay
   adapters ni renames camelCase. JSX consume `client.legal_name`,
   `client.qbo_realm_id`, `stats.uncats_count`. Excepciones legacy
   (`accessToken`, `fullName` en auth) se mantienen porque ese
   endpoint específico de mapi sí devuelve camelCase.

---

## 8. TDD primero, código después

- Antes de escribir el código de una feature, escribir/actualizar el TDD
  en `roadmap/v0.X.Y-...md` y validar con Alfredo.
- Si los supuestos cambiaron (backend cambió, datos reales sorprenden),
  **cuestionar el TDD antes de implementar** — no codear sobre suposiciones
  obsoletas.

---

## 9. Lo que NO se hace en este repo

- ❌ `git stash` / `git stash pop` — prohibido global.
- ❌ Editar archivos en `reference/` — son prototipos HTML de Alfredo,
  solo referencia visual.
- ❌ Lógica de negocio en `src/app/page.tsx` — siempre delegar a un módulo.
- ❌ CSS suelto fuera de `globals.css` — Tailwind para todo.
- ❌ Importar con paths relativos largos (`../../../`) — usar `@/...`.
- ❌ Mezclar el sistema de módulos numerados con carpetas planas
  (`features/`, `pages/`, etc).
- ❌ Levantar `npm run dev` en background desde el asistente — Alfredo
  corre el dev server.

---

## 10. Setup local rápido

```bash
cd apps/bvcpas
npm install
npm run dev          # Next dev en :3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # validar antes de commit
```

Variables de entorno (`.env.local`, no commiteado):

```
NEXT_PUBLIC_API_URL=https://dev.alfredo.mx
```

---

## 11. Cuando arranques en este repo (checklist mental)

1. Lee este archivo.
2. Lee `roadmap/README.md` para saber qué versión está 🚧 + revisa la
   tabla de decisiones acumuladas `D-bvcpas-NNN`.
3. Lee `roadmap/<NN-modulo>/README.md` (TDD vivo del módulo activo).
4. Lee `roadmap/<NN-modulo>/vX.Y.Z.md` (versión 🚧, si hay).
5. Lee el `README.md` del módulo en `src/modules/<NN-modulo>/` (si ya
   existe).
6. Si vas a crear módulo nuevo:
   - Verifica si ya existe contraparte en `apps/mapi/src/modules/`. Si
     sí, espejea el `NN-name`. Si no, asigna número en la banda
     correcta (ver §2 "Bandas de numeración").
   - Crea `roadmap/<NN-modulo>/README.md` antes de cualquier otro
     archivo.
   - Crea `src/modules/<NN-modulo>/README.md` cuando arranques a codear.
7. Si tu cambio rompe alguna convención de aquí: pregunta antes.

---

## 12. Testing

**Stack:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + JSDOM. Sin Jest, sin Playwright (por ahora), sin MSW.

**Política TDD-first** (desde v0.3.0):

- **Antes de codear** una pieza nueva, escribe el test que la describe.
  El test arranca en rojo. Lo discutimos. Se vuelve verde solo cuando
  la implementación cumple lo que el test exige.
- **v0.2.1 fue excepción retroactiva:** los tests se escribieron sobre
  código de v0.2.0 que ya existía. A partir de v0.3.0 ya no.

**Estructura:**

- Archivos `*.test.ts` y `*.test.tsx` **al lado del código** que prueban,
  no en una carpeta `test/` separada. Convención de Vitest, reduce
  fricción al moverte entre código y test.
- Setup global vive en `apps/bvcpas/test/setup.ts`.
- Configuración en `apps/bvcpas/vitest.config.mts` (`.mts` por
  compatibilidad ESM con `vite-tsconfig-paths`).

**Comandos:**

```bash
cd apps/bvcpas
npm run test          # corre toda la suite una vez
npm run test:watch    # watch mode (deja en terminal aparte)
npm run test src/lib/http.test.ts            # un archivo
npm run test -- -t "INVALID_CREDENTIALS"     # filtrar por nombre
```

**Pre-commit:** los tests **NO entran al pre-commit hook** (solo
prettier + eslint + typecheck). Razón: añadir tests al hook lo vuelve
lento (~5–15s) y termina en `--no-verify`. El pre-commit atrapa errores
mecánicos; los tests verifican comportamiento — están un nivel después.

**Trigger para revisar política:** cuando exista CI, evaluar pre-push
hook con tests como middle ground antes de mover suite obligatoria a CI.

**Qué NO se testea:**

- Componentes shadcn primitivos (`button`, `input`, etc.) — los provee
  shadcn ya testeados upstream.
- `globals.css` / Tailwind — no es código.
- Tests cosméticos (toggles, animaciones) si el comportamiento ya está
  cubierto por tests de flujo.

Ver [`roadmap/10-core-auth/v0.2.1.md`](10-core-auth/v0.2.1.md) para el
patrón concreto de mocks (vi.fn / vi.mock / vi.stubGlobal /
vi.stubEnv).
