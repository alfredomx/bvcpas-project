# Fix — Rename "Customer Support" → "Uncat. Transactions"

**Versión que lo aplica:** v0.5.1.
**Decisión asociada:** D-bvcpas-035.
**Regla aplicada:** D-bvcpas-034 (renombramientos quirúrgicos).

---

## Por qué se renombró

El backend cambió `/v1/dashboards/customer-support` por
`/v1/clients/:id/uncats` porque "Customer Support" no reflejaba lo
que la pantalla muestra (transacciones uncategorized + AMA's). El
frontend siguió la misma decisión de naming.

---

## Qué SÍ se renombró

| Lugar                          | Antes                       | Después                              |
| ------------------------------ | --------------------------- | ------------------------------------ |
| Label de la tab (UI visible)   | `Customer Support`          | `Uncat. Transactions`                |
| Slug en `tabs.ts`              | `customer-support`          | `uncategorized-transactions`         |
| `DEFAULT_TAB_SLUG`             | `customer-support`          | `uncategorized-transactions`         |
| `router.push` en sidebar       | `.../customer-support`      | `.../uncategorized-transactions`     |
| Carpeta de Next App Router     | `customer-support/`         | `uncategorized-transactions/`        |
| Tests con asserts del label   | `Customer Support`          | `Uncat. Transactions`                |
| Tests con asserts del slug    | `customer-support`          | `uncategorized-transactions`         |
| Título del README del módulo  | `# 12-customer-support`     | `# 12-customer-support (uncat-transactions)` |

---

## Qué NO se renombró (huella histórica)

| Lugar                                          | Estado                                  | Razón                                                                |
| ---------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Carpeta del módulo `src/modules/12-customer-support/` | Se queda                          | Renombrar = ~15 imports + tests + READMEs. D-bvcpas-034.             |
| Carpeta del roadmap `roadmap/12-customer-support/`    | Se queda                          | Misma razón.                                                         |
| Wrapper `13-dashboards/api/uncats-detail.api.ts`      | Se queda                          | El nombre describe el endpoint backend (`/uncats`), no la tab.       |
| Hook `useUncatsDetail`                                | Se queda                          | Idem.                                                                |
| Componentes `<CsHeader>`, `<CsStatsGrid>`, etc.       | Se quedan con prefijo `Cs`        | Re-renombrar tendría que tocar tests y orquestador. Huella histórica. |
| TDDs cerrados de v0.3.x / v0.5.0                      | Se quedan literales               | Son bitácora histórica, no se reescriben.                            |
| Comentarios viejos que dicen "Customer Support"       | Se quedan literales               | Son bitácora histórica.                                              |
| README de `15-app-shell` (D-bvcpas-018)               | Mención "Customer Support" se queda como histórico | El texto explica que ahora es "Uncat. Transactions".          |

---

## Consecuencias para futuros lectores

- Si abres `src/modules/12-customer-support/` y te confunde el
  nombre: corresponde a la tab "Uncat. Transactions". El nombre del
  módulo es huella histórica.
- Si abres `useUncatsDetail`: el hook llama
  `GET /v1/clients/:id/uncats`. El nombre describe el endpoint, no
  la tab.
- Si necesitas un nombre nuevo con menos arrastre histórico, créalo
  desde un módulo nuevo (`14-transactions` es ejemplo limpio).
