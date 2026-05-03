# m2-uncats — UI de M2 Uncats Pipeline

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M2 (reemplaza GS Uncat por cliente)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m2-uncats/`](../../../../mapi/roadmap/50-features/m2-uncats/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

El operador necesita una página por cliente donde:

1. Ve la lista de uncats que tiene QBO (extraídos por mapi).
2. Edita la nota de cada uncat (la que el cliente le pasó).
3. Hace click en "Aplicar notas" → se manda batch a kiro vía bridge para escribir en QBO.

**Detalle del GS actual:** ver [`docs/README.md` sección 7 — M2](../../../../../docs/README.md#m2--uncats-pipeline-reemplaza-gs-uncat-por-cliente).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/clients/:id/uncats` con tabla de uncats: Date, Type, Check#, Name, Memo/Description, Split, Category, Amount, Notes (editable).
- Botón "Sync uncats from QBO" → dispara `POST /v1/admin/clients/:id/uncats/sync`.
- Botón "Apply notes to QBO" → dispara `POST /v1/admin/clients/:id/uncats/apply-notes`.
- Indicador de progreso de aplicación (cuántos aplicados, cuántos fallaron).
- Estado por cliente accesible desde M3 (que es vista cross-cliente).

### NO entra (preliminar)

- Categorización con ML — Plus opcional del operador.

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M2 con endpoints sync/apply.
- ⏳ Plugin kiro (`m2-uncats-write`) operativo.

---

## Notas

- UX crítica: el operador edita notas de muchas uncats a la vez, debe ser cómodo (autosave, atajos teclado, etc.).
