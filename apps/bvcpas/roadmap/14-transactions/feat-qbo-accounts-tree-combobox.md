# feat — Combobox de cuentas QBO jerárquico

## Motivación

Hoy el combobox **Category / account** del `<TxDetailModal>` muestra
las cuentas QBO como una lista plana ordenada por nombre. En clientes
con COA reales (restaurantes con jerarquías por categoría de gasto),
ver `Management - FOH`, `Management - BOH`, `Back of House Staff`,
`Dishwashers` mezclados sin contexto hace difícil escoger la cuenta
correcta.

QBO ya devuelve la jerarquía completa por cuenta. La lista hay que
agruparla y dibujarla con indent + etiqueta de padre, igual que el
selector nativo de QuickBooks.

## Datos disponibles

La query actual sólo trae `Id, Name, AccountType`. QBO devuelve más
campos sin costo extra:

- `SubAccount: boolean` — `true` si es subcuenta.
- `ParentRef.value: string` — `Id` del padre directo (solo si
  `SubAccount=true`).
- `FullyQualifiedName: string` — path completo, separador `":"`.
  Ej. `"Staff Salaries and Wages:Back of House Staff:Dishwashers"`.
- `Active: boolean` — `false` si la cuenta está deshabilitada.

Soporta multinivel (QBO permite hasta 5).

## Cambios

### 1. `qbo-accounts.api.ts`

Extender el `select` de QBO:

```ts
const QBO_ACCOUNT_QUERY =
  'select Id, Name, AcctNum, AccountType, SubAccount, ParentRef, ' +
  'FullyQualifiedName, Active from Account ' +
  "WHERE Active = true MAXRESULTS 1000"
```

Tipo `QboAccount`:

```ts
export interface QboAccount {
  Id: string
  Name: string
  AcctNum: string | null              // número visible en QBO (ej. "2810")
  AccountType: string
  SubAccount: boolean
  ParentId: string | null             // ParentRef.value normalizado
  FullyQualifiedName: string
}
```

El parser extrae `ParentRef?.value ?? null` y `AcctNum` (string o
null si viene vacío/ausente). Filtro de tipos sigue defensivo: si
falta algún campo crítico, se ignora la cuenta.

### 2. Lista presentada al combobox

Nueva función pura `buildAccountTree(accounts: QboAccount[]): AccountRow[]`
en `src/modules/14-transactions/lib/qbo-accounts-tree.ts`:

```ts
export interface AccountRow {
  Id: string
  displayName: string        // "{AcctNum} {Name}" si AcctNum, si no "{Name}"
  depth: number              // 0 raíz, 1 hijo directo, etc.
  rightLabel: string         // "Expense" en raíz, "Sub of <padre>" en hijos
  searchText: string         // FullyQualifiedName + AcctNum, minúsculas
  AccountType: string        // para mostrar en modo búsqueda
}
```

Reglas:

- Orden: por `FullyQualifiedName` ascendente, case-insensitive.
- `depth = FullyQualifiedName.split(':').length - 1`.
- `displayName`:
  - `AcctNum` no nulo y no vacío → `"{AcctNum} {Name}"`.
  - Si no → `Name`.
- `rightLabel`:
  - `depth === 0` → `AccountType` (ej. `Expense`, `Bank`).
  - `depth > 0` → `Sub of {nombre del padre directo}`. El padre
    directo se localiza por `ParentId` en el mapa; si no se encuentra
    (debería ser imposible si Active=true), se cae a tomar el penúltimo
    segmento de `FullyQualifiedName`.
- `searchText` = `FullyQualifiedName + ' ' + (AcctNum ?? '')`,
  minúsculas — así buscar por número (`2810`) encuentra la cuenta.

### 3. `<TxDetailModal>` — render del combobox

- Recibe `rows = useMemo(() => buildAccountTree(accounts), [accounts])`.
- `CommandItem` usa `value={row.searchText}` para que el filtro de
  shadcn `Command` matchee contra el path completo (busqueda por
  "foh" sigue funcionando, búsqueda por "management foh" también).
- Layout del item:
  - `paddingLeft = depth * 16px` (Tailwind: `style={{ paddingLeft: depth * 16 }}`).
  - Texto principal: `Name`. Si `depth === 0`, peso `font-medium`; si
    `depth > 0`, peso normal.
  - Texto secundario (derecha): `rightLabel` en itálica gris
    (`text-xs italic text-muted-foreground`).
- Modo búsqueda: el filtro de `Command` ya colapsa visualmente el
  árbol — al haber match parcial sólo se ven los items que pasaron
  el filtro, sin indent visible si su padre quedó fuera. El indent
  se mantiene porque está en el item, pero el resultado se ve como
  lista; ahí el `rightLabel = "Sub of <padre>"` ya basta para dar
  contexto.
- Se conserva el comportamiento actual: click selecciona, popover se
  cierra, `setSelectedAccount(row.Id)`.

### 4. SDK / tipos

`QboAccount` ya es un tipo local (no del SDK auto-generado). No se
toca `schema.ts`.

## Out of scope

- Toggle "Show inactive accounts" (filtro `Active = false`) — backlog.
- Mostrar `CurrentBalance` o `Classification` — backlog.
- Paginación con `STARTPOSITION` (sigue siendo MAXRESULTS 1000).
- Buscador con scoring custom (se confía en el matcher por defecto
  de shadcn `Command`).

## Criterios de aceptación

1. La query QBO trae los nuevos campos. Si QBO devuelve una cuenta
   sin `FullyQualifiedName`, se descarta sin romper el render.
2. En el combobox cerrado/abierto sin buscar:
   - Las raíces aparecen primero, en negrita, con su `AccountType`
     a la derecha.
   - Las subcuentas aparecen debajo de su padre directo, con indent
     proporcional al nivel.
   - El texto a la derecha de una subcuenta dice
     `Sub of {nombre del padre directo}`.
3. Buscando "foh": aparece `Management - FOH` con su `Sub of
   Management Salaries and Wages` (o el padre directo que aplique).
4. Filtrar `Active = true` deja fuera cuentas inactivas.
5. Tests:
   - `qbo-accounts.api.test.ts`: actualiza el shape de la respuesta
     mockeada con los nuevos campos.
   - `qbo-accounts-tree.test.ts` (nuevo): cubre los casos básicos
     (raíz simple, 1 nivel de subcuenta, 3 niveles, padre faltante,
     orden alfabético dentro de mismo padre).
6. Validación manual con un cliente con jerarquía real (Alfredo).

## Estimación

Cambio backend (1 línea del query + 4 campos en el tipo) + nuevo
helper + ajuste del render del modal. Aproximadamente 1 sesión.
