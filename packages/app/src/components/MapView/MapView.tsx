import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import maplibregl, { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Fix for Vite production builds: MapLibre's default blob-URL worker gets
// corrupted by Vite's minifier (variables renamed, "Rt is not defined").
// Use the pre-built standalone CSP worker instead — Vite copies it as an
// asset and provides a stable URL, so the worker scope is self-contained.
setWorkerUrl(new URL(
  'maplibre-gl/dist/maplibre-gl-csp-worker.js',
  import.meta.url,
).href)
import type { GeoJSONSource } from 'maplibre-gl'
import type { POICategory } from '@trailx/shared'
import { POI_COLORS } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { usePOISearch } from '../../hooks/usePOISearch'
import { useMeasureSync } from '../../hooks/useMeasureSync'
import { MapContextMenu } from '../MapContextMenu/MapContextMenu'
import { generateWaypointIcon } from '../../utils/waypointIcon'
import { generatePOIIcon } from '../../utils/poiIcon'
import styles from './MapView.module.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

type MapStyle = string | maplibregl.StyleSpecification

function esriStyle(serviceUrl: string, attribution: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [`${serviceUrl}/tile/{z}/{y}/{x}`],
        tileSize: 256,
        attribution,
      },
    },
    layers: [{ id: 'esri-layer', type: 'raster', source: 'esri' }],
  }
}

const MAP_STYLES: Record<string, MapStyle> = {
  liberty:       'https://tiles.openfreemap.org/styles/liberty',
  bright:        'https://tiles.openfreemap.org/styles/bright',
  positron:      'https://tiles.openfreemap.org/styles/positron',
  esri_imagery:  esriStyle(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    '© Esri, Maxar, Earthstar Geographics',
  ),
  esri_topo:     esriStyle(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
    '© Esri, HERE, Garmin, © OpenStreetMap contributors',
  ),
}
const INITIAL_CENTER: [number, number] = [23.68, 52.09]
const INITIAL_ZOOM = 10
const ROUTE_SOURCE = 'route-line'
const ROUTE_LAYER = 'route-line-layer'
const HOVER_DOT_SOURCE = 'route-hover-dot'
const HOVER_DOT_LAYER = 'route-hover-dot-layer'
const HOVER_DOT_PULSE_LAYER = 'route-hover-dot-pulse-layer'
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

// Adds all custom sources and layers to the map. Called both on initial load
// and after every setStyle() — which wipes custom sources/layers entirely.
// The existence guard makes it safe to call multiple times (e.g. rapid style
// switches where two 'style.load' once-handlers fire for the same event).
function addCustomLayersAndSources(map: maplibregl.Map): void {
  if (map.getSource(ROUTE_SOURCE)) return

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

  // ── Route hover dot ──
  map.addSource(HOVER_DOT_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: HOVER_DOT_PULSE_LAYER,
    type: 'circle',
    source: HOVER_DOT_SOURCE,
    paint: {
      'circle-radius': 12,
      'circle-color': '#4456b5',
      'circle-opacity': 0.25,
      'circle-stroke-width': 0,
    },
  })
  map.addLayer({
    id: HOVER_DOT_LAYER,
    type: 'circle',
    source: HOVER_DOT_SOURCE,
    paint: {
      'circle-radius': 6,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#4456b5',
      'circle-stroke-width': 3,
      'circle-opacity': 1,
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
}

export const MapView = forwardRef<MapViewHandle>(function MapView(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  // mapVersion increments on every map load: 'load' on initial creation,
  // 'style.load' after each setStyle() call. Both paths call addCustomLayersAndSources
  // to re-add sources/layers that setStyle() wipes, then trigger data-sync effects.
  // mapReady (bool) is kept for UI-only checks (skeleton, context menu).
  const [mapVersion, setMapVersion] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null)

  const waypoints = useMapStore((s) => s.waypoints)
  const routeResult = useMapStore((s) => s.routeResult)
  const isRouting = useMapStore((s) => s.isRouting)
  const hoveredRoutePosition = useMapStore((s) => s.hoveredRoutePosition)
  const pois = useMapStore((s) => s.pois)
  const standalonePois = useMapStore((s) => s.standalonePois)
  const isSearchingPOI = useMapStore((s) => s.isSearchingPOI)
  usePOISearch()
  useMeasureSync(mapRef.current, mapVersion)

  const { setSelectedPOI, updateWaypoint, addIntermediateAt } = useMapStore((s) => s.actions)

  // Stable refs for imperative handlers
  const setSelectedPOIRef = useRef(setSelectedPOI)
  useEffect(() => { setSelectedPOIRef.current = setSelectedPOI }, [setSelectedPOI])

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    setStyle: (url: string) => {
      const map = mapRef.current
      if (!map) return
      map.once('style.load', () => {
        addCustomLayersAndSources(map)
        setMapVersion((v) => v + 1)
      })
      map.setStyle(url)
    },
  }))

  // ── Context menu (right-click + long-press) ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Desktop: right-click
    const contextMenuHandler = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      const rect = map.getCanvas().getBoundingClientRect()
      const rawX = rect.left + e.point.x
      const rawY = rect.top + e.point.y
      // Prevent menu from going off-screen (menu is ~210px wide, ~180px tall)
      const x = Math.min(rawX, window.innerWidth - 220)
      const y = Math.min(rawY, window.innerHeight - 200)
      setContextMenu({ lat: e.lngLat.lat, lng: e.lngLat.lng, x, y })
    }
    map.on('contextmenu', contextMenuHandler)

    // Mobile: long-press via pointer events on the canvas
    const canvas = map.getCanvas()
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressActive = false

    const cancelLongPress = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
      longPressActive = false
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // handled by contextmenu event
      longPressActive = false
      cancelLongPress()
      const startX = e.clientX
      const startY = e.clientY
      longPressTimer = setTimeout(() => {
        longPressActive = true
        const rect = canvas.getBoundingClientRect()
        const canvasX = startX - rect.left
        const canvasY = startY - rect.top
        const lngLat = map.unproject([canvasX, canvasY])
        const rawX = startX
        const rawY = startY
        const x = Math.min(rawX, window.innerWidth - 220)
        const y = Math.min(rawY, window.innerHeight - 200)
        setContextMenu({ lat: lngLat.lat, lng: lngLat.lng, x, y })
      }, 500)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      cancelLongPress()
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      if (longPressActive) {
        // Prevent the subsequent tap from being treated as a map click
        e.stopPropagation()
      }
      cancelLongPress()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', cancelLongPress)

    return () => {
      map.off('contextmenu', contextMenuHandler)
      cancelLongPress()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', cancelLongPress)
    }
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
      const { style: key } = (e as CustomEvent<{ style: string }>).detail
      const mapStyle = MAP_STYLES[key]
      if (!mapStyle || !mapRef.current) return
      const map = mapRef.current
      // Re-add custom sources/layers once the new style is ready, then bump
      // mapVersion so all data-sync effects re-populate the sources.
      // Registered BEFORE setStyle() to guarantee the listener is in place.
      map.once('style.load', () => {
        addCustomLayersAndSources(map)
        setMapVersion((v) => v + 1)
      })
      map.setStyle(mapStyle as string)
    }
    window.addEventListener('trailx:setstyle', handler)
    return () => window.removeEventListener('trailx:setstyle', handler)
  }, [])

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const savedStyle = MAP_STYLES[useMapStore.getState().appSettings.mapStyle] ?? STYLE_URL
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: savedStyle as maplibregl.StyleSpecification | string,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => {
      addCustomLayersAndSources(map)
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

  // ── Auto-fit route bounds ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapVersion === 0 || !routeResult) return

    const autoFit = useMapStore.getState().appSettings.autoFitRoute
    if (!autoFit) return

    const coords = routeResult.geometry.coordinates as number[][]
    if (coords.length === 0) return

    const bounds = coords.reduce(
      (b, c) => {
        b[0] = Math.min(b[0], c[0])
        b[1] = Math.min(b[1], c[1])
        b[2] = Math.max(b[2], c[0])
        b[3] = Math.max(b[3], c[1])
        return b
      },
      [Infinity, Infinity, -Infinity, -Infinity],
    )

    map.fitBounds(
      [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
      { padding: { top: 60, bottom: 200, left: 60, right: 60 }, maxZoom: 15, duration: 500 },
    )
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

  // ── Hover dot sync ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapVersion === 0) return
    const source = map.getSource(HOVER_DOT_SOURCE) as GeoJSONSource | undefined
    if (!source) return
    if (hoveredRoutePosition) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: hoveredRoutePosition },
      })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapVersion, hoveredRoutePosition])

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
