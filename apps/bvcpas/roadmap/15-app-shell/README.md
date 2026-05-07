# 15-app-shell — Sidebar + topbar + avatar (UI shell autenticada)

**App:** bvcpas
**Status:** ✅ Primera versión cerrada (puede reabrirse para variantes
visuales o feature extra)
**Versiones que lo construyen:** [v0.3.0](v0.3.0.md) (AppShell visual

- sidebar funcional + tabs cliente + 8 placeholders + diseño 1:1 con
  prototipo)
  **Última revisión:** 2026-05-06
  **Espejo backend:** ninguno — este módulo es puro frontend, no tiene
  contraparte en mapi.

---

## Por qué existe este módulo

Toda pantalla autenticada (`/dashboard`, `/dashboard/clients/<id>/...`)
comparte la misma envoltura visual:

- **Sidebar** colapsable a la izquierda con la lista de clientes y un
  botón para volver a expandirla.
- **Topbar** arriba con nombre + avatar (con menú dropdown estilo
  Crunchyroll: cambiar perfil, opciones, logout).
- **Tabs del cliente** (Customer Support, Reconciliations, W-9, 1099,
  Mgt Report, Tax Packet, QTR Payroll, Property Tax) cuando estás en
  `/dashboard/clients/<id>/`.
- **Guard de sesión** que redirige a `/login` si no hay sesión.

Sin este módulo, cada `page.tsx` tendría que importar y orquestar
manualmente sidebar + topbar + guard, duplicando JSX y lógica. Lo
juntamos aquí.

Banda **15–19** porque es UI shell solo-frontend (no espejea mapi).
Ver [CONVENTIONS.md §2](../CONVENTIONS.md#2-módulos-srcmodulesnn-name).

---

## Alcance previsto

### Sí entra (a lo largo de las versiones)

- `src/modules/15-app-shell/components/`:
  - `app-shell.tsx` — orquestador (sidebar + topbar + main).
  - `sidebar.tsx` — contenedor con scroll, search, lista de
    `<ClientStreamRow />`, botón colapsar.
  - `client-stream-row.tsx` — fila densa estilo prototipo (heat bar +
    VIP star + nombre + monto + status pill + silent count + sparkline
    13 meses). Sin agrupar por urgencia (decisión confirmada por
    Alfredo).
  - `topbar.tsx` — barra superior con nombre + avatar.
  - `avatar-menu.tsx` — dropdown con cambiar perfil / opciones /
    logout.
  - `client-tabs.tsx` — tabs horizontales para
    `/dashboard/clients/<id>/`.
- `src/modules/15-app-shell/hooks/`:
  - `use-sidebar-collapsed.ts` — estado persistido (probable
    `localStorage` para que sobreviva refresh).
  - `use-last-tab.ts` — recordar última tab por `clientId`
    (`localStorage`).
- `src/app/(authenticated)/layout.tsx` que usa `<AppShell />`.
- `src/app/(authenticated)/dashboard/clients/[clientId]/layout.tsx`
  que usa `<ClientTabs />`.

### NO entra

- Datos de los clientes en la sidebar — los provee `11-clients` o
  `13-dashboards` (TBD al arrancar v0.3.0).
- Lógica de cada tab — vive en su módulo respectivo
  (`12-customer-support`, etc.).
- Ruteo de `/login` y guard inicial — viven en `10-core-auth`.

---

## Naming visible al operador

### URLs

| URL                                              | Renderiza                                        |
| ------------------------------------------------ | ------------------------------------------------ |
| `/dashboard`                                     | Empty state (sin cliente seleccionado)           |
| `/dashboard/clients/<clientId>`                  | Redirect → `customer-support` o última tab vista |
| `/dashboard/clients/<clientId>/customer-support` | Tab Customer Support                             |
| `/dashboard/clients/<clientId>/reconciliations`  | Tab Reconciliations (placeholder hasta backend)  |
| `/dashboard/clients/<clientId>/w9`               | Tab W-9 (placeholder)                            |
| `/dashboard/clients/<clientId>/1099`             | Tab 1099 (placeholder)                           |
| `/dashboard/clients/<clientId>/mgt-report`       | Tab Mgt Report (placeholder)                     |
| `/dashboard/clients/<clientId>/tax-packet`       | Tab Tax Packet (placeholder)                     |
| `/dashboard/clients/<clientId>/qtr-payroll`      | Tab QTR Payroll (placeholder)                    |
| `/dashboard/clients/<clientId>/property-tax`     | Tab Property Tax (placeholder)                   |

`<clientId>` = UUID del cliente devuelto por `GET /v1/clients`.

### localStorage keys (probables)

| Key                                 | Para qué                             |
| ----------------------------------- | ------------------------------------ |
| `bvcpas.sidebarCollapsed`           | Bool, estado expandido/colapsado     |
| `bvcpas.lastTabByClient.<clientId>` | Última tab visitada para ese cliente |

---

## Versiones planeadas

- **v0.3.0** (📅 próxima): AppShell + sidebar (lista plana de clientes)
  - topbar + avatar dropdown + tabs del cliente + Customer Support con
    datos reales. Otras tabs renderizan "Coming soon".

---

## Notas

- Diseño visual de referencia:
  [`reference/customer-support-navy-v2.html`](../../reference/customer-support-navy-v2.html)
  - [`reference/cs-navy2.css`](../../reference/cs-navy2.css). Replicar
    con Tailwind (NO copiar CSS).
- Sin grupos de urgencia en la sidebar (decisión explícita de Alfredo).
  Las filas se ordenan por urgencia descendente pero sin headers de
  agrupación.
- Topbar **siempre** muestra nombre + avatar, sin importar la ruta.
  Sin KPIs, sin breadcrumb, sin search global (por ahora).
- Avatar arranca como inicial del nombre (no hay `avatar.url` en el
  backend); cuando mapi lo exponga se conecta automáticamente.
