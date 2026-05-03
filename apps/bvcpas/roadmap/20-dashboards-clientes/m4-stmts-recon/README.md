# m4-stmts-recon — UI de M4 Stmts/Recon Dashboard

**App:** bvcpas
**Status:** 📅 Pendiente
**Mx:** M4 (reemplaza GS Stmts/Recon)
**Versiones que lo construyen:** —
**Backend asociado:** [`apps/mapi/roadmap/50-features/m4-stmts-recon/`](../../../../mapi/roadmap/50-features/m4-stmts-recon/README.md)
**Última revisión:** 2026-05-03

---

## Por qué existe este Mx (lado UI)

Grid de status de statements bancarios: filas = clientes × banco × cuenta, columnas = 12 meses, celda = paloma/tacha/warning según si hay statement, si está conciliado, etc.

**Detalle del GS actual y convención Dropbox:** ver [`docs/README.md` sección 7 — M4](../../../../../docs/README.md#m4--stmtsrecon-dashboard-reemplaza-gs-stmtsrecon).

---

## Alcance preliminar (TBD al abrir versión)

### Sí entra (preliminar)

- Página `/dashboards/stmts-recon` con grid completo.
- Click en celda → preview del archivo de Dropbox + acción "marcar como conciliado".
- Filtro por banco / cuenta / cliente.
- Refresh automático cuando se detecta cambio en Dropbox (vía SSE o polling).

### NO entra (preliminar)

- Conciliar realmente — eso es manual en QBO.

---

## Pre-requisitos

- ⏳ `10-core-ui/`.
- ⏳ Backend M4 + Dropbox watcher activo.

---

## Notas

- Componente grid 12 meses × N filas. TanStack Table o equivalente con sticky headers/cells.
