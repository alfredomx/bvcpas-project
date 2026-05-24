// Tests del <IconRail> (v0.9.0).

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ICON_RAIL_ITEMS } from '../lib/icon-rail-items'
import { IconRail } from './icon-rail'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('<IconRail>', () => {
  it('renders every configured item with icon + label', () => {
    render(<IconRail />)

    const allItems = [
      ...ICON_RAIL_ITEMS.top,
      ...ICON_RAIL_ITEMS.pinned,
      ...ICON_RAIL_ITEMS.bottom,
    ]
    for (const item of allItems) {
      const node = screen.getByLabelText(item.label)
      expect(node).toBeInTheDocument()
      expect(node).toHaveTextContent(item.label)
    }
  })

  it('hides the PINNED separator when pinned group is empty', () => {
    render(<IconRail />)
    if (ICON_RAIL_ITEMS.pinned.length === 0) {
      expect(screen.queryByText(/^pinned$/i)).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(/^pinned$/i)).toBeInTheDocument()
    }
  })

  it('renders nav items as links pointing to their href', () => {
    render(<IconRail />)
    for (const item of ICON_RAIL_ITEMS.top) {
      if (!item.href) continue
      const link = screen.getByLabelText(item.label) as HTMLAnchorElement
      expect(link.tagName).toBe('A')
      expect(link.getAttribute('href')).toBe(item.href)
    }
  })
})
