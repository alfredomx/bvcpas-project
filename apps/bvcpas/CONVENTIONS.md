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
├── CONVENTIONS.md          ← este archivo
├── package.json            ← v0.1.0
├── tsconfig.json           ← path alias @/* → ./src/*
├── postcss.config.mjs      ← Tailwind v4
├── components.json         ← config shadcn/ui
├── reference/              ← prototipos HTML/CSS de Alfredo (NO se importa
│                             desde src/, solo es referencia visual)
├── roadmap/
│   ├── README.md           ← qué es el roadmap, cómo funciona, versión activa
│   └── v0.X.Y-nombre.md    ← un TDD por versión
└── src/
    ├── app/                ← Next.js App Router — SOLO routing y layouts
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx        ← redirect a login o dashboard
    │   ├── login/
    │   └── (authenticated)/      ← group route con guard + AppShell
    │       ├── layout.tsx
    │       └── dashboard/
    ├── modules/            ← código de dominio (ver src/modules/README.md)
    │   ├── 10-auth/
    │   ├── 11-clients/
    │   ├── 12-customer-support/
    │   └── 13-dashboards/
    ├── lib/                ← helpers cross-cutting (utils, http, format)
    │   ├── utils.ts        ← cn() para Tailwind
    │   └── README.md
    └── components/         ← componentes compartidos (no-dominio)
        ├── ui/             ← primitivos shadcn/ui
        ├── layout/         ← Sidebar, TopBar, AppShell
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
| Botón / Input / Dialog (shadcn)      | `src/components/ui/`           |
| Sidebar, TopBar, AppShell            | `src/components/layout/`       |
| EmptyState, DataTable genérica       | `src/components/shared/`       |
| `cn()`, formatters, http base, auth  | `src/lib/`                     |

---

## 2. Módulos (`src/modules/NN-name/`)

- **Numeración `NN-name`**: dos dígitos + nombre kebab. Mismo patrón que
  backend, pero los nombres se eligen por lo que tiene sentido en frontend.
  No es mapeo 1:1 con backend.
- **No saltar números** salvo que haya razón (igual que backend mapi).
- Cada módulo es **autocontenido**: lo que un módulo necesita y solo él usa,
  vive dentro de él. Si lo necesitan ≥2 módulos, sube a `lib/` o
  `components/shared/`.
- **README por módulo**: qué hace, qué pantallas lo consumen, qué endpoints
  del backend toca.

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
- **shadcn/ui style: new-york**, base color slate, CSS variables HSL.
- **No** escribir CSS suelto en archivos `.css` aparte (excepto
  `globals.css`). Toda la UI con clases Tailwind.
- **`cn()`** (de `@/lib/utils`) para combinar clases condicionales:
  ```tsx
  <div className={cn('rounded border', isActive && 'bg-primary')} />
  ```

### Agregar un componente shadcn

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog input label ...
```

Quedan en `src/components/ui/`. No los edites a mano salvo ajuste de tema.

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

- **Una versión a la vez activa**. Mientras `v0.X.Y` está 🚧, no se
  arranca otra.
- **Cada versión tiene un TDD** en `roadmap/v0.X.Y-nombre.md`. Estructura:
  - **Objetivo** — qué se entrega
  - **Alcance** — qué SÍ y qué NO
  - **Flujo** — narrativa paso-a-paso de la pantalla / feature
  - **Decisiones operativas** — alternativas consideradas y por qué se eligió X
  - **Cambios en archivos** — lista concreta de archivos a crear/editar
  - **Tests / validación manual** — cómo se verifica
  - **Diferidos** — items que se mueven a `roadmap/BACKLOG.md`
- **Un commit ≈ un TDD**. Mensajes:
  - Setup/refactor sin cambio de feature: `chore(bvcpas): ...`
  - Feature nueva: `feat(bvcpas): v0.X.Y - <título>`
  - Bug fix puntual: `fix(bvcpas): ...`
- **No mezclar cambios de mapi y bvcpas en un mismo commit**. Cada app
  tiene su propio versionado.

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
2. Lee `roadmap/README.md` para saber qué versión está activa.
3. Lee el TDD de la versión activa.
4. Lee el `README.md` del módulo en el que vas a trabajar.
5. Si vas a crear módulo nuevo: numéralo con el siguiente NN libre y crea
   su `README.md` antes de cualquier otro archivo.
6. Si tu cambio rompe alguna convención de aquí: pregunta antes.
