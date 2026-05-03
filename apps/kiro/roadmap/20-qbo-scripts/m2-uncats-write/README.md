# m2-uncats-write — Plugin de M2: escribir notas/memo en QBO

**App:** kiro
**Status:** 📅 Pendiente
**Mx:** M2 (reemplaza GS Uncat por cliente)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m2-uncats/`](../../../../mapi/roadmap/50-features/m2-uncats/README.md)
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m2-uncats/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m2-uncats/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado plugin)

El operador edita notas de uncats en bvcpas. mapi guarda las notas. Cuando hace click en "Apply notes", mapi manda batch a kiro vía bridge. **Kiro escribe esas notas en QBO desde la sesión del operador** (porque la API pública de Intuit no permite editar notas de transacciones en `Uncategorized`).

**Detalle del flujo end-to-end:** ver [`docs/README.md` sección 7 — M2](../../../../../docs/README.md#m2--uncats-pipeline-reemplaza-gs-uncat-por-cliente).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Content script que se inyecta en `https://qbo.intuit.com/*`.
- Handler de mensaje `apply-uncats-notes` que recibe del bridge: `{ realmId, items: [{ qboTxId, note, memo }] }`.
- Para cada item:
  - Navegar a la transacción en QBO.
  - Escribir `note` en el campo de notas internas.
  - Escribir `memo` en el campo de memo.
  - Guardar.
  - Reportar éxito/fallo a mapi vía bridge.
- Idempotencia: si una transacción ya tiene la misma nota/memo, skip y reporta `already-applied`.

### NO entra (preliminar)

- Recategorizar la transacción (eso requiere otra UX en QBO, fuera de M2 MVP).
- Scrapping del listado de uncats (el listado lo extrae mapi via Developer API, no plugin).

---

## Permisos Chrome necesarios

- `host_permissions: ["https://qbo.intuit.com/*", "https://*.intuit.com/*"]`.
- (`storage` heredado de `10-bridge-client`).

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ `10-bridge-client/` operativo.
- ⏳ Backend M2 con endpoint `apply-notes` que mande batch al bridge.

---

## Notas

- Heredado de mapi v0.x: el plugin qubot actual ya hace algo similar (escribir notas vía DOM scripting). Reusable con renames.
- Riesgo: si QBO cambia el DOM, el script rompe. Mitigación: detección defensiva + reporte de error claro al operador.
