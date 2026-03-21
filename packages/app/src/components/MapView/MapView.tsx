import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource } from 'maplibre-gl'
import type { POICategory } from '@trailx/shared'
import { POI_COLORS } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { usePOISearch } from '../../hooks/usePOISearch'
import { MapContextMenu } from '../MapContextMenu/MapContextMenu'
import { generateWaypointIcon } from '../../utils/waypointIcon'
import { generatePOIIcon } from '../../utils/poiIcon'
import styles from './MapView.module.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

const MAP_STYLE_URLS: Record<string, string> = {
  liberty:  'https://tiles.openfreemap.org/styles/liberty',
  bright:   'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
}
const INITIAL_CENTER: [number, number] = [23.68, 52.09]
const INITIAL_ZOOM = 10
const ROUTE_SOURCE = 'route-line'
const ROUTE_LAYER = 'route-line-layer'
const POI_SOURCE = 'poi-source'
const POI_LAYER_CLUSTERS = 'poi-clusters'
const POI_LAYER_CLUSTER_COUNT = 'poi-cluster-count'
const POI_LAYER_UNCLUSTERED = 'poi-unclustered' // kept for click/hover handler name compat

function ensurePOIIcon(map: maplibregl.Map, category: string, color: string, saved: boolean): string {
  const id = `poi-${category}${saved ? '-saved' : ''}`
  if (!map.hasImage(id)) {
    const img = generatePOIIcon(color, category, saved)
    map.addImage(id, img, { pixelRatio: 2 })
  }
  return id
}

export interface MapViewHandle {
  getMap: () => maplibregl.Map | null
  setStyle: (url: string) => void
}

const WP_SOURCE = 'route-waypoints'
const WP_LAYER = 'route-waypoints-layer'

const TYPE_COLOR: Record<string, string> = {
  start: '#2a8f4a',
  end: '#c0392b',
  intermediate: '#4456b5',
}

function ensureWaypointIcon(map: maplibregl.Map, type: string, number: number): string {
  const id = `wp-${type}-${number}`
  if (!map.hasImage(id)) {
    const img = generateWaypointIcon(TYPE_COLOR[type] ?? '#4456b5', number)
    map.addImage(id, img, { pixelRatio: 2 })
  }
  return id
}

export const MapView = forwardRef<MapViewHandle>(function MapView(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  // mapVersion increments on every map 'load' event (initial load AND after setStyle).
  // Effects that depend on map sources use mapVersion so they re-run after style reloads,
  // which wipe all custom sources/layers. mapReady (bool) is kept for UI-only checks.
  const [mapVersion, setMapVersion] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null)

  const waypoints = useMapStore((s) => s.waypoints)
  const routeResult = useMapStore((s) => s.routeResult)
  const isRouting = useMapStore((s) => s.isRouting)
  const pois = useMapStore((s) => s.pois)
  const standalonePois = useMapStore((s) => s.standalonePois)
  const isSearchingPOI = useMapStore((s) => s.isSearchingPOI)
  usePOISearch()

  const { setSelectedPOI, updateWaypoint, addIntermediateAt } = useMapStore((s) => s.actions)

  // Stable refs for imperative handlers
  const setSelectedPOIRef = useRef(setSelectedPOI)
  useEffect(() => { setSelectedPOIRef.current = setSelectedPOI }, [setSelectedPOI])  // eslint-disable-line

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    setStyle: (url: string) => mapRef.current?.setStyle(url),
  }))

  // ── Context menu (right-click) ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const handler = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      const rect = map.getCanvas().getBoundingClientRect()
      const rawX = rect.left + e.point.x
      const rawY = rect.top + e.point.y
      // Prevent menu from going off-screen (menu is ~210px wide, ~180px tall)
      const x = Math.min(rawX, window.innerWidth - 220)
      const y = Math.min(rawY, window.innerHeight - 200)
      setContextMenu({ lat: e.lngLat.lat, lng: e.lngLat.lng, x, y })
    }
    map.on('contextmenu', handler)
    return () => { map.off('contextmenu', handler) }
  }, [mapReady])

  // ── FlyTo command ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng } = (e as CustomEvent<{ lat: number; lng: number }>).detail
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 })
    }
    window.addEventListener('trailx:flyto', handler)
    return () => window.removeEventListener('trailx:flyto', handler)
  }, [])

  // ── Set style command ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { style } = (e as CustomEvent<{ style: string }>).detail
      const url = MAP_STYLE_URLS[style]
      if (url) mapRef.current?.setStyle(url)
    }
    window.addEventListener('trailx:setstyle', handler)
    return () => window.removeEventListener('trailx:setstyle', handler)
  }, [])

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => {
      // ── Route polyline ──
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#4456b5',
          'line-width': 5,
          'line-opacity': 0.9,
        },
      })

      // ── POI source (clustered) ──
      map.addSource(POI_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      map.addLayer({
        id: POI_LAYER_CLUSTERS,
        type: 'circle',
        source: POI_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#4456b5',
          'circle-opacity': 0.85,
          'circle-stroke-color': 'rgba(255,255,255,0.7)',
          'circle-stroke-width': 1.5,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14, 10, 18, 50, 22,
          ] as maplibregl.ExpressionSpecification,
        },
      })

      map.addLayer({
        id: POI_LAYER_CLUSTER_COUNT,
        type: 'symbol',
        source: POI_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 11,
        },
        paint: { 'text-color': '#ffffff' },
      })

      map.addLayer({
        id: POI_LAYER_UNCLUSTERED,
        type: 'symbol',
        source: POI_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon'] as maplibregl.ExpressionSpecification,
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-anchor': 'center',
        },
      })

      // ── Waypoint markers (symbol layer) ──
      map.addSource(WP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: WP_LAYER,
        type: 'symbol',
        source: WP_SOURCE,
        layout: {
          'icon-image': ['get', 'icon'] as maplibregl.ExpressionSpecification,
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom',
          'icon-ignore-placement': true,
        },
      })

      setMapReady(true)
      setMapVersion((v) => v + 1)
    })

    // POI click: open POICard
    map.on('click', POI_LAYER_UNCLUSTERED, (e) => {
      if (!e.features?.[0]) return
      const f = e.features[0]
      const p = f.properties as {
        id: string; name: string; category: string; color: string
        osmId: number; osmType: string; tags: string; lat: number; lng: number
      }
      setSelectedPOIRef.current({
        id: p.id, lat: p.lat, lng: p.lng,
        name: p.name || undefined,
        category: p.category as POICategory,
        osmId: p.osmId,
        osmType: p.osmType as 'node' | 'way' | 'relation',
        tags: JSON.parse(p.tags) as Record<string, string>,
      })
    })

    map.on('mouseenter', POI_LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', POI_LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', POI_LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', POI_LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', WP_LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', WP_LAYER, () => { map.getCanvas().style.cursor = '' })

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      setMapReady(false)
      setMapVersion(0)
    }
  }, [])

  // ── Route polyline sync ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapVersion === 0) return
    const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
    if (!source) return
    if (routeResult) {
      source.setData({ type: 'Feature', properties: {}, geometry: routeResult.geometry })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapVersion, routeResult])

  // ── Waypoint marker sync ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapVersion === 0) return
    const source = map.getSource(WP_SOURCE) as GeoJSONSource | undefined
    if (!source) return

    const features = waypoints
      .filter((p) => !isNaN(p.lat))
      .map((point, i) => {
        const iconId = ensureWaypointIcon(map, point.type, i + 1)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
          properties: { id: point.id, icon: iconId, number: i + 1, type: point.type },
        }
      })

    source.setData({ type: 'FeatureCollection', features })
  }, [mapVersion, waypoints])

  // ── POI source sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapVersion === 0) return
    const source = map.getSource(POI_SOURCE) as GeoJSONSource | undefined
    if (!source) return
    const savedIds = new Set(standalonePois.map((p) => p.id))
    source.setData({
      type: 'FeatureCollection',
      features: pois.map((poi) => {
        const saved = savedIds.has(poi.id)
        const icon = ensurePOIIcon(map, poi.category, POI_COLORS[poi.category], saved)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
          properties: {
            id: poi.id, name: poi.name ?? '', category: poi.category,
            color: POI_COLORS[poi.category], osmId: poi.osmId, osmType: poi.osmType,
            tags: JSON.stringify(poi.tags), lat: poi.lat, lng: poi.lng,
            icon,
          },
        }
      }),
    })
  }, [mapVersion, pois, standalonePois])

  function handleContextSetStart() {
    if (!contextMenu) return
    const label = `${contextMenu.lat.toFixed(5)}, ${contextMenu.lng.toFixed(5)}`
    const start = useMapStore.getState().waypoints.find((p) => p.type === 'start')
    if (start) updateWaypoint(start.id, contextMenu.lat, contextMenu.lng, label)
  }

  function handleContextAddIntermediate() {
    if (!contextMenu) return
    addIntermediateAt(contextMenu.lat, contextMenu.lng)
  }

  function handleContextSetEnd() {
    if (!contextMenu) return
    const label = `${contextMenu.lat.toFixed(5)}, ${contextMenu.lng.toFixed(5)}`
    const pts = useMapStore.getState().waypoints
    const end = pts.find((p) => p.type === 'end') ?? pts[pts.length - 1]
    if (end) updateWaypoint(end.id, contextMenu.lat, contextMenu.lng, label)
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={`${styles.skeleton} ${mapReady ? styles.skeletonHidden : ''}`} />
      {isRouting && (
        <div className={styles.spinnerOverlay}>
          <span className={styles.spinner} />
          Building route…
        </div>
      )}
      {isSearchingPOI && !isRouting && (
        <div className={styles.spinnerOverlay}>
          <span className={styles.spinner} />
          Searching POI…
        </div>
      )}
      {contextMenu && (
        <MapContextMenu
          lat={contextMenu.lat}
          lng={contextMenu.lng}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSetStart={handleContextSetStart}
          onAddIntermediate={handleContextAddIntermediate}
          onSetEnd={handleContextSetEnd}
        />
      )}
    </div>
  )
})
