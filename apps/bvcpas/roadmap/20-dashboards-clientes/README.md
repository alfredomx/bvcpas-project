# 20-dashboards-clientes — Dashboards Etapa 1 (M1-M7) — frontend

**App:** bvcpas
**Status:** 📅 Pendiente (depende de 10-core-ui + backend de cada Mx)
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

Este bloque agrupa los 7 dashboards de Etapa 1 (M1-M7) — la UI con la que el operador interactúa día a día para reemplazar los Google Sheets. Cada Mx es un sub-bloque separado.

La razón de agruparlos en `20-dashboards-clientes/` en lugar de cada Mx siendo su propio bloque numérico (`20-`, `21-`, ..., `26-`) es no saturar las decenas. Cuando llegue Etapa 2+ hay espacio en `30-`, `40-`, etc.

---

## Sub-bloques (orden tentativo del operador)

| Sub-bloque                                           | Mx  | Status | Backend asociado                                     |
| ---------------------------------------------------- | --- | ------ | ---------------------------------------------------- |
| [m1-admin](m1-admin/README.md)                       | M1  | 📅     | `apps/mapi/roadmap/50-features/m1-admin/`            |
| [m2-uncats](m2-uncats/README.md)                     | M2  | 📅     | `apps/mapi/roadmap/50-features/m2-uncats/`           |
| [m3-customer-support](m3-customer-support/README.md) | M3  | 📅     | `apps/mapi/roadmap/50-features/m3-customer-support/` |
| [m4-stmts-recon](m4-stmts-recon/README.md)           | M4  | 📅     | `apps/mapi/roadmap/50-features/m4-stmts-recon/`      |
| [m5-receipts](m5-receipts/README.md)                 | M5  | 📅     | `apps/mapi/roadmap/50-features/m5-receipts/`         |
| [m6-form-1099](m6-form-1099/README.md)               | M6  | 📅     | `apps/mapi/roadmap/50-features/m6-form-1099/`        |
| [m7-w9](m7-w9/README.md)                             | M7  | 📅     | `apps/mapi/roadmap/50-features/m7-w9/`               |

---

## Reglas del bloque

1. **Cada Mx requiere coordinación** con backend en mapi. La UI no se hace antes de que los endpoints existan (al menos los GET para mostrar datos).
2. **El stack visual se decide en `10-core-ui`** antes del primer Mx. Una vez decidido, todos los Mx lo usan.
3. **Solo un Mx `🚧` a la vez en todo el proyecto** (regla 18 de `docs/README.md`).
4. **Detalles de cada GS** (columnas actuales, mejoras pedidas) en [`docs/README.md` sección 7](../../../../docs/README.md#7-etapa-1--los-7-gs-y-los-3-pre-requisitos).

---

## Pre-requisitos para arrancar el primer dashboard

- ✅ P0 cerrado.
- ⏳ `10-core-ui/` con stack visual decidido + `AuthClient` + layout base.
- ⏳ Backend del Mx específico al menos con endpoints GET listos.

---

## Notas

- Si el operador pide deploy de bvcpas a `bvcpas.kodapp.com.mx`, eso entra como decisión cuando arranque la primera versión de UI funcional (probablemente cierre de M1).
