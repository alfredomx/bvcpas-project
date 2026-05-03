# m5-receipts — Backend de M5 Receipts Dropbox

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M5 (mejora flujo de recibos)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m5-receipts/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m5-receipts/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

Hoy el cliente sube recibos a Dropbox y no hay automatización. M5 detecta uploads, notifica al operador, y opcionalmente renombra los recibos con formato consistente (`Vendor - Fecha - $Total.pdf`).

**Detalle:** ver [`docs/README.md` sección 7 — M5](../../../../../docs/README.md#m5--receipts-dropbox-mejora-flujo-de-recibos).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Reuso del connector Dropbox (de M4).
- Detección de archivos nuevos en carpetas de recibos por cliente.
- Tabla `receipts` (naming TBD): client_id, file_path, uploaded_at, status (`new | reviewed | renamed`).
- Endpoint `GET /v1/admin/dashboards/receipts` con feed de uploads recientes.
- Notificación al operador (mecanismo TBD: Telegram, email, push).
- **Plus opcional:** renamer automático con OCR (`Vendor - Fecha - $Total.pdf`). Diferido a v posterior si el operador lo pide.

### NO entra (preliminar)

- OCR avanzado — el plus es opcional y se difiere.
- Categorización automática del recibo en QBO.
- UI — vive en bvcpas.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ Mecanismo de notificación al operador definido (Telegram bot ya existe en mapi v0.x).
- ⏳ Connector Dropbox de M4 (compartido).

---

## Notas

- Si M4 ya entró, el connector Dropbox está listo y M5 solo agrega la detección de la carpeta receipts.
- Renombrado con OCR es Etapa 2 candidata si el operador lo pide.
