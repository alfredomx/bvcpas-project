# 12-customer-support (uncat-transactions) — Tab Uncat. Transactions del cliente

> **Nota:** la tab fue renombrada de "Customer Support" a
> "Uncat. Transactions" en v0.5.1. La carpeta del módulo se queda
> con su nombre original (`12-customer-support`) por D-bvcpas-034
> (cambios quirúrgicos). Ver
> [fix-rename-customer-support-tab.md](fix-rename-customer-support-tab.md).

**App:** bvcpas
**Status:** ✅ v0.5.1 — pantalla completa (header + stats + suggested + quick links + timeline + tabla Uncategorized/AMA's con sync).
**Versiones que lo construyen:**

- [v0.5.0](v0.5.0.md) — header + stats + suggested + quick links + timeline.
- [v0.5.1](../14-transactions/v0.5.1.md) — agrega `<CsTransactions>` (tabla + sync) + rename de la tab.
- [v0.5.2](v0.5.2.md) — `<CsConfigSheet>` (botón ⚙ Configure abre Sheet con 5 settings de envío de follow-ups).
- [v0.5.3](v0.5.3.md) — `primaryContactEmail` y `ccEmail` aceptan múltiples emails (CSV); transform a `null` cuando vacío.
- [v0.5.4](v0.5.4.md) — reorden de layout: tabs + Sync en una row; activity timeline 2/3 + suggested action 1/3.
- [v0.5.5](v0.5.5.md) — modal de detalle de transacción (`<TxDetailModal>`): badges, memo, dropdown QBO accounts, nota editable, sufijo localStorage, preview.

**Fixes:** [fix-rename-customer-support-tab.md](fix-rename-customer-support-tab.md)
**Última revisión:** 2026-05-09

---

## Por qué existe este módulo

La tab Customer Support es la primera de las 8 tabs del cliente. La
empresa necesita ver para cada cliente:

- **Header** con identificador (tier, followup status, contacto).
- **Stats grid** con KPIs: at risk, uncats del mes anterior, silent
  streak, AMA's, total backlog, progress.
- **Suggested next action** — qué debe hacer el operador hoy.
- **Quick links** — accesos directos (Sheet, Email, QBO file, etc.).
- **Activity timeline** — histograma mensual de uncats con el mes
  cerrado highlighted.
- **Tabla** de transacciones uncategorized / AMA (v0.5.1).

El módulo orquesta la pantalla y depende de:
- `13-dashboards/api/uncats-detail.api.ts` — la view del header/stats.
- `14-transactions` (futuro v0.5.1) — la tabla.

---

## Espejo backend

Match 1:1 con
[`apps/mapi/src/modules/12-customer-support/`](../../../../mapi/src/modules/12-customer-support).

---

## Componentes (v0.5.0)

| Símbolo                    | Descripción                                                |
| -------------------------- | ---------------------------------------------------------- |
| `<CustomerSupportScreen>`  | Orquestador. Recibe `clientId`, llama hook, distribuye.    |
| `<CsHeader>`               | Tier badge + followup badge + nombre + contact + last sent |
| `<CsStatsGrid>`            | 6 KPIs alineados horizontalmente.                          |
| `<CsSuggestedAction>`      | Card con CTA "Draft follow-up" (placeholder).              |
| `<CsQuickLinks>`           | 6 botones placeholder (toast on click).                    |
| `<CsActivityTimeline>`     | 12 barras mensuales; mes anterior highlighted.             |
| `<CsTransactions>`         | Leyenda del filter + Sync + tabs Uncategorized/AMA's (v0.5.1). |
| `<CsConfigSheet>`          | Sheet lateral con 5 settings de envío de follow-ups (v0.5.2). |

## Helpers (v0.5.0)

| Símbolo                      | Descripción                                              |
| ---------------------------- | -------------------------------------------------------- |
| `computeRange(now)`          | `{ from, to }` siguiendo regla del backend.              |
| `dashboardMonth(now)`        | Mes anterior + label en inglés.                          |
| `MONTH_LABELS`               | `['January', ..., 'December']`.                          |
| `formatAmount(value)`        | `'62600.00'` → `'$62.6k'`.                               |
| `formatSilentStreak(days)`   | `95` → `'3mo silent'`; `15` → `'15d silent'`.            |
| `silentStreakInMonths(days)` | Días → meses enteros (truncados).                        |
| `formatFollowupStatus(s)`    | `'awaiting_reply'` → `'awaiting reply'`.                 |

## Endpoints consumidos (vía 13-dashboards)

- `GET /v1/clients/:id/uncats?from=&to=` — view detalle.

---

## Notas

- snake_case 1:1 con backend (D-bvcpas-020).
- Periodo cerrado al mes anterior (D-bvcpas-031). Si hoy es
  2026-05-09, el dashboard muestra abril.
- Diseño minimalista: sólo Tailwind defaults + shadcn primitives
  (D-bvcpas-023). Cuando entre el rediseño visual, sólo se tocan los
  componentes presentacionales — la lógica queda intacta.
