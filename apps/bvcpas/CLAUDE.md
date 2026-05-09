# Frontend BV CPAs — contexto para sesión nueva

## Quién soy yo (Alfredo)

- Mexicano, español latino. Hablar "tú/tienes/quieres", nunca "vos/peninsular".
- Trabajo solo en este proyecto. No hay equipo.
- Soy el desarrollador y el dueño del producto BV CPAs.
- Pierdo paciencia cuando el modelo adivina o reescribe sin entender. Antes de codear, **investigar/preguntar**.

## Reglas duras de comportamiento

1. **Antes de tocar cualquier archivo: leer los datos primero, mostrar lo que encontraste, esperar confirmación.**
2. Si no tengo certeza, **preguntar** — no adivinar ni "probar a ver qué pasa".
3. **No escribir listas, explicaciones, ni resúmenes que no fueron pedidos.**
4. Si el usuario me corrige, "tienes razón, me equivoqué" sin reformular para parecer correcto.
5. **No creer ciegamente** lo que diga la documentación si los datos reales lo contradicen.
6. Cuestionar el TDD/plan cuando la realidad cambió desde que se escribió.
7. Probar cada paso manualmente — no solo con tests automáticos.
8. **Nunca `git stash` / `git stash pop`** — destruye trabajo en progreso.
9. **Nunca `git add -A` o `git add .` sin revisar `git status` primero.**

## El proyecto

**Monorepo `bvcpas-project`** con 3 apps:
- `apps/mapi` — backend NestJS (NO se toca desde este worktree clonado para frontend).
- `apps/bvcpas` — frontend Next.js (este).
- `apps/kiro` — plugin Chrome para QBO Desktop bridge (NO se toca acá).

**Esta carpeta `d:\proyectos\bvcpas-frontend\` es CLONE separado** del monorepo original (`d:\proyectos\bvcpas-project\`). Razón: el otro modelo trabaja backend en la copia original; este modelo trabaja frontend acá. Cada uno commite independiente y se sincroniza vía GitHub (`git push` / `git pull`).

**Acuerdo de scope:** este modelo SOLO toca `apps/bvcpas/`. Si por accidente edita algo de `apps/mapi/` o `apps/kiro/`, se descarta el cambio.

## Stack del frontend (apps/bvcpas)

- **Framework**: Next 15 (App Router).
- **UI**: shadcn-ui (radix-ui primitives) + Tailwind.
- **Data fetching**: TanStack Query.
- **Forms**: react-hook-form + zod.
- **Tests**: Vitest + Testing Library.
- **Icons**: lucide-react.
- **Notifs**: sonner (toasts).

## Estado del backend (mapi) — features cerradas

Cada feature tiene endpoints reales que el frontend puede consumir hoy:

| Versión | Feature | Endpoints clave |
|---|---|---|
| v0.2.0 | Auth + sesiones | `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/auth/me` |
| v0.4.0 + v0.5.0 + v0.8.0 | Clients CRUD | `GET /v1/clients`, `GET /v1/clients/:id`, `PATCH /v1/clients/:id`, `POST /v1/clients/:id/status` |
| v0.6.0 | Customer Support | `GET /v1/clients/:id/transactions`, `/transactions/responses`, `/followups/:period`, `/public-links` |
| v0.6.1 + v0.8.0 | Vistas dashboard | `GET /v1/views/uncats`, `GET /v1/clients/:id/uncats` |
| v0.7.0 + v0.8.0 + v0.9.0 + v0.12.0 | Connections OAuth | `POST /v1/{microsoft,intuit,dropbox,google,square}/oauth/connect`, callbacks `@Public`, `GET /v1/connections` |
| v0.10.0 | Sharing conexiones | `POST /v1/connections/:id/share`, `PATCH/DELETE /share/:userId`, `GET /shared` |
| v0.11.0 | Connections api-key | `POST /v1/connections/api-key`, `PATCH /v1/connections/:id/api-key`, `GET /v1/clients/:id/merchants/clover/:merchantId/reports` |
| v0.12.0 | Square reports | `GET /v1/clients/:id/merchants/square/:locationId/reports` (placeholder) |
| dev-shortcuts | Atajos OAuth dev | `GET /v1/_dev/oauth/{intuit,microsoft,dropbox,google,square}` (302 redirect, solo NODE_ENV=local) |

**Detalles operacionales clave del backend:**

- **Forma C de URLs (D-mapi-019)**: sub-recursos del cliente bajo `/v1/clients/:id/<recurso>`. Vistas globales bajo `/v1/views/`. Merchants bajo `/v1/clients/:id/merchants/<provider>/`.
- **Connections**: cada conexión tiene `accessRole: 'owner' | 'shared-read' | 'shared-write'` (derivado por user que consulta) y `authType: 'oauth' | 'api_key'`. Frontend debe distinguirlos.
- **Errores estandarizados**: response JSON `{statusCode, code, message}`. Mapear `code` → mensaje user-friendly en frontend, no usar `message` literal.
- **Auth**: JWT en `Authorization: Bearer`. El `.env` de `apps/mapi/` tiene `ADMIN_JWT_SECRET` con un JWT pre-generado para admin (sirve para curl rápido en dev).
- **mapi corre en**: `https://dev.alfredo.mx` (tunnel cloudflared a localhost:4000) o `http://localhost:4000` directo.
- **6 clientes en DB local** (Arcmen, etc.). Producción tiene 77 (no relevante para dev frontend).

## Stack/Backend resumido para frontend

- **Provider OAuth**: Microsoft (mail), Intuit (QBO), Dropbox (storage), Google (Drive), Square (POS).
- **Provider api-key**: Clover (token manual por merchant).
- **Sharing**: read/write granular por user. El owner ve siempre, los shared ven en `GET /v1/connections` con `accessRole='shared-*'`.
- **Multi-tenant Intuit**: una conexión = un realm/QBO entity. Un cliente BV CPAs puede tener N entidades QBO (ej. los 3 entities × 2 restaurants = 6 merchants Clover).

## Convenciones de código

- **Páginas no fetchean**: solo consumen hooks (TanStack Query).
- **Hooks**: `features/<feature>/use-*.ts` — solo data, sin presentación.
- **Vistas**: `features/<feature>/components/` — reciben `data` por props.
- **SDK auto-generado** desde `https://dev.alfredo.mx/v1/docs-json` (Scalar OpenAPI). Ver si hay script `npm run sdk:gen` o equivalente.
- **Loading/empty/error states obligatorios** en cada pantalla.
- **No diseño custom mientras iteramos** — solo Tailwind defaults + shadcn primitives sin modificar. El diseño bonito viene después.

## Decisión actual sobre el frontend

**El usuario armó pantallas con diseño elaborado. Eso lo bloqueó cuando intentaba iterar features**. Estrategia ahora: **simplificar pantallas existentes** sin tirar el stack base (login + layout + providers funcionan bien — solo cambia presentación de pantallas concretas).

**Reglas para la simplificación:**
- NO borrar todo. Solo reescribir pantallas que estaban frenando iteración.
- Conservar: stack, layout `(authenticated)`, login funcional, lib/auth, lib/api-client, tests existentes que pasen.
- Reescribir: pantallas con diseño custom que retrasaba.
- Cada pantalla simplificada: branch `frontend/simplify-<pantalla>` → commit → merge a `frontend/cleanup` → eventualmente PR a main.

## Backlog de pantallas (priorizado)

1. **Listado de clientes** (`/clients`) — `GET /v1/clients` con paginación, filtros (status, tier, search). Click → detalle.
2. **Detalle de cliente** (`/clients/:id`) — info + tabs: General, Transactions, Connections (OAuth + api-key), Followups, Uncats.
3. **Connections del cliente** (tab dentro de detalle): listar `GET /v1/connections?clientId=<id>`. Acciones: conectar nuevo (Intuit/Microsoft/Dropbox/Google/Square con dev-shortcut), agregar api-key (Clover), compartir, borrar.
4. **Dashboard customer support** (`/dashboard`) — `GET /v1/views/uncats`. Lista master de clientes con uncats pendientes.
5. **Vista cliente uncats** — drill-down en `GET /v1/clients/:id/uncats`.

(Cada pantalla tiene roadmap propio en `apps/bvcpas/roadmap/`.)

## Standby — NO frontend de esto todavía

- Reportes Clover/Square (`/v1/clients/:id/merchants/.../reports`) — backend devuelve `{message:'ok'}`, no hay datos reales aún.
- Plugin-bridge (Toast, DoorDash) — backend no implementado.
- Connectores de banco — backend no implementado.
- Gemini/IA — fuera de scope inmediato.

## Onboarding rápido para sesión nueva

```
Trabajo frontend en d:\proyectos\bvcpas-frontend\apps\bvcpas\.

Lee en orden ANTES de proponer cambios:
1. Este CLAUDE.md (contexto del proyecto + reglas mías).
2. apps/bvcpas/roadmap/README.md (estado del frontend).
3. apps/bvcpas/roadmap/CONVENTIONS.md (reglas de código).
4. Si voy a tocar un módulo (10-core-auth, 11-clients, etc.) → su roadmap específico.

Mi siguiente tarea es: [describir].
```

## Cómo NO trabajar conmigo

- No me preguntes 5 cosas si solo necesito 1 respuesta. Pregunta concreta, sigue.
- No reescribas funciones que no estaban rotas.
- No me digas "voy a hacer X, Y, Z" antes de hacer X. Solo haz X y muéstrame.
- No agregues "tras tu confirmación procedo" después de cada paso. Si la decisión es trivial, procede.
- No metas comentarios como `// added by Claude` o `// agregado para X`. Limpio.

## Cómo SÍ trabajar conmigo

- **Antes de tocar archivos no triviales: lee, muestra lo que encontraste, espera confirmación**.
- Si propones algo nuevo, **una sola opción + el por qué**. No 3 alternativas si tú ya sabes cuál es la correcta.
- Si la doc oficial contradice lo que ves en datos reales, **investiga la doc en serio** — no asumas.
- Cuando termines un cambio, **valida manualmente** (curl, navegador, lo que aplique). Tests automáticos no son suficiente.
- **Reconocer cuando me equivoqué** — sin reformular para parecer correcto.

## Tunnel dev

- mapi local → tunnel cloudflared → `https://dev.alfredo.mx`. Todos los OAuth callbacks usan ese dominio.
- Si el tunnel falla, alternativa: apuntar `NEXT_PUBLIC_API_URL` a `http://localhost:4000` (sin HTTPS).

## Saber para qué sirve cada cosa

- `apps/bvcpas/CONVENTIONS.md` — reglas de código frontend (probablemente ya existe).
- `apps/bvcpas/roadmap/<NN-modulo>/` — TDD vivo de cada feature.
- `apps/bvcpas/roadmap/BACKLOG.md` — items diferidos.
- `apps/bvcpas/components.json` — config de shadcn-ui.

---

## Para retomar — comandos rápidos

```powershell
cd d:\proyectos\bvcpas-frontend\apps\bvcpas

# correr frontend
npm run dev

# correr tests
npm test

# regenerar SDK (si el script existe — ver package.json scripts)
# npm run sdk:gen
```

mapi DEBE estar corriendo en otra terminal/carpeta para que el frontend tenga API.
