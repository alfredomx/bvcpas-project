# fix — Columna status de la tabla del operador: 3 estados

## Problema

En `dashboard/clients/:id/uncategorized-transactions` la última
columna de la tabla muestra hoy solo 2 estados:

- ✓ verde — `response.completed === true` (writeback a QBO hecho).
- ✗ gris — cualquier otro caso.

Eso colapsa dos casos distintos:

- Cliente **no ha contestado** (no hay response).
- Cliente **ya contestó** pero el operador aún no hace el writeback
  a QBO (`response !== null && response.completed === false`).

El operador necesita distinguirlos a simple vista para saber a
quién todavía falta enviarle follow-up vs a quién ya hay que
procesar.

## Cambio

3 iconos en `<CsTransactionsTable>` (`cs-transactions.tsx`, columna
sin label al final de cada fila):

| Caso | Condición | Ícono | Color |
|---|---|---|---|
| Pending (sin respuesta) | `t.response === null` | `X` | gris (`text-muted-foreground`) |
| Client answered, no QBO sync | `t.response && !t.response.completed` | ⏳ `Hourglass` | amber (`text-amber-600`) |
| Synced to QBO | `t.response?.completed === true` | `Check` | verde (`text-green-600`) |

Reemplazar el ternario actual por una función helper local que
mapee `t.response` a un objeto `{ Icon, className, label }` para que
quede limpio y testeable a futuro si hace falta.

Tooltip `title` en cada ícono para que pasar el mouse aclare el
estado.

## Out of scope

- Filtrado por estado en la tabla (lo decide el operador desde tabs
  existentes "Uncategorized / AMA").
- Colorear toda la fila por estado.
- Cambiar los íconos por otra librería.

## Criterios de aceptación

1. Una transacción sin response muestra `X` gris.
2. Una transacción con response + `completed: false` muestra ⏳
   amber.
3. Una transacción con response + `completed: true` muestra ✓
   verde.
4. Hover en cada ícono muestra tooltip describiendo el estado.
