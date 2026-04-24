import { useState, useEffect, useCallback } from 'react'
import type { SavedRouteDTO, SaveRoutePayload, LocalRoute } from '@trailx/shared'
import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { useMapStore } from '../store/useMapStore'
import {
  listSavedRoutes,
  createSavedRoute,
  deleteSavedRoute as apiDeleteSavedRoute,
} from '../services/api'

export interface UseSavedRoutesReturn {
  savedRoutes: SavedRouteDTO[]
  isLoading: boolean
  error: string | null
  isMigrating: boolean
  saveCurrentRoute: (name: string) => Promise<void>
  deleteRoute: (id: string) => Promise<void>
  loadRoute: (route: SavedRouteDTO | LocalRoute) => void
}

export function useSavedRoutes(): UseSavedRoutesReturn {
  const { isTMA } = usePlatform()
  const { webApp } = useTelegramWebApp()
  const authUser = useMapStore((s) => s.authUser)
  const debugSimulateAuth = useMapStore((s) => s.debugSimulateAuth)
  const profile = useMapStore((s) => s.profile)
  const routeResult = useMapStore((s) => s.routeResult)
  const waypoints = useMapStore((s) => s.waypoints)
  const { addLocalRoute, removeLocalRoute, clearLocalRoutes, clearRoute, addWaypoint, setAccountOpen } =
    useMapStore((s) => s.actions)

  const [savedRoutes, setSavedRoutes] = useState<SavedRouteDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock routes for debug simulation
  const mockRoutes: SavedRouteDTO[] = [
    {
      id: 'mock-route-1',
      name: 'Test Route: Minsk Center',
      waypoints: [
        { id: 'wp1', lat: 53.9045, lng: 27.5615, order: 0, type: 'start', label: 'Independence Square' },
        { id: 'wp2', lat: 53.8983, lng: 27.5487, order: 1, type: 'intermediate', label: 'Victory Park' },
        { id: 'wp3', lat: 53.9115, lng: 27.5956, order: 2, type: 'end', label: 'Gorky Park' },
      ],
      distanceKm: 8.5,
      elevationM: 45,
      profileId: 'bike',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'mock-route-2',
      name: 'Morning Ride: Lakes Loop',
      waypoints: [
        { id: 'wp4', lat: 53.8891, lng: 27.6748, order: 0, type: 'start', label: 'Zaslonava' },
        { id: 'wp5', lat: 53.8765, lng: 27.7210, order: 1, type: 'intermediate', label: 'Water Reservoir' },
        { id: 'wp6', lat: 53.8891, lng: 27.6748, order: 2, type: 'end', label: 'Zaslonava' },
      ],
      distanceKm: 12.3,
      elevationM: 78,
      profileId: 'racingbike',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'mock-route-3',
      name: 'Weekend MTB Trail',
      waypoints: [
        { id: 'wp7', lat: 53.9342, lng: 27.5934, order: 0, type: 'start', label: 'Forest Entrance' },
        { id: 'wp8', lat: 53.9456, lng: 27.6123, order: 1, type: 'intermediate', label: 'Lake View' },
        { id: 'wp9', lat: 53.9512, lng: 27.6345, order: 2, type: 'intermediate', label: 'Hill Top' },
        { id: 'wp10', lat: 53.9342, lng: 27.5934, order: 3, type: 'end', label: 'Forest Exit' },
      ],
      distanceKm: 18.7,
      elevationM: 156,
      profileId: 'mtb',
      createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ]

  function buildAuthHeader(): { 'x-telegram-initdata': string } | Record<string, never> {
    if (isTMA && webApp?.initData) {
      return { 'x-telegram-initdata': webApp.initData }
    }
    return {}
  }

  useEffect(() => {
    // Return mock routes for debug simulation
    if (debugSimulateAuth) {
      setSavedRoutes(mockRoutes)
      setIsLoading(false)
      setIsMigrating(false)
      return
    }

    if (!authUser) {
      setSavedRoutes([])
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function fetchAndMigrate() {
      try {
        const routes = await listSavedRoutes(buildAuthHeader())
        if (cancelled) return
        setSavedRoutes(routes)

        // Post-login migration: push local routes to server
        const snapshot = useMapStore.getState().localRoutes
        if (snapshot.length > 0) {
          setIsMigrating(true)
          for (const lr of snapshot) {
            const payload: SaveRoutePayload = {
              name: lr.name,
              waypoints: lr.waypoints,
              profileId: profile,
            }
            try {
              const created = await createSavedRoute(payload, buildAuthHeader())
              if (!cancelled) setSavedRoutes((prev) => [...prev, created])
            } catch {
              // Best-effort: skip failed migrations
            }
          }
          if (!cancelled) {
            clearLocalRoutes()
            setIsMigrating(false)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load routes')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

  void fetchAndMigrate()
  return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, debugSimulateAuth])

  const saveCurrentRoute = useCallback(async (name: string) => {
    const resolvedWaypoints = waypoints.filter((w) => !isNaN(w.lat))

    if (!authUser) {
      const localRoute: LocalRoute = {
        id: crypto.randomUUID(),
        name,
        waypoints: resolvedWaypoints,
        createdAt: new Date().toISOString(),
      }
      addLocalRoute(localRoute)
      return
    }

    const elevGain = routeResult
      ? routeResult.elevation.reduce((acc, v, i, arr) =>
          i > 0 && v > arr[i - 1] ? acc + (v - arr[i - 1]) : acc, 0)
      : undefined

    const payload: SaveRoutePayload = {
      name,
      waypoints: resolvedWaypoints,
      distanceKm: routeResult ? routeResult.distance / 1000 : undefined,
      elevationM: elevGain,
      profileId: profile,
    }

    const created = await createSavedRoute(payload, buildAuthHeader())
    setSavedRoutes((prev) => [created, ...prev])
  }, [authUser, waypoints, routeResult, profile, isTMA, webApp, addLocalRoute])

  const deleteRoute = useCallback(async (id: string) => {
    if (!authUser) {
      removeLocalRoute(id)
      return
    }
    await apiDeleteSavedRoute(id, buildAuthHeader())
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id))
  }, [authUser, isTMA, webApp, removeLocalRoute])

  const loadRoute = useCallback((route: SavedRouteDTO | LocalRoute) => {
    clearRoute()
    const wps = route.waypoints as Array<{ id: string; lat: number; lng: number; order: number; label?: string; type: 'start' | 'end' | 'intermediate' }>
    for (const wp of wps) {
      addWaypoint({ id: wp.id ?? crypto.randomUUID(), lat: wp.lat, lng: wp.lng, order: wp.order ?? 0, type: wp.type ?? 'intermediate', label: wp.label })
    }
    setAccountOpen(false)
  }, [clearRoute, addWaypoint, setAccountOpen])

  return { savedRoutes, isLoading, error, isMigrating, saveCurrentRoute, deleteRoute, loadRoute }
}
