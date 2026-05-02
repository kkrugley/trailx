import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoutePermissions } from './useRoutePermissions'
import { useMapStore } from '../store/useMapStore'
import type { RouteSource } from '../store/useMapStore'

vi.mock('../store/useMapStore')

const mockUseMapStore = vi.mocked(useMapStore)

function setupSource(source: RouteSource | null) {
  mockUseMapStore.mockReturnValue(source as never)
  ;(mockUseMapStore as unknown as { mockImplementation: (fn: (sel: (s: { activeRouteSource: RouteSource | null }) => RouteSource | null) => RouteSource | null) => void }).mockImplementation(
    (sel: (s: { activeRouteSource: RouteSource | null }) => RouteSource | null) =>
      sel({ activeRouteSource: source }),
  )
}

describe('useRoutePermissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns canEdit=true when no source (new route)', () => {
    setupSource(null)
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(true)
    expect(result.current.source).toBeNull()
  })

  it('returns canEdit=true for local route (always owner)', () => {
    setupSource({ kind: 'local', isOwner: true })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(true)
  })

  it('returns canEdit=true for own saved route', () => {
    setupSource({ kind: 'saved', isOwner: true })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(true)
  })

  it('returns canEdit=false for session without editToken', () => {
    setupSource({ kind: 'session', isOwner: false })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(false)
  })

  it('returns canEdit=true for session with editToken (creator)', () => {
    setupSource({ kind: 'session', isOwner: true })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(true)
  })

  it('returns canEdit=false for group route when not owner', () => {
    setupSource({ kind: 'group', isOwner: false })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(false)
  })

  it('returns canEdit=true for group route when owner', () => {
    setupSource({ kind: 'group', isOwner: true })
    const { result } = renderHook(() => useRoutePermissions())
    expect(result.current.canEdit).toBe(true)
  })
})
