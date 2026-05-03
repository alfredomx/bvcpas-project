# 20-qbo-scripts — Content scripts QBO (queries internas + writes)

**App:** kiro
**Status:** 📅 Pendiente (depende de 10-bridge-client)
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

Algunas operaciones en QuickBooks Online solo se pueden hacer desde dentro de la sesión web del operador (queries privilegiadas, write de notas/memo en uncats, etc.). Este bloque agrupa los content scripts que detectan páginas QBO, ejecutan queries internas, y mandan resultados a mapi vía bridge.

Cada Mx que requiera plugin tiene su sub-bloque aquí.

---

## Sub-bloques (mapeados a Mx que requieren plugin)

| Sub-bloque                                   | Mx  | Status | Backend asociado                           |
| -------------------------------------------- | --- | ------ | ------------------------------------------ |
| [m2-uncats-write](m2-uncats-write/README.md) | M2  | 📅     | `apps/mapi/roadmap/50-features/m2-uncats/` |

**Nota:** Los Mx que NO requieren plugin (M1, M3, M6, M7) no tienen sub-bloque aquí. M4 (statements bancarios) y M5 (recibos) podrían entrar si el operador decide que el plugin participe (ej. M4 → scraping de portal bancario, M5 → upload directo desde tab). Esos quedan en `30-banks/` o `40-receipts/` cuando se discutan.

---

## Pre-requisitos para arrancar el primer sub-bloque

- ⏳ `10-bridge-client/` listo (sin canal con mapi, los content scripts no tienen dónde mandar datos).
- Cada Mx tiene sus propios pre-requisitos en backend.

---

## Notas

- Content scripts en MV3 corren con `world: 'MAIN'` o `world: 'ISOLATED'`. El plugin de mapi v0.x usa MAIN para acceder a globals de QBO (window.intuit.\*).
- Cada content script declara su `matches` en `manifest.json` y se agregan permisos `host_permissions` correspondientes en su versión.
