# fix — Sidebar toggle se sincroniza instante + popover ya no abre en blanco

## Problemas

### 1. Toggle requiere refresh
El botón en sidebar y el botón en topbar comparten estado via
`useSidebarCollapsed` (localStorage), pero cada instancia del hook
tiene su propio `useState`. Al hacer click, solo el componente que
disparó la mutación actualiza su state local — el otro queda
desfasado hasta el siguiente refresh (cuando re-lee localStorage).

El `useEffect` con `storage` event solo cubre cambios entre tabs
distintos, no entre componentes del mismo tab.

### 2. ClientPickerDropdown popover en blanco al abrir
Cuando el popover abre por primera vez, el `useVirtualizer` calcula
los rangos con `scrollRef.current === null` (el ref aún no está
montado al primer render). `getVirtualItems()` devuelve array vacío.
Al teclear cualquier letra, el componente re-renderiza con el ref ya
montado y aparecen los items.

## Fix

### 1. Broadcast del toggle entre hooks del mismo tab

`use-sidebar-collapsed.ts`:
- En `setCollapsed`: además de escribir localStorage, despachar un
  `CustomEvent('bvcpas:sidebar-toggle', { detail: value })`.
- En el `useEffect`: añadir listener del custom event en paralelo al
  `storage` que ya existe.

Patrón ya usado en el proyecto (`auth:unauthorized` en
`lib/api/client.ts`).

### 2. Forzar re-render del virtualizer al abrir el popover

`client-picker-dropdown.tsx`:
- Pasar `key={open ? 'open' : 'closed'}` al div con `ref={scrollRef}`.
  Cuando `open` cambia a `true`, React monta de cero ese subtree,
  el ref queda asignado antes del primer `getVirtualItems()`.
- Alternativa rechazada: forzar un `setState` con `useEffect` en
  `open`. Más código y menos directo.

## Out of scope

- Migrar el state a Zustand/Context.
- Animaciones del popover.

## Criterios de aceptación

1. Click en `↑` del sidebar → desaparece la sidebar y aparece el
   dropdown en el topbar al instante. Sin refresh.
2. Click en `↓` del topbar → desaparece el dropdown y aparece la
   sidebar al instante.
3. Cambio en localStorage desde otro tab sigue funcionando.
4. Abrir el dropdown muestra todos los clientes sin teclear nada.
5. Buscar / cerrar / volver a abrir funciona igual.
