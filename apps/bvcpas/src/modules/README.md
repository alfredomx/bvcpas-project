# `src/modules/` — código de dominio

Cada subcarpeta es **un módulo** del frontend. Mismo patrón numérico que el
backend (`NN-name`), pero los nombres se eligen por lo que tiene sentido en el
front, **no** por mapeo 1:1 con backend.

## Estructura interna de un módulo

```
src/modules/NN-name/
├── README.md          ← qué hace, en qué pantalla(s) vive
├── api/               ← clientes HTTP tipados (fetch wrappers)
│   └── *.api.ts
├── components/        ← componentes específicos del módulo
│   └── *.tsx
├── hooks/             ← hooks específicos del módulo (opcional)
│   └── use-*.ts
└── types.ts           ← tipos compartidos del módulo (opcional)
```

## Qué va aquí y qué NO

✅ Aquí va:

- Componentes de UI específicos de un dominio (ej: `ClientList`, `UncatTable`).
- Hooks que encapsulan llamadas API + estado del módulo.
- Tipos del dominio (request/response del backend, view models).
- Wrappers de fetch tipados que llaman a `/v1/...` del backend.

❌ NO va aquí:

- Componentes UI primitivos (botón, input, modal) → `src/components/ui/`.
- Helpers cross-cutting (cn, formatters, validators) → `src/lib/`.
- Rutas / pantallas → `src/app/<ruta>/page.tsx` (solo importa del módulo).

## Cómo crear un módulo nuevo

1. Define en el roadmap qué versión introduce el módulo.
2. Crea `NN-name/` con el siguiente número disponible.
3. Crea `README.md` del módulo (qué hace, qué pantallas lo consumen).
4. Empieza por `api/` y `types.ts` (contrato con backend).
5. Componentes y hooks vienen después.
6. La página en `src/app/` solo arma layout y compone módulos — no tiene
   lógica de negocio.
