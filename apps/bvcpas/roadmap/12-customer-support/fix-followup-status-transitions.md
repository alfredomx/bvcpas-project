# Fix — Transiciones automáticas de `followup.status` por progreso

**Estado**: ✅ Cerrado
**Fecha**: 2026-05-12
**Versión base**: v0.6.0 (extiende `fix-sync-bumps-status.md`)
**Archivos**:
- [lib/followup-status.ts](../../src/modules/12-customer-support/lib/followup-status.ts)
- [lib/followup-status.test.ts](../../src/modules/12-customer-support/lib/followup-status.test.ts)
- [components/tx-detail-modal.tsx](../../src/modules/12-customer-support/components/tx-detail-modal.tsx)
- [components/cs-transactions.tsx](../../src/modules/12-customer-support/components/cs-transactions.tsx)
- [components/customer-support-screen.tsx](../../src/modules/12-customer-support/components/customer-support-screen.tsx)

---

## Qué hace

El frontend mueve automáticamente `followup.status` después de cada
operación que afecta el progreso del período:

- **Save de una response** en `<TxDetailModal>`.
- **Delete de una response** en `<TxDetailModal>`.
- **Sync exitoso** en `<CsTransactions>`.

La regla la aplica una única función pura
`computeNextFollowupStatus({ progressPct, sentAt, now })`:

| Progress | sent_at | Status resultante |
|---|---|---|
| `100`           | cualquiera | `complete`        |
| `0 < x < 100`   | cualquiera | `partial_reply`   |
| `0`             | mismo mes/año que `now` | `sent`            |
| `0`             | otro mes/año o null | `ready_to_send`   |

Solo se dispara PATCH si el `nextStatus` calculado difiere del
`followup.status` actual.

## Por qué (D-bvcpas-075)

Hasta v0.6.0, el `followup.status` lo cambiaba el operador a mano.
Con el envío automatizado de follow-ups (v0.6.0) y `fix-sync-bumps-status`,
los estados parciales (`partial_reply` y `complete`) quedaban
huérfanos: nunca se asignaban. Esto generaba un estado inconsistente
visible en el header — un cliente con 100% completado seguía
mostrando `sent`.

El criterio de **"mismo mes/año"** para distinguir `sent` de
`ready_to_send` resuelve el ciclo de vida real del período:

- El operador envía el follow-up → `sent_at` queda con la fecha.
- Si después borra todas las responses (progress vuelve a 0), no
  debe regresar a `ready_to_send` porque **ya se envió este mes**;
  el badge correcto es `sent` (línea base post-envío).
- En el siguiente mes, ese mismo `sent_at` queda "viejo" y el badge
  baja a `ready_to_send`, indicando que toca enviar de nuevo.

## Por qué función única (D-bvcpas-076)

La lógica aplica desde dos lugares (`TxDetailModal` y
`CsTransactions`). Mantener dos copias de la decisión era riesgo
inmediato de desincronización. `lib/followup-status.ts` exporta la
única regla, ambos componentes la consumen.

## Cómo se calcula `progress_pct` localmente (D-bvcpas-077)

`<TxDetailModal>` no espera el refetch del detail para conocer el
`progress_pct` resultante después de un Save/Delete; lo calcula
localmente:

```
nextResponded = max(0, stats.responded_count + delta)
nextProgress  = round(nextResponded / uncats_count * 100)
```

Misma fórmula exacta que usa mapi en su
`computeProgressPct(responded, uncats)`. **Solo `uncats_count`** en el
denominador — los AMAs no cuentan para el progreso.

**`uncats_count` (total) no cambia** ni en Save ni en Delete: la
transacción QBO sigue siendo uncategorized en ambos casos. Solo
cambiaría si el operador modifica la transacción directamente en
QuickBooks y vuelve a sincronizar — fuera del scope del modal.

Deltas según operación:

| Operación | `delta` |
|---|---|
| Save: no-completed → completed | `+1` |
| Save: completed → no-completed | `-1` |
| Save: sin cambio en `completed` | `0` |
| Delete response que estaba completed | `-1` |
| Delete response que no estaba completed | `0` |

## Delete del modal: borra el response, NO la transacción (D-bvcpas-078)

El botón Delete del modal llama
`DELETE /v1/clients/:id/transactions/responses/:txnId` — soft-delete
**solo del response** (la nota del operador). Mapi marca el response
con `deleted_at` y lo oculta del listado.

**La transacción QBO sigue válida** en el snapshot y sigue apareciendo
en `GET /transactions`, solo que con `response: null` (sin palomita
verde).

Razón: el snapshot de transacciones es **fiel a QBO**. Si el operador
necesita descartar una transacción del período, lo correcto es
modificarla en QuickBooks y volver a sincronizar — no inventar un
borrón desde el frontend.

Esto también significa que el frontend **no necesita** optimistic
update sobre el listado: la transacción debe seguir visible (sin
palomita) tras el invalidate. Solo cambia el cache de `uncats-detail`
para que stats refleje el `responded_count` nuevo.

`delta`:
- Save que pasa de no-completed a completed → `+1`.
- Save que pasa de completed a no-completed → `-1`.
- Save sobre uno ya completed (sin cambio) → `0`.
- Delete sobre una response que estaba completed → `-1`.
- Delete sobre una response no completed → `0`.

**Riesgo aceptado:** si mapi cambia la fórmula interna de
`progress_pct` (ej. excluye AMAs, pondera por monto, etc.), el
frontend va a divergir. El usuario explícitamente garantizó que la
fórmula es estable: `responded / (uncats + amas)`, ámbito del período
`01-01-año-1` hasta el último día del mes anterior. Si esa garantía
cambia, hay que migrar al modelo B (refetchear detail antes de
calcular).

## Cómo se conecta

`<CustomerSupportScreen>` propaga 4 props nuevas a `<CsTransactions>`:

- `respondedCount = data.stats.responded_count`
- `totalCount    = data.stats.uncats_count + data.stats.amas_count`
- `followupStatus = data.followup.status`
- `followupSentAt = data.followup.sent_at`

`<CsTransactions>` reenvía las cuatro al `<TxDetailModal>` y las usa
también para su propio `handleSync` (refactorizado).

## Tests

- `followup-status.test.ts`: 7 casos puros para la función.
- `cs-transactions.test.tsx`: 2 tests refactorizados (sync con
  `sent → ready_to_send`, sync con `partial_reply` que no cambia).

## Errores tolerados

Si el PATCH del bump falla (network, 4xx), **no** se muestra error
al operador: el cambio principal (Save/Delete/Sync) ya tuvo éxito y
la UI ya refleja la transacción. El badge quedará desactualizado
hasta el próximo refetch — no vale ensuciar el feedback por algo
secundario.
