# m7-w9 — UI de M7 W9 Dashboard con filtros guardados

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M7 (reemplaza GS W9 cliente)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m7-w9/`](../../../../mapi/roadmap/50-features/m7-w9/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

El más complejo de los 7 dashboards. El operador construye filtros guardados (categorías QBO incluidas + vendors excluidos), y ve la lista resultante de vendors con totales por categoría + status address/tax_id en QBO.

**Detalle del GS actual y mejora pedida:** ver [`docs/README.md` sección 7 — M7](../../../../../docs/README.md#m7--w9-dashboard-con-filtros-guardados-reemplaza-gs-w9-cliente).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/clients/:id/w9` con:
  - Selector de filtro guardado (o crear nuevo).
  - Editor de filtro: checkboxes de categorías QBO + lista de vendors excluidos.
  - Tabla de resultados: vendor, total Rent, total Subcontractors, address (paloma/tacha), tax_id (paloma/tacha), mailed (paloma/tacha), notes.
  - Acción "Excluir vendor" en cada fila → agrega al filtro.
  - El sistema **recuerda la exclusión** (no aparece más con ese filtro).

### NO entra (preliminar)

- Envío automático del W9 — manual.
- OCR del W9 recibido del vendor.

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M7 con tabla `w9_filters` + endpoints de filtros + endpoint de aplicación.
- ⏳ Acceso a categorías + vendors de QBO via proxy admin.

---

## Notas

- Por complejidad, M7 está al final del orden tentativo. Pero si entra temporada de 1099 + el operador pide W9 antes, sube prioridad.
