// Tests TDD-first de useSidebarCollapsed (v0.3.0, Bloque 4c).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { SIDEBAR_COLLAPSED_KEY, useSidebarCollapsed } from './use-sidebar-collapsed'

describe('useSidebarCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('defaults to false (expanded) when no value in localStorage', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(false)
  })

  it('reads initial true from localStorage', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true')
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(true)
  })

  it('setCollapsed(true) updates state and persists in localStorage', () => {
    const { result } = renderHook(() => useSidebarCollapsed())

    act(() => {
      result.current.setCollapsed(true)
    })

    expect(result.current.collapsed).toBe(true)
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true')
  })

  it('setCollapsed(false) updates state and persists in localStorage', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true')
    const { result } = renderHook(() => useSidebarCollapsed())

    act(() => {
      result.current.setCollapsed(false)
    })

    expect(result.current.collapsed).toBe(false)
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('false')
  })
})
