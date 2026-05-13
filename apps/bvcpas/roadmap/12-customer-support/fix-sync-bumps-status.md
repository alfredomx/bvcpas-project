# Fix — Sync bumpea followup a `ready_to_send` cuando `progress_pct = 0`

**Estado**: ✅ Cerrado
**Fecha**: 2026-05-12
**Versión base**: v0.6.0
**Archivos**: [cs-transactions.tsx](../../src/modules/12-customer-support/components/cs-transactions.tsx), [cs-transactions.test.tsx](../../src/modules/12-customer-support/components/cs-transactions.test.tsx), [customer-support-screen.tsx](../../src/modules/12-customer-support/components/customer-support-screen.tsx)

---

## Qué hace

Después de un sync exitoso (`POST /v1/clients/:id/transactions/sync`),
si `progress_pct === 0` el frontend dispara
`PATCH /v1/clients/:id/followups/:period { status: 'ready_to_send' }`.

Si `progress_pct > 0`, **no** se toca el status.

## Por qué (D-bvcpas-074)

Antes del v0.6.0, el operador cambiaba el `followup.status` a mano. Con
el envío de follow-up automatizado, los status también pueden moverse
solos. Las transiciones que el frontend dispara hoy son:

- `pending → sent` (al confirmar el Send del DraftFollowupDialog).
- `* → ready_to_send` (al hacer sync, **solo si progress_pct era 0**).

La regla `progress_pct === 0` existe para **no degradar el avance del
usuario**:

- Si ya hay responses llenadas (parcialmente: `partial_reply`) y el
  operador hace un sync porque mapi recibió cambios de último momento,
  bumpear a `ready_to_send` borraría el avance lógico. Mejor dejar el
  status como estaba; mapi se encargará del cambio a `partial_reply` o
  `complete` cuando corresponda.
- Si el período está completo (`complete`) y el operador hace sync por
  inercia, igualmente no degradamos.
- Solo cuando `progress_pct === 0` el sync representa "empezar fresco
  con uncats nuevos" y tiene sentido marcar `ready_to_send`.

## Cómo se implementó

1. `<CsTransactions>` recibe `progressPct: number` por prop (lo pasa el
   screen leyendo `data.stats.progress_pct`).
2. `useMutation` adentro de `<CsTransactions>` envuelve
   `updateFollowup(clientId, currentPeriod(now), { status: 'ready_to_send' })`.
3. En el `onSuccess` del `sync.mutate`, justo después del toast de
   sync exitoso, se evalúa:
   ```ts
   if (progressPct === 0) {
     bumpFollowup.mutate()
   }
   ```
4. El `onSuccess` del bump invalida `['uncats-detail']` por prefijo
   (D-bvcpas-066/073) para refrescar el header (badge pasa a
   `ready_to_send`).
5. Si el bump falla, no se muestra error al usuario: el sync ya tuvo
   éxito, el status no se actualiza pero no rompe nada.

## Tests

`cs-transactions.test.tsx` añade dos casos:

- Sync OK con `progressPct=0` → `updateFollowup` llamado con
  `{status:'ready_to_send'}` y `period` formato `YYYY-MM`.
- Sync OK con `progressPct=42` → `updateFollowup` **no** se llama.

## Por qué fix y no v0.6.1

La regla es chica (un `if`), no tiene UI nueva, ni endpoint nuevo, ni
flujos de error nuevos. Es una consecuencia natural del Send
automatizado de v0.6.0. Pero **la regla del `progress_pct === 0` no
es obvia** — sin esta nota, alguien podría "limpiar" el if pensando
que es innecesario. Por eso queda documentada como fix.
