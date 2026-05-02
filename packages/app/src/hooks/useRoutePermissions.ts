import { useMapStore, type RouteSource } from '../store/useMapStore'

export interface RoutePermissions {
  canEdit: boolean
  source: RouteSource | null
}

export function useRoutePermissions(): RoutePermissions {
  const source = useMapStore((s) => s.activeRouteSource)
  if (!source) return { canEdit: true, source: null }
  return { canEdit: source.isOwner, source }
}
