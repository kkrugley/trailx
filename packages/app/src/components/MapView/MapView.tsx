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
import type { RoutePoint, POICategory } from '@trailx/shared'
import { POI_COLORS } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { useRoute } from '../../hooks/useRoute'
import { usePOISearch } from '../../hooks/usePOISearch'
import { MapContextMenu } from '../MapContextMenu/MapContextMenu'
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
const POI_LAYER_UNCLUSTERED = 'poi-unclustered'

export interface MapViewHandle {
  getMap: () => maplibregl.Map | null
  setStyle: (url: string) => void
}

/** Per-type color — applied via inline style so className mutations don't
 *  conflict with MapLibre v5 transform-based marker positioning. */
const TYPE_COLOR: Record<RoutePoint['type'], string> = {
  start: '#2a8f4a',
  end: '#c0392b',
  intermediate: '#4456b5',
}

/** Build a styled HTMLElement for a MapLibre Marker */
function buildMarkerEl(type: RoutePoint['type'], number: number): HTMLElement {
  const el = document.createElement('div')
  el.className = styles.marker
  el.style.color = TYPE_COLOR[type]
  const label = document.createElement('span')
  label.className = styles.markerLabel
  label.textContent = String(number)
  el.appendChild(label)
  return el
}

export const MapView = forwardRef<MapViewHandle>(function MapView(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null)

  const waypoints = useMapStore((s) => s.waypoints)
  const routeResult = useMapStore((s) => s.routeResult)
  const isRouting = useMapStore((s) => s.isRouting)
  const pois = useMapStore((s) => s.pois)
  const isSearchingPOI = useMapStore((s) => s.isSearchingPOI)
  useRoute()
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
        type: 'circle',
        source: POI_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'] as maplibregl.ExpressionSpecification,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
          'circle-opacity': 0.9,
        },
      })

      setMapReady(true)
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

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // ── Route polyline sync ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
    if (!source) return
    if (routeResult) {
      source.setData({ type: 'Feature', properties: {}, geometry: routeResult.geometry })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapReady, routeResult])

  // ── Waypoint marker sync ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const activeIds = new Set(waypoints.map((p) => p.id))
    for (const [id, marker] of markersRef.current) {
      if (!activeIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    waypoints.filter((p) => !isNaN(p.lat)).forEach((point, i) => {
      const number = i + 1
      const existing = markersRef.current.get(point.id)
      if (existing) {
        const span = existing.getElement().querySelector('span')
        if (span) span.textContent = String(number)
        // Update colour via inline style — avoids className mutation which causes
        // layout invalidation and position drift in MapLibre v5.
        existing.getElement().style.color = TYPE_COLOR[point.type]
        existing.setLngLat([point.lng, point.lat])
      } else {
        const el = buildMarkerEl(point.type, number)
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
        markersRef.current.set(point.id, marker)
      }
    })
  }, [mapReady, waypoints])

  // ── POI source sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource(POI_SOURCE) as GeoJSONSource | undefined
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: pois.map((poi) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
        properties: {
          id: poi.id, name: poi.name ?? '', category: poi.category,
          color: POI_COLORS[poi.category], osmId: poi.osmId, osmType: poi.osmType,
          tags: JSON.stringify(poi.tags), lat: poi.lat, lng: poi.lng,
        },
      })),
    })
  }, [mapReady, pois])

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
