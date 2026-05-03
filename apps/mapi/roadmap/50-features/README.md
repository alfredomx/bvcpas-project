# 50-features — Features Etapa 1 (M1-M7) — backend

**App:** mapi
**Status:** 📅 Pendiente (depende de P1 + P2)
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

Este bloque agrupa la lógica de backend de los 7 módulos de Etapa 1 (M1-M7) — los reemplazos de los Google Sheets internos del operador. Cada Mx es un sub-bloque separado.

La razón de agruparlos en `50-features/` en lugar de cada Mx siendo su propio bloque numérico (`50-`, `51-`, ..., `56-`) es no saturar las decenas. Cuando lleguen Etapa 2+, hay espacio en `60-`, `70-`, etc. (regla heredada D-mapi-008 — agrupación cuando hay pocos huecos).

---

## Sub-bloques (orden tentativo del operador)

| Sub-bloque                                           | Mx  | Status | Reemplaza GS            | Frontend en bvcpas    | Plugin en kiro    |
| ---------------------------------------------------- | --- | ------ | ----------------------- | --------------------- | ----------------- |
| [m1-admin](m1-admin/README.md)                       | M1  | 📅     | Dashboard Administrator | `m1-admin`            | —                 |
| [m2-uncats](m2-uncats/README.md)                     | M2  | 📅     | Uncats por cliente      | `m2-uncats`           | `m2-uncats-write` |
| [m3-customer-support](m3-customer-support/README.md) | M3  | 📅     | Customer Support        | `m3-customer-support` | —                 |
| [m4-stmts-recon](m4-stmts-recon/README.md)           | M4  | 📅     | Stmts/Recon             | `m4-stmts-recon`      | (futuro)          |
| [m5-receipts](m5-receipts/README.md)                 | M5  | 📅     | Receipts (mejora flujo) | `m5-receipts`         | (futuro)          |
| [m6-form-1099](m6-form-1099/README.md)               | M6  | 📅     | 1099's                  | `m6-form-1099`        | —                 |
| [m7-w9](m7-w9/README.md)                             | M7  | 📅     | W9 cliente              | `m7-w9`               | —                 |

**Numeración:** `m1-` a `m7-` con prefijo del Mx (vocabulario del operador). Sin renombrar carpetas si el orden de ejecución cambia — el nombre conceptual (`m2-uncats`) es invariante.

---

## Orden tentativo

```
M1 (control central)
  └── M2 (consume M1)
        └── M3 (visualiza estado de M2)
M4, M5, M6, M7 — independientes entre sí
M7 al final por complejidad (filtros con exclusiones por vendor)
```

El orden puede reordenarse según presión operativa (ej. temporada 1099 oct-ene → M6 sube prioridad).

---

## Reglas del bloque

1. **Solo un Mx `🚧` a la vez en todo el proyecto** (no por app). No abrimos M1 y M2 simultáneo.
2. Cada Mx requiere coordinación entre 2-3 apps (mapi + bvcpas, a veces kiro). Cada commit toca un solo app.
3. El TDD vivo de cada Mx vive en su sub-carpeta `m<N>-<nombre>/README.md`.
4. Detalles de cada GS (columnas actuales, mejoras pedidas) en [`docs/README.md` sección 7](../../../../docs/README.md#7-etapa-1--los-7-gs-y-los-3-pre-requisitos).

---

## Notas

- Pre-requisitos antes de arrancar M1: P1 (`20-intuit/01-oauth/`) y P2 (`20-intuit/02-bridge/` + `apps/kiro/roadmap/10-bridge-client/`).
- Cada Mx puede requerir extender `11-clients/` (más columnas en config), agregar tabla nueva, exponer endpoints específicos.
