# 10-core-ui — Auth client + layout + design system + theming

**App:** bvcpas
**Status:** 📅 Pendiente
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

Cuando entre el primer dashboard de un Mx (probablemente M1), bvcpas necesita stack visual decidido (Tailwind / shadcn / etc.), un `AuthClient` que hable con mapi para login + JWT, un `Layout` base con navegación, y un design system mínimo (componentes reutilizables).

Hoy, v0.1.0 es solo un "Hello bvcpas" estático. Este bloque transforma bvcpas en una app real con sesión y navegación.

---

## Sub-bloques (paralelos, sin numeración)

| Sub-bloque       | Status | Notas                                                                   |
| ---------------- | ------ | ----------------------------------------------------------------------- |
| `auth-client/`   | 📅     | Login form + JWT en cookie/localStorage + ProtectedRoute                |
| `design-system/` | 📅     | Decisión Tailwind/shadcn + componentes base + tokens de color/espaciado |
| `layout/`        | 📅     | Sidebar + topbar + navegación entre dashboards                          |
| `theming/`       | 📅     | (opcional) dark mode si el operador lo pide                             |

**Numeración:** sin numerar (paralelos, no hay orden estricto). Cuando se discuta el orden real, posiblemente design-system primero porque los demás dependen de los componentes base.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado (scaffold Next.js).
- ⏳ AuthModule en mapi (no existe todavía — entra cuando un Mx lo pida).
- Decisión del operador: ¿Tailwind 4 + shadcn (lo más moderno) o algo más liviano?

---

## Notas

- El stack visual definitivo (`D-bvcpas-NNN` futuro) se decide cuando arranque la versión.
- Probablemente este bloque se construye en paralelo con el primer Mx de UI (no antes).
