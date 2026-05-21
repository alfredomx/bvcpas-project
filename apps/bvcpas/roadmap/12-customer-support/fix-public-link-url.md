# fix — Public link copia URL del frontend, no de la API

## Problema

En `dashboard/clients/:id/uncategorized-transactions`, panel
**Configure → Public link**, el `<Input readOnly>` y el botón `Copy`
muestran/copian `publicLink.url` que viene del backend con la forma:

```
https://dev.alfredo.mx/v1/public/uncats/<token>
```

Esa es la URL del **endpoint público de mapi**, no la pantalla
pública del frontend. Si se manda al cliente final, llega a JSON crudo
en el navegador.

La pantalla pública (v0.8.0) vive en:

```
http://localhost:3000/p/uncats/<token>    (dev)
https://<host>/p/uncats/<token>           (prod)
```

## Cambio

El backend ya devuelve `public_link.token`. El frontend arma la URL
pública con el origin del propio cliente:

```ts
const publicUrl = `${window.location.origin}/p/uncats/${publicLink.token}`
```

Se reemplaza el uso de `publicLink.url` en `cs-config-sheet.tsx`
(input + botón Copy) por `publicUrl`. El campo `url` que devuelve
mapi queda ignorado por el frontend — sigue existiendo en el DTO,
solo no se renderiza ni se copia.

Como `window` no existe en SSR, se calcula la URL en un `useEffect`
(o solo dentro de handlers) y se guarda en state. Mientras carga, el
input muestra string vacío (es un componente `'use client'`, así que
en la práctica el primer render ya tiene window disponible — pero el
guard evita un crash si algo cambia).

## Out of scope

- Cambiar `public_link.url` en el backend.
- Soporte para deploys con sub-paths.
- Botón "Open link" — solo Copy basta.

## Criterios de aceptación

1. Abrir Configure → Public link, el input muestra
   `<origin>/p/uncats/<token>`.
2. Copy copia esa misma URL al portapapeles.
3. Regenerate genera un token nuevo y el input se actualiza con
   la URL nueva (mismo origin).
4. Si no hay public link, sigue mostrando "No link generated yet"
   (no cambia ese flujo).
