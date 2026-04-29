import { useState, useEffect, useCallback } from 'react'
import type { SavedRouteDTO, SaveRoutePayload, LocalRoute, BotRouteDTO, GroupRouteDTO } from '@trailx/shared'
import type { RoutePoint } from '@trailx/shared'
import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { useMapStore } from '../store/useMapStore'
import {
  listSavedRoutes,
  listUserBotRoutes,
  listGroupRoutes,
  createSavedRoute,
  deleteSavedRoute as apiDeleteSavedRoute,
  deleteBotRoute as apiDeleteBotRoute,
} from '../services/api'

export interface UseSavedRoutesReturn {
  savedRoutes: SavedRouteDTO[]
  botRoutes: BotRouteDTO[]
  groupRoutes: GroupRouteDTO[]
  isLoading: boolean
  error: string | null
  isMigrating: boolean
  saveCurrentRoute: (name: string) => Promise<void>
  deleteRoute: (id: string) => Promise<void>
  deleteBotRoute: (id: string) => Promise<void>
  loadRoute: (route: SavedRouteDTO | LocalRoute | BotRouteDTO | GroupRouteDTO) => void
}

function normaliseBotWaypoints(raw: unknown[]): RoutePoint[] {
  const wps = raw as Array<{ lat: number; lng: number; label?: string; order: number }>
  const sorted = [...wps].sort((a, b) => a.order - b.order)
  return sorted.map((wp, i) => ({
    id: crypto.randomUUID(),
    lat: wp.lat,
    lng: wp.lng,
    label: wp.label,
    order: wp.order,
    type: (i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'intermediate') as RoutePoint['type'],
  }))
}

export function useSavedRoutes(): UseSavedRoutesReturn {
  const { isTMA } = usePlatform()
  const { webApp } = useTelegramWebApp()
  const authUser = useMapStore((s) => s.authUser)
  const debugSimulateAuth = useMapStore((s) => s.debugSimulateAuth)
  const profile = useMapStore((s) => s.profile)
  const routeResult = useMapStore((s) => s.routeResult)
  const waypoints = useMapStore((s) => s.waypoints)
  const { addLocalRoute, removeLocalRoute, clearLocalRoutes, setWaypoints, setAccountOpen } =
    useMapStore((s) => s.actions)

  const [savedRoutes, setSavedRoutes] = useState<SavedRouteDTO[]>([])
  const [botRoutes, setBotRoutes] = useState<BotRouteDTO[]>([])
  const [groupRoutes, setGroupRoutes] = useState<GroupRouteDTO[]>([])
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
  ]

  const mockBotRoutes: BotRouteDTO[] = [
    {
      id: 'mock-bot-route-1',
      name: 'Минск → Несвиж',
      waypoints: [
        { lat: 53.9045, lng: 27.5615, label: 'Минск (центр)', order: 0 },
        { lat: 53.2195, lng: 26.6820, label: 'Несвиж', order: 1 },
      ],
      distanceKm: 107.4,
      elevationM: 285,
      groupId: 'mock-group-1',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ]

  const mockGroupRoutes: GroupRouteDTO[] = [
    {
      id: 'mock-group-route-1',
      name: 'Велопоход по Налибокам',
      waypoints: [
        { lat: 53.6512, lng: 26.3240, label: 'Воложин', order: 0 },
        { lat: 53.6890, lng: 26.7140, label: 'Ивенец', order: 1 },
      ],
      distanceKm: null,
      elevationM: null,
      groupId: 'mock-group-2',
      groupChatId: '-1001234567890',
      isOwner: false,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ]

  function buildAuthHeader(): { 'x-telegram-initdata': string } | Record<string, never> {
    if (isTMA && webApp?.initData) {
      return { 'x-telegram-initdata': webApp.initData }
    }
    return {}
  }

  useEffect(() => {
    if (debugSimulateAuth) {
      setSavedRoutes(mockRoutes)
      setBotRoutes(mockBotRoutes)
      setGroupRoutes(mockGroupRoutes)
      setIsLoading(false)
      setIsMigrating(false)
      return
    }

    if (!authUser) {
      setSavedRoutes([])
      setBotRoutes([])
      setGroupRoutes([])
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function fetchAndMigrate() {
      try {
        const [savedResult, botResult, groupResult] = await Promise.allSettled([
          listSavedRoutes(buildAuthHeader()),
          listUserBotRoutes(buildAuthHeader()),
          listGroupRoutes(buildAuthHeader()),
        ])

        if (cancelled) return

        const saved = savedResult.status === 'fulfilled' ? savedResult.value : []
        const bot = botResult.status === 'fulfilled' ? botResult.value : []
        const group = groupResult.status === 'fulfilled' ? groupResult.value : []

        setSavedRoutes(saved)
        setBotRoutes(bot)
        setGroupRoutes(group)

        if (savedResult.status === 'rejected') {
          setError(savedResult.reason instanceof Error ? savedResult.reason.message : 'Failed to load routes')
        }

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

  const deleteBotRoute = useCallback(async (id: string) => {
    await apiDeleteBotRoute(id, buildAuthHeader())
    setBotRoutes((prev) => prev.filter((r) => r.id !== id))
  }, [isTMA, webApp])

  const loadRoute = useCallback((route: SavedRouteDTO | LocalRoute | BotRouteDTO | GroupRouteDTO) => {
    let points: RoutePoint[]

    if ('groupId' in route) {
      points = normaliseBotWaypoints(route.waypoints)
    } else {
      const wps = route.waypoints as Array<{
        id?: string
        lat: number
        lng: number
        order: number
        label?: string
        type?: 'start' | 'end' | 'intermediate'
      }>
      points = wps.map((wp) => ({
        id: wp.id ?? crypto.randomUUID(),
        lat: wp.lat,
        lng: wp.lng,
        order: wp.order ?? 0,
        type: wp.type ?? 'intermediate',
        label: wp.label,
      }))
    }

    setWaypoints(points)
    setAccountOpen(false)
  }, [setWaypoints, setAccountOpen])

  return { savedRoutes, botRoutes, groupRoutes, isLoading, error, isMigrating, saveCurrentRoute, deleteRoute, deleteBotRoute, loadRoute }
}
