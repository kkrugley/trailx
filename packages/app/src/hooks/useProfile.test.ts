import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfile } from './useProfile'
import { useMapStore } from '../store/useMapStore'

beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState())
})

describe('useProfile', () => {
  it('returns default profile "bike"', () => {
    const { result } = renderHook(() => useProfile())
    expect(result.current.profile).toBe('bike')
  })

  it('setProfile updates the profile in the store', () => {
    const { result } = renderHook(() => useProfile())
    act(() => { result.current.setProfile('mtb') })
    expect(result.current.profile).toBe('mtb')
  })

  it('supports all valid RoutingProfile values', () => {
    const profiles = ['foot', 'bike', 'mtb', 'racingbike'] as const
    const { result } = renderHook(() => useProfile())

    for (const p of profiles) {
      act(() => { result.current.setProfile(p) })
      expect(result.current.profile).toBe(p)
    }
  })

  it('profile change is reflected immediately (reactive)', () => {
    const { result } = renderHook(() => useProfile())
    expect(result.current.profile).toBe('bike')

    act(() => { result.current.setProfile('racingbike') })
    expect(result.current.profile).toBe('racingbike')

    act(() => { result.current.setProfile('foot') })
    expect(result.current.profile).toBe('foot')
  })
})
