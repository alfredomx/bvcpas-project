# `src/components/` — componentes compartidos

Componentes que **no pertenecen a un módulo de dominio** y se reutilizan
desde múltiples pantallas.

## Estructura

```
src/components/
├── ui/         ← primitivos shadcn/ui (Button, Input, Dialog, ...)
├── layout/     ← Sidebar, TopBar, AppShell (estructura visual de la app)
└── shared/     ← compartidos no-shadcn (Avatar custom, ErrorBoundary, ...)
```

## `ui/` — shadcn/ui

Generados con `npx shadcn@latest add <componente>`. NO se editan a mano salvo
ajustes de tema. Si necesitas un comportamiento muy distinto, mejor envuelve
el primitivo en un componente del módulo que lo necesita.

## `layout/`

Sidebar, top bar, breadcrumbs, contenedores que dan estructura a la app.
Se montan en `src/app/(authenticated)/layout.tsx` o equivalente.

## `shared/`

Componentes reutilizables que no son shadcn primitives ni layout. Ej:
`<EmptyState />`, `<DataTable />` genérica, `<ErrorBoundary />`.

## Qué NO va aquí

- Componentes específicos de un dominio (ej: `ClientList`, `UncatRow`) →
  `src/modules/NN-name/components/`.
