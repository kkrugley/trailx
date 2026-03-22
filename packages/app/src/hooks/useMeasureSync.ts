import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMapStore } from '../store/useMapStore'
import type { MeasureSession } from '../store/useMapStore'

const SRC_LINES  = 'measure-lines'
const SRC_POINTS = 'measure-points'
const SRC_HOVER  = 'measure-hover'
const LYR_LINE   = 'measure-line-layer'
const LYR_POINTS = 'measure-points-layer'
const LYR_HOVER  = 'measure-hover-layer'
const HIT_PX     = 12

function buildLines(sessions: MeasureSession[]) {
  return {
    type: 'FeatureCollection' as const,
    features: sessions
      .filter((s) => s.nodes.length >= 2)
      .map((s) => ({
        type: 'Feature' as const,
        properties: { id: s.id, color: s.color },
        geometry: { type: 'LineString' as const, coordinates: s.nodes },
      })),
  }
}

function buildPoints(sessions: MeasureSession[]) {
  return {
    type: 'FeatureCollection' as const,
    features: sessions.flatMap((s) =>
      s.nodes.map((node, i) => ({
        type: 'Feature' as const,
        properties: { sessionId: s.id, nodeIndex: i, color: s.color },
        geometry: { type: 'Point' as const, coordinates: node },
      }))
    ),
  }
}

function addLayers(map: maplibregl.Map) {
  const empty = { type: 'FeatureCollection' as const, features: [] }
  map.addSource(SRC_LINES,  { type: 'geojson', data: empty })
  map.addSource(SRC_POINTS, { type: 'geojson', data: empty })
  map.addSource(SRC_HOVER,  { type: 'geojson', data: empty })

  map.addLayer({
    id: LYR_LINE, type: 'line', source: SRC_LINES,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [4, 3] },
  })
  map.addLayer({
    id: LYR_POINTS, type: 'circle', source: SRC_POINTS,
    paint: {
      'circle-radius': 6,
      'circle-color': '#ffffff',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2.5,
    },
  })
  map.addLayer({
    id: LYR_HOVER, type: 'circle', source: SRC_HOVER,
    paint: {
      'circle-radius': 10,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2.5,
      'circle-opacity': 0.15,
    },
  })
}

function removeLayers(map: maplibregl.Map) {
  for (const l of [LYR_HOVER, LYR_POINTS, LYR_LINE]) {
    if (map.getLayer(l)) map.removeLayer(l)
  }
  for (const s of [SRC_HOVER, SRC_POINTS, SRC_LINES]) {
    if (map.getSource(s)) map.removeSource(s)
  }
}

export function useMeasureSync(map: maplibregl.Map | null, mapVersion: number) {
  const measureActive   = useMapStore((s) => s.measureActive)
  const measureSessions = useMapStore((s) => s.measureSessions)
  const { addMeasureNode, removeMeasureNode } = useMapStore((s) => s.actions)

  // Keep stable refs for use inside event handlers
  const sessionsRef = useRef(measureSessions)
  const activeRef   = useRef(measureActive)
  useEffect(() => { sessionsRef.current = measureSessions }, [measureSessions])
  useEffect(() => { activeRef.current   = measureActive   }, [measureActive])

  // ── Add / remove layers when tool is toggled ────────────────────────────
  useEffect(() => {
    if (!map || mapVersion === 0 || !measureActive) return
    addLayers(map)
    return () => { removeLayers(map) }
  }, [map, mapVersion, measureActive])

  // ── Sync GeoJSON data whenever sessions change ──────────────────────────
  useEffect(() => {
    if (!map || mapVersion === 0 || !measureActive) return
    ;(map.getSource(SRC_LINES)  as GeoJSONSource | undefined)?.setData(buildLines(measureSessions))
    ;(map.getSource(SRC_POINTS) as GeoJSONSource | undefined)?.setData(buildPoints(measureSessions))
  }, [map, mapVersion, measureActive, measureSessions])

  // ── Map click: add or remove node ──────────────────────────────────────
  useEffect(() => {
    if (!map || !measureActive) return

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const pt = e.point
      for (const s of sessionsRef.current) {
        for (let i = 0; i < s.nodes.length; i++) {
          const px = map.project(s.nodes[i])
          const dx = px.x - pt.x, dy = px.y - pt.y
          if (dx * dx + dy * dy <= HIT_PX * HIT_PX) {
            removeMeasureNode(s.id, i)
            return
          }
        }
      }
      addMeasureNode([e.lngLat.lng, e.lngLat.lat])
    }

    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [map, measureActive, addMeasureNode, removeMeasureNode])

  // ── Hover: change cursor + highlight node ──────────────────────────────
  useEffect(() => {
    if (!map || !measureActive) return

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const pt = e.point
      let hovered: [number, number] | null = null
      let hoveredColor = '#e74c3c'
      outer: for (const s of sessionsRef.current) {
        for (const node of s.nodes) {
          const px = map.project(node)
          const dx = px.x - pt.x, dy = px.y - pt.y
          if (dx * dx + dy * dy <= HIT_PX * HIT_PX) { hovered = node; hoveredColor = s.color; break outer }
        }
      }
      const hoverSrc = map.getSource(SRC_HOVER) as GeoJSONSource | undefined
      if (hovered) {
        map.getCanvas().style.cursor = 'pointer'
        hoverSrc?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { color: hoveredColor }, geometry: { type: 'Point', coordinates: hovered } }],
        })
      } else {
        map.getCanvas().style.cursor = 'crosshair'
        hoverSrc?.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    map.on('mousemove', onMove)
    return () => {
      map.off('mousemove', onMove)
      map.getCanvas().style.cursor = ''
    }
  }, [map, measureActive])
}
