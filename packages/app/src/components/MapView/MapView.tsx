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
import type { RoutePoint } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { useRoute } from '../../hooks/useRoute'
import styles from './MapView.module.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const INITIAL_CENTER: [number, number] = [23.68, 52.09]
const INITIAL_ZOOM = 10
const ROUTE_SOURCE = 'route-line'
const ROUTE_LAYER = 'route-line-layer'

export interface MapViewHandle {
  getMap: () => maplibregl.Map | null
}

/** Build a styled HTMLElement for a MapLibre Marker */
function buildMarkerEl(type: RoutePoint['type'], number: number): HTMLElement {
  const el = document.createElement('div')
  el.className = `${styles.marker} ${styles[type]}`
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
  const [showRateLimit, setShowRateLimit] = useState(false)

  const waypoints = useMapStore((s) => s.waypoints)
  const routeResult = useMapStore((s) => s.routeResult)
  const isRouting = useMapStore((s) => s.isRouting)
  const { addWaypoint } = useRoute()

  // Stable ref for the click handler
  const addWaypointRef = useRef(addWaypoint)
  useEffect(() => { addWaypointRef.current = addWaypoint }, [addWaypoint])

  useImperativeHandle(ref, () => ({ getMap: () => mapRef.current }))

  // ── Rate-limit toast ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setShowRateLimit(true)
      setTimeout(() => setShowRateLimit(false), 4000)
    }
    window.addEventListener('trailx:ratelimit', handler)
    return () => window.removeEventListener('trailx:ratelimit', handler)
  }, [])

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })

    mapRef.current = map

    map.on('load', () => {
      // Route polyline source + layer (empty geometry initially)
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
          'line-color': '#2481cc',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      })

      setMapReady(true)
    })

    map.on('click', (e) => {
      addWaypointRef.current(e.lngLat.lat, e.lngLat.lng)
    })

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
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: routeResult.geometry,
      })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapReady, routeResult])

  // ── Marker sync ───────────────────────────────────────────────────────────
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

    waypoints.forEach((point, i) => {
      const number = i + 1
      const existing = markersRef.current.get(point.id)

      if (existing) {
        const span = existing.getElement().querySelector('span')
        if (span) span.textContent = String(number)
        existing.getElement().className = `${styles.marker} ${styles[point.type]}`
      } else {
        const el = buildMarkerEl(point.type, number)
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
        markersRef.current.set(point.id, marker)
      }
    })
  }, [mapReady, waypoints])

  return (
    <div ref={containerRef} className={styles.container}>
      {isRouting && (
        <div className={styles.spinnerOverlay}>
          <span className={styles.spinner} />
          Строю маршрут…
        </div>
      )}
      {showRateLimit && (
        <div className={styles.toast}>
          Лимит GraphHopper исчерпан. Введите свой API ключ.
        </div>
      )}
    </div>
  )
})
