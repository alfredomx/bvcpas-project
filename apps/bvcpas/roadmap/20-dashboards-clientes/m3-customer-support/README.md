# m3-customer-support — UI de M3 Customer Support Dashboard

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M3 (reemplaza GS Customer Support)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m3-customer-support/`](../../../../mapi/roadmap/50-features/m3-customer-support/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

Vista cross-cliente del estado de uncats de todos los clientes. El operador entra aquí para ver de un vistazo: quién falta de notificar, quién ya respondió, quién está al día.

**Detalle del GS actual:** ver [`docs/README.md` sección 7 — M3](../../../../../docs/README.md#m3--customer-support-dashboard-reemplaza-gs-customer-support).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/dashboards/customer-support` con tabla cross-cliente.
- Columnas: Company, Notific, Status, Amount $, Progress %, Uncats total, año pasado, totales mensuales (Jan-Dec).
- Filtros por status / por owner / por mes.
- Botón "Refresh" que llama a `GET /v1/admin/dashboards/customer-support` y actualiza con un click (NO depende de n8n).
- Acción rápida "Marcar como notificado" en cada fila.

### NO entra (preliminar)

- Envío de email del lado del frontend — el operador lo manda manual o vía n8n.

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M3 + datos de M2 ya populados.

---

## Notas

- Mejora clave pedida por el operador: "que con un click se actualice todo". Ya no depender de n8n para llenar el GS.
