# `src/lib/` — helpers cross-cutting

Código que **no pertenece a un módulo específico** y se usa desde varios
lugares del frontend.

## Qué va aquí

- `utils.ts` — `cn()` (Tailwind class merger) y otros helpers de presentación.
- `http.ts` (futuro) — fetch base con baseURL, auth header, manejo de errores.
- `auth.ts` (futuro) — helpers de token storage / sesión cliente.
- `format.ts` (futuro) — formatters de fecha, moneda, porcentaje (es-MX, USD).
- `hooks/` (futuro) — hooks genéricos no atados a un módulo (ej: `useDebounce`).

## Qué NO va aquí

- Lógica de negocio específica de un dominio → `src/modules/NN-name/`.
- Componentes de UI → `src/components/`.
- Llamadas API específicas de un módulo → `src/modules/NN-name/api/`.

Regla práctica: si solo lo usa un módulo, vive en ese módulo. Si lo usan ≥2
módulos o el shell de la app, se sube a `lib/`.
