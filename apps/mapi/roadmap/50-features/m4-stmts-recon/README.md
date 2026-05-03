# m4-stmts-recon — Backend de M4 Stmts/Recon Dashboard

**App:** mapi
**Status:** 📅 Pendiente
**Mx:** M4 (reemplaza GS Stmts/Recon)
**Versiones que lo construyen:** —
**Frontend asociado:** [`apps/bvcpas/roadmap/20-dashboards-clientes/m4-stmts-recon/`](../../../../bvcpas/roadmap/20-dashboards-clientes/m4-stmts-recon/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx

Dashboard para saber si un statement bancario ya se descargó o si ya está conciliado. Hoy el operador marca manual paloma/tacha en un GS — M4 detecta automáticamente leyendo Dropbox.

**Detalle del GS actual + convención Dropbox:** ver [`docs/README.md` sección 7 — M4](../../../../../docs/README.md#m4--stmtsrecon-dashboard-reemplaza-gs-stmtsrecon).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Connector Dropbox API que lee carpetas por cliente.
- Detección de status por nombre de archivo:
  - `YYYY-MM.pdf` → statement disponible, sin conciliar.
  - `#<account> - YYYY-MM.pdf` → statement conciliado.
  - sin archivo → no hay statement.
- Tabla `bank_statements` (naming TBD) con shape: client_id, bank_name, account_id, year, month, status (`missing | downloaded | reconciled`), file_path, last_seen_at.
- Endpoint `GET /v1/admin/dashboards/stmts-recon` que devuelve grid: por cliente × banco × cuenta × 12 meses.
- Job worker que sincroniza con Dropbox periódicamente (BullMQ).

### NO entra (preliminar)

- Conciliar realmente — eso lo hace el operador en QBO manual.
- Descargar el statement automático — el cliente lo sube a Dropbox.
- UI — vive en bvcpas.

---

## Pre-requisitos para arrancar

- ✅ P0 cerrado.
- ⏳ Configurar Dropbox API access (token + carpeta raíz).
- ⏳ Redis (BullMQ) — primera vez que se necesita en bvcpas-project.

---

## Notas

- Independiente de Intuit (no necesita P1/P2 estrictamente, pero `clients` tabla sí).
- El connector Dropbox es nuevo — no había en mapi v0.x.
