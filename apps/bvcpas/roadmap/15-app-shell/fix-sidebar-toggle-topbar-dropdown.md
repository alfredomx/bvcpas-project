# fix — Sidebar ↔ Topbar dropdown de clientes

## Problema

Hoy el sidebar lateral con la lista de clientes ocupa 288px fijos a la
izquierda. El botón `«` lo colapsa a una barra angosta vertical (48px)
con un `»` para volver a expandir. El estado intermedio (sidebar
angosto) no aporta — sigue ocupando espacio sin mostrar info útil.

## Cambio

Reemplazar el toggle por dos modos limpios, sin estado intermedio:

### Modo A — Sidebar (default actual)

Como hoy, pero:
- Reemplazar el botón `« ChevronsLeft` por **`↑ ChevronUp`**.
- Click → cambia a Modo B. La lista lateral desaparece completamente
  (no queda barra angosta).

### Modo B — Topbar dropdown

- Sidebar oculto, `<main>` ocupa el ancho completo.
- En `<Topbar>`, a la derecha del logo `bvcpas`, aparece un botón
  estilo "select" mostrando el cliente activo:

  ```
  [Arcmen Engineering Electric...  ▾]
  ```

  Width fija (~280px), texto truncado con ellipsis.
- Click → abre un `<Popover>` debajo del botón con:
  - `<Input>` de búsqueda con ícono lupa.
  - Lista filtrable de clientes (virtualizada igual que la sidebar).
  - Click en cliente → navega a su uncats + cierra popover.
- Al lado del dropdown, un botón ícono (mismo lugar visual donde
  estaba `↑` en Modo A) con **`↓ ChevronDown`**. Click → vuelve a
  Modo A (sidebar visible, dropdown oculto).

## Estado persistente

El modo (`'sidebar' | 'topbar'`) se guarda en `localStorage` con la
misma key actual `bvcpas.sidebarCollapsed`. Renombro el hook a
`useSidebarMode` (export del helper viejo se reemplaza). Valores:
- `false` (default) → modo `sidebar`.
- `true` → modo `topbar`.

(Compatible con el bool actual — para no migrar localStorage de
usuarios existentes con la cookie ya seteada.)

## Cambios concretos

- `src/modules/15-app-shell/hooks/use-sidebar-collapsed.ts` — sin
  cambios estructurales (sigue devolviendo `collapsed: bool` +
  `setCollapsed`). La semántica del `true` ahora es "modo topbar".
- `src/modules/15-app-shell/components/sidebar.tsx`:
  - Botón superior cambia de `ChevronsLeft` a `ChevronUp`.
  - Cuando `collapsed === true` ya no renderiza
    `<SidebarCollapsed>`, devuelve `null`.
- `src/modules/15-app-shell/components/sidebar-collapsed.tsx` →
  **borrar archivo + test**.
- `src/modules/15-app-shell/components/topbar.tsx`:
  - Cuando `mode === 'topbar'`, renderiza:
    - Logo `bvcpas`.
    - `<ClientPickerDropdown>` (nuevo).
    - Botón `↓ ChevronDown` para volver a modo sidebar.
  - Cuando `mode === 'sidebar'`, sin dropdown ni botón
    (queda solo el logo y lo demás que ya tenga el topbar).
- `src/modules/15-app-shell/components/client-picker-dropdown.tsx` —
  componente nuevo. Recibe `clients`, `activeClientId`,
  `onSelect`. Usa `<Popover>` shadcn + `<Input>` + lista virtualizada
  (reusa el patrón de `Sidebar`).

## Out of scope

- Recently viewed.
- "Back to practice" link.
- Atajos de teclado.
- Animaciones de transición entre modos.

## Criterios de aceptación

1. Default: sidebar visible (como hoy). Botón superior `↑`.
2. Click en `↑` → sidebar desaparece + topbar muestra dropdown
   con el cliente activo. Click en el dropdown → popover con
   buscador y lista. Botón al lado del dropbox `↓` vuelve al modo
   sidebar.
3. Recargar la página mantiene el modo elegido.
4. La barra angosta vertical antigua ya no aparece nunca.
5. Buscar en el dropdown filtra igual que la sidebar (case
   insensitive, sustring de `legal_name`).
6. Click en un cliente del dropdown navega a su uncats y cierra el
   popover.
7. Tests:
   - `client-picker-dropdown.test.tsx`: render, busca, selecciona,
     cierra.
   - `sidebar.test.tsx`: actualizar — `collapsed === true` →
     componente no renderiza nada.
   - `topbar.test.tsx`: en modo topbar muestra dropdown + botón;
     en modo sidebar no.
