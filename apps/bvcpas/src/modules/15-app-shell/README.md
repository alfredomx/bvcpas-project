# 15-app-shell (frontend)

Shell visual de la aplicación autenticada: sidebar + topbar + tabs por
cliente + estado persistido (collapse, última tab por cliente).

**No espejea mapi** — es un módulo solo-frontend (banda 15–19, ver
[CONVENTIONS.md §2](../../../roadmap/CONVENTIONS.md#bandas-de-numeración)).

## Estado en v0.3.0

**Scaffolding inicial.** En este bloque (Bloque 2 del TDD) solo se
crean:

- Este README.
- `lib/tabs.ts` — single source of truth de los 8 tabs por cliente.

Los componentes (`<AppShell>`, `<Sidebar>`, `<SidebarRow>`, `<Topbar>`,
`<AvatarMenu>`, `<ClientTabs>`) y hooks (`useSidebarCollapsed`,
`useLastTab`) entran en bloques posteriores de v0.3.0 con tests
TDD-first.

## Qué expone (planeado para v0.3.0)

| Símbolo                                     | Para qué                                                  |
| ------------------------------------------- | --------------------------------------------------------- |
| `<AppShell>`                                | Orquesta sidebar + topbar + main.                         |
| `<Sidebar>`                                 | Lista de clientes con search, filtro "All", virtual list. |
| `<SidebarRow>`                              | Fila visual de un cliente.                                |
| `<SidebarCollapsed>`                        | Versión angosta cuando está colapsada.                    |
| `<Topbar>`                                  | Nombre del user + avatar.                                 |
| `<AvatarMenu>`                              | Dropdown con "Change profile" + "Logout".                 |
| `<ClientTabs>`                              | Barra horizontal con 8 tabs.                              |
| `useSidebarCollapsed()`                     | Bool persistido en localStorage.                          |
| `useLastTab()`                              | Recuerda última tab visitada por cliente.                 |
| `TABS`, `DEFAULT_TAB_SLUG`, `findTabBySlug` | Definición de los 8 tabs (`lib/tabs.ts`).                 |

## Pantallas que lo consumen

- `(authenticated)/layout.tsx` → `<AppShell>` para envolver todas las
  rutas autenticadas.
- `(authenticated)/dashboard/clients/[clientId]/layout.tsx` →
  `<ClientTabs>` para pintar la barra de tabs del cliente.

## Decisiones relevantes

- **D-bvcpas-015** — Sidebar consume
  `GET /v1/dashboards/customer-support` (no `GET /v1/clients`) porque
  ese endpoint trae los stats agregados que la UI necesita.
- **D-bvcpas-016** — Virtualización con `@tanstack/react-virtual`
  desde día 1 aunque haya <100 clientes.
- **D-bvcpas-017** — `/dashboard` muestra empty state, NO auto-select.
- **D-bvcpas-018** — Customer Support tab también es placeholder en
  v0.3.0; la pantalla real entra en v0.4.0.

## localStorage keys

| Key                                 | Tipo   | Para qué                                    |
| ----------------------------------- | ------ | ------------------------------------------- |
| `bvcpas.sidebarCollapsed`           | bool   | Estado collapse de la sidebar.              |
| `bvcpas.lastTabByClient.<clientId>` | string | Slug de la última tab visitada por cliente. |

## Versiones

- v0.3.0 (🚧) — primera implementación. Scaffolding + componentes
  visuales + tabs con placeholders. Ver
  [`roadmap/15-app-shell/v0.3.0.md`](../../../roadmap/15-app-shell/v0.3.0.md).
