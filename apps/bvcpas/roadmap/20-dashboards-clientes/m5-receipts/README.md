# m5-receipts — UI de M5 Receipts Dropbox

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M5 (mejora flujo de recibos)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m5-receipts/`](../../../../mapi/roadmap/50-features/m5-receipts/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

Feed de recibos subidos por clientes a Dropbox: el operador ve qué hay nuevo, abre el PDF, decide qué hacer.

**Detalle:** ver [`docs/README.md` sección 7 — M5](../../../../../docs/README.md#m5--receipts-dropbox-mejora-flujo-de-recibos).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/dashboards/receipts` con feed cronológico por cliente.
- Preview del PDF inline.
- Notificación en el navegador cuando llega uno nuevo (websocket o polling).
- Acción "Marcar como revisado".

### NO entra (preliminar)

- Categorización del recibo en QBO desde la UI (entra si Plus opcional ML se activa).

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M5 (si M4 ya entró, comparte connector Dropbox).

---

## Notas

- Si el operador prefiere notificación a Telegram en lugar de UI, M5 puede no requerir página y solo ser backend + bot.
