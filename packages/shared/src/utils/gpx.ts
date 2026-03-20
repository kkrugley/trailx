import type { GPXFile, GPXTrack, GPXTrackPoint, GPXWaypoint } from '../types/gpx'

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Serialization ──────────────────────────────────────────────────────────

/**
 * Serialize a route track + standalone waypoints to a GPX 1.1 string.
 * Route goes into <trk>/<trkseg>/<trkpt> with optional <ele> and <time>.
 * Standalone POIs go into top-level <wpt> elements.
 */
export function serializeGPX(
  track: GPXTrack,
  waypoints: GPXWaypoint[],
  name = 'TrailX Route',
): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    '<gpx version="1.1" creator="TrailX" xmlns="http://www.topografix.com/GPX/1/1">',
  )
  lines.push('  <metadata>')
  lines.push(`    <name>${esc(name)}</name>`)
  lines.push('  </metadata>')

  lines.push('  <trk>')
  if (track.name) lines.push(`    <name>${esc(track.name)}</name>`)
  lines.push('    <trkseg>')
  for (const pt of track.points) {
    lines.push(`      <trkpt lat="${pt.lat}" lon="${pt.lng}">`)
    if (pt.ele !== undefined) lines.push(`        <ele>${pt.ele}</ele>`)
    if (pt.time) lines.push(`        <time>${esc(pt.time)}</time>`)
    lines.push('      </trkpt>')
  }
  lines.push('    </trkseg>')
  lines.push('  </trk>')

  for (const wpt of waypoints) {
    lines.push(`  <wpt lat="${wpt.lat}" lon="${wpt.lng}">`)
    if (wpt.name) lines.push(`    <name>${esc(wpt.name)}</name>`)
    if (wpt.description) lines.push(`    <desc>${esc(wpt.description)}</desc>`)
    if (wpt.ele !== undefined) lines.push(`    <ele>${wpt.ele}</ele>`)
    lines.push('  </wpt>')
  }

  lines.push('</gpx>')
  return lines.join('\n')
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** Extract single attribute value from an opening tag string */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'))
    ?? tag.match(new RegExp(`${name}='([^']*)'`, 'i'))
  return m?.[1]
}

/** Extract first text content of a simple element within a block */
function textOf(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  return m?.[1]?.trim() || undefined
}

/** Parse a float, treating comma as decimal separator (Strava quirk) */
function pf(s: string | undefined): number | undefined {
  if (!s) return undefined
  const v = parseFloat(s.replace(',', '.'))
  return isNaN(v) ? undefined : v
}

/**
 * Parse a GPX 1.1 string into a GPXFile.
 * Works in browser and Node.js without external dependencies.
 * Handles common quirks from Garmin, Strava, and Komoot exports.
 */
export function parseGPX(gpxString: string): GPXFile {
  // Strip XML comments and processing instructions to simplify parsing
  const xml = gpxString
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[^>]*\?>/g, '')

  // Extract metadata name
  const metaBlock = xml.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/i)?.[1] ?? ''
  const name = textOf(metaBlock, 'name')

  // ── Tracks ──────────────────────────────────────────────────────────────
  const tracks: GPXTrack[] = []
  const trkMatches = xml.matchAll(/<trk[^>]*>([\s\S]*?)<\/trk>/gi)
  for (const trkMatch of trkMatches) {
    const trkBlock = trkMatch[1]
    const trackName = textOf(trkBlock, 'name')
    const points: GPXTrackPoint[] = []

    const trkptMatches = trkBlock.matchAll(/<trkpt([^>]*)>([\s\S]*?)<\/trkpt>/gi)
    for (const ptMatch of trkptMatches) {
      const tagAttrs = ptMatch[1]
      const ptBody = ptMatch[2]

      const lat = pf(attr(tagAttrs, 'lat'))
      const lng = pf(attr(tagAttrs, 'lon'))
      if (lat === undefined || lng === undefined) continue

      // Elevation: <ele> or Garmin extension child element named 'ele'
      let ele = pf(textOf(ptBody, 'ele'))
      if (ele === undefined) {
        const extBlock = ptBody.match(/<extensions[^>]*>([\s\S]*?)<\/extensions>/i)?.[1]
        if (extBlock) {
          const elInExt = extBlock.match(/<[^:>]*:?ele[^>]*>([^<]+)<\/[^>]+>/i)
          ele = pf(elInExt?.[1])
        }
      }

      const time = textOf(ptBody, 'time')
      points.push({ lat, lng, ele, time })
    }

    if (points.length > 0) tracks.push({ name: trackName, points })
  }

  // ── Waypoints ────────────────────────────────────────────────────────────
  const waypoints: GPXWaypoint[] = []
  const wptMatches = xml.matchAll(/<wpt([^>]*)>([\s\S]*?)<\/wpt>/gi)
  for (const wptMatch of wptMatches) {
    const tagAttrs = wptMatch[1]
    const wptBody = wptMatch[2]

    const lat = pf(attr(tagAttrs, 'lat'))
    const lng = pf(attr(tagAttrs, 'lon'))
    if (lat === undefined || lng === undefined) continue

    waypoints.push({
      lat,
      lng,
      name: textOf(wptBody, 'name'),
      description: textOf(wptBody, 'desc'),
      ele: pf(textOf(wptBody, 'ele')),
    })
  }

  return { name, tracks, waypoints }
}
