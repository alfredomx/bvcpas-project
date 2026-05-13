# fix — Wheel scroll dentro del combobox de cuentas QBO

## Problema

En el `<TxDetailModal>`, el popover del combobox **Category /
account** no permite scroll con la rueda del mouse. Las flechas
arriba/abajo del teclado sí funcionan, pero la rueda no.

Causa probable: Radix `<Dialog>` instala un bloqueo de scroll global
mientras está abierto. El popover renderiza en un portal, pero
shadcn `Command` re-emite los eventos wheel al body bloqueado y por
eso no se hace scroll en el `<CommandList>` (que tiene
`max-h-[300px] overflow-y-auto`).

Aplica a cualquier combobox shadcn embebido en un Dialog — no solo
al de cuentas QBO.

## Cambio

En `src/components/ui/command.tsx`, añadir un handler `onWheel`
en `<CommandList>` que detenga la propagación del evento. El scroll
nativo del contenedor sigue funcionando (no se llama
`preventDefault`), solo se evita que Radix lo intercepte arriba.

```tsx
function CommandList({ className, onWheel, ...props }) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
        className,
      )}
      onWheel={(e) => {
        e.stopPropagation()
        onWheel?.(e)
      }}
      {...props}
    />
  )
}
```

El handler propio se mantiene componible: si alguien pasa `onWheel`
desde afuera, se sigue ejecutando después del `stopPropagation`.

## Out of scope

- Cambiar a un combobox custom (sin cmdk) — overkill.
- Tocar el `<Dialog>` o sus modal locks — afectaría a otros usuarios
  del primitive.

## Criterios de aceptación

1. Abrir el modal de una transacción → abrir el combobox → la rueda
   del mouse hace scroll dentro de la lista de cuentas.
2. Las flechas del teclado siguen funcionando como antes.
3. Aplica a cualquier `<CommandList>` dentro de cualquier `<Dialog>`,
   no solo al de cuentas QBO.

## Notas

- No hay test unitario directo: jsdom no simula el bloqueo de scroll
  de Radix de la misma forma que el browser. Validación manual basta.
