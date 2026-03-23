import { describe, it, expect } from 'vitest'
import { serializeGPX, parseGPX } from '@trailx/shared'
import type { GPXTrack, GPXWaypoint } from '@trailx/shared'

// ── serializeGPX ──────────────────────────────────────────────────────────────

describe('serializeGPX', () => {
  const track: GPXTrack = {
    name: 'My Route',
    points: [
      { lat: 50.45, lng: 30.52, ele: 100, time: '2024-01-01T10:00:00Z' },
      { lat: 50.55, lng: 30.62, ele: 120 },
    ],
  }
  const waypoints: GPXWaypoint[] = [
    { lat: 50.50, lng: 30.57, name: 'Rest Stop', description: 'Nice place', ele: 110 },
  ]

  it('produces valid GPX 1.1 header', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(gpx).toContain('version="1.1"')
    expect(gpx).toContain('creator="TrailX"')
  })

  it('includes default route name in metadata', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('<name>TrailX Route</name>')
  })

  it('uses custom name when provided', () => {
    const gpx = serializeGPX(track, [], 'Custom Name')
    expect(gpx).toContain('<name>Custom Name</name>')
  })

  it('escapes special characters in names', () => {
    const gpx = serializeGPX(track, [], '<Test & "Route">')
    expect(gpx).toContain('&lt;Test &amp; &quot;Route&quot;&gt;')
  })

  it('includes track name', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('<name>My Route</name>')
  })

  it('outputs trkpt elements with lat/lon attributes', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('lat="50.45" lon="30.52"')
    expect(gpx).toContain('lat="50.55" lon="30.62"')
  })

  it('includes elevation when present', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('<ele>100</ele>')
    expect(gpx).toContain('<ele>120</ele>')
  })

  it('includes time when present', () => {
    const gpx = serializeGPX(track, [])
    expect(gpx).toContain('<time>2024-01-01T10:00:00Z</time>')
  })

  it('outputs wpt elements for waypoints', () => {
    const gpx = serializeGPX(track, waypoints)
    expect(gpx).toContain('<wpt lat="50.5" lon="30.57">')
    expect(gpx).toContain('<name>Rest Stop</name>')
    expect(gpx).toContain('<desc>Nice place</desc>')
    expect(gpx).toContain('<ele>110</ele>')
  })

  it('handles track without name', () => {
    const unnamed: GPXTrack = { points: [{ lat: 0, lng: 0 }] }
    const gpx = serializeGPX(unnamed, [])
    // Should not throw and should not have empty <name> inside trk
    expect(gpx).not.toMatch(/<trk>\s*<name>\s*<\/name>/)
  })
})

// ── parseGPX ─────────────────────────────────────────────────────────────────

describe('parseGPX', () => {
  const SIMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailX" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Test Route</name></metadata>
  <trk>
    <name>Track 1</name>
    <trkseg>
      <trkpt lat="50.45" lon="30.52"><ele>100</ele><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="50.55" lon="30.62"><ele>120</ele></trkpt>
    </trkseg>
  </trk>
  <wpt lat="50.50" lon="30.57">
    <name>Waypoint A</name>
    <desc>A nice spot</desc>
    <ele>110</ele>
  </wpt>
</gpx>`

  it('parses metadata name', () => {
    const result = parseGPX(SIMPLE_GPX)
    expect(result.name).toBe('Test Route')
  })

  it('parses track name and points', () => {
    const result = parseGPX(SIMPLE_GPX)
    expect(result.tracks).toHaveLength(1)
    expect(result.tracks[0].name).toBe('Track 1')
    expect(result.tracks[0].points).toHaveLength(2)
  })

  it('parses track point coordinates', () => {
    const result = parseGPX(SIMPLE_GPX)
    const [p1, p2] = result.tracks[0].points
    expect(p1.lat).toBe(50.45)
    expect(p1.lng).toBe(30.52)
    expect(p2.lat).toBe(50.55)
    expect(p2.lng).toBe(30.62)
  })

  it('parses elevation and time', () => {
    const result = parseGPX(SIMPLE_GPX)
    const p1 = result.tracks[0].points[0]
    expect(p1.ele).toBe(100)
    expect(p1.time).toBe('2024-01-01T10:00:00Z')
  })

  it('handles missing time gracefully', () => {
    const result = parseGPX(SIMPLE_GPX)
    const p2 = result.tracks[0].points[1]
    expect(p2.time).toBeUndefined()
  })

  it('parses waypoints', () => {
    const result = parseGPX(SIMPLE_GPX)
    expect(result.waypoints).toHaveLength(1)
    expect(result.waypoints[0].lat).toBe(50.50)
    expect(result.waypoints[0].lng).toBe(30.57)
    expect(result.waypoints[0].name).toBe('Waypoint A')
    expect(result.waypoints[0].description).toBe('A nice spot')
    expect(result.waypoints[0].ele).toBe(110)
  })

  it('round-trips: serialize → parse preserves data', () => {
    const track: GPXTrack = {
      name: 'Round Trip',
      points: [
        { lat: 48.85, lng: 2.35, ele: 35 },
        { lat: 51.51, lng: -0.13, ele: 20 },
      ],
    }
    const wpts: GPXWaypoint[] = [{ lat: 50.0, lng: 10.0, name: 'Midpoint' }]
    const serialized = serializeGPX(track, wpts, 'Round Trip')
    const parsed = parseGPX(serialized)

    expect(parsed.name).toBe('Round Trip')
    expect(parsed.tracks[0].name).toBe('Round Trip')
    expect(parsed.tracks[0].points[0].lat).toBe(48.85)
    expect(parsed.tracks[0].points[1].ele).toBe(20)
    expect(parsed.waypoints[0].name).toBe('Midpoint')
  })

  it('ignores XML comments', () => {
    const withComments = SIMPLE_GPX.replace('<trk>', '<!-- comment --><trk>')
    const result = parseGPX(withComments)
    expect(result.tracks).toHaveLength(1)
  })

  it('handles Strava comma-as-decimal-separator in elevation', () => {
    const strava = `<gpx><trk><trkseg>
      <trkpt lat="48,85" lon="2,35"><ele>35,5</ele></trkpt>
    </trkseg></trk></gpx>`
    const result = parseGPX(strava)
    expect(result.tracks[0].points[0].lat).toBe(48.85)
    expect(result.tracks[0].points[0].ele).toBe(35.5)
  })

  it('returns empty tracks and waypoints for empty GPX', () => {
    const result = parseGPX('<gpx></gpx>')
    expect(result.tracks).toHaveLength(0)
    expect(result.waypoints).toHaveLength(0)
  })

  it('skips track points without lat/lon', () => {
    const bad = `<gpx><trk><trkseg>
      <trkpt lat="50" lon="30"><ele>100</ele></trkpt>
      <trkpt><ele>110</ele></trkpt>
    </trkseg></trk></gpx>`
    const result = parseGPX(bad)
    expect(result.tracks[0].points).toHaveLength(1)
  })

  it('skips waypoints without lat/lon', () => {
    const bad = `<gpx><wpt><name>No coords</name></wpt></gpx>`
    const result = parseGPX(bad)
    expect(result.waypoints).toHaveLength(0)
  })
})
