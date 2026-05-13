# fix — getQboAccounts: MAXRESULTS 1000 (no 200)

## Problema

`getQboAccounts` corre la query QBO con `MAXRESULTS 200`
(`apps/bvcpas/src/modules/14-transactions/api/qbo-accounts.api.ts:15`).

Clientes con COA grandes (chart of accounts > 200 cuentas) ven el
combobox **Category / account** del `<TxDetailModal>` cortado: las
cuentas que el usuario necesita pueden no aparecer y el guardado de
la respuesta queda bloqueado.

Detectado mientras Alfredo revisaba el modal de
UnitedHealthcare / 1120 Chase Checking — la lista del combo se cortaba
sin razón aparente.

## Cambio

Subir el límite al máximo permitido por la QBO Query API: **1000**.

```ts
// antes
const QBO_ACCOUNT_QUERY =
  'select Id, Name, AccountType from Account MAXRESULTS 200'

// después
const QBO_ACCOUNT_QUERY =
  'select Id, Name, AccountType from Account MAXRESULTS 1000'
```

Una sola línea. No hay paginación: con 1000 cubrimos cualquier COA
realista. Si en el futuro algún cliente excede los 1000, se decide en
ese momento (paginación con `STARTPOSITION`).

## Criterios de aceptación

- `qbo-accounts.api.ts:15` dice `MAXRESULTS 1000`.
- Tests de `qbo-accounts.api.test.ts` siguen pasando (el query string
  cambió, hay que actualizar el match si lo asertan literal).
- En el modal con un cliente que tenga >200 cuentas, el combobox
  muestra todas (validación manual de Alfredo).

## Out of scope

- Paginación (`STARTPOSITION`) — no aplica hasta tener un caso real.
- Cambiar el shape devuelto, filtros por `AccountType`, ordenamiento,
  etc.
