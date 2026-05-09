# 12-customer-support — Tab Customer Support del cliente

**App:** bvcpas
**Status:** ✅ v0.5.0 cerrada (header + stats + suggested + quick links + timeline). Tabla Uncategorized/AMA's pendiente para v0.5.1.
**Versiones que lo construyen:** [v0.5.0](v0.5.0.md)
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
