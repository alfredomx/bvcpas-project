// Configuración del icon rail.
//
// Por ahora solo se muestran items con `href` definida (navegan al
// hacer click). Los items con flyout (hover sin link) quedan para
// versiones futuras cuando las sub-rutas estén definidas. Si en algún
// momento queremos volver a mostrar items con flyout, basta con
// devolverlos al array correspondiente del export.

import {
  Home,
  LayoutGrid,
  LineChart,
  Plug,
  type LucideIcon,
} from 'lucide-react'

export interface IconRailItemFlyout {
  title: string
  items: string[]
}

export interface IconRailItemConfig {
  key: string
  label: string
  icon: LucideIcon
  /** Si está definido, el item navega a esta URL al hacer click. */
  href?: string
  /** Si está definido, hover sobre el item abre el flyout. */
  flyout?: IconRailItemFlyout
}

export interface IconRailGroups {
  top: IconRailItemConfig[]
  pinned: IconRailItemConfig[]
  bottom: IconRailItemConfig[]
}

export const ICON_RAIL_ITEMS: IconRailGroups = {
  top: [
    { key: 'home', label: 'Home', icon: Home, href: '/dashboard' },
    { key: 'connect', label: 'Connect', icon: Plug, href: '/connect' },
    { key: 'reports', label: 'Reports', icon: LineChart, href: '/reports' },
    { key: 'all-apps', label: 'All apps', icon: LayoutGrid, href: '/apps' },
  ],
  pinned: [],
  bottom: [],
}
