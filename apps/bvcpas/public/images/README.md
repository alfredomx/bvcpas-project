# public/images/

Assets estáticos servidos desde la raíz del sitio (`/images/...`).

## Estructura

- `brand/` — logos, isotipos, favicons del producto.
- (futuro) `clients/` — avatares de cliente cuando mapi los exponga.
- (futuro) `users/` — avatares de usuario cuando mapi los exponga.

## Cómo usar

Los archivos aquí se sirven desde la raíz del sitio. Para usar un logo:

```tsx
import Image from 'next/image'
;<Image src="/images/brand/logo.svg" alt="bvcpas" width={32} height={32} />
```

O directo en `<img>`:

```tsx
<img src="/images/brand/logo.svg" alt="bvcpas" />
```

## Naming

- Kebab-case: `logo.svg`, `logo-dark.svg`, `logo-mark.svg`.
- SVG > PNG cuando es posible.
- Si entran PNG/JPG, suffix `@2x` para retina si aplica.
