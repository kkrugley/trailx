export function distance(_lat1: number, _lng1: number, _lat2: number, _lng2: number): number {
  // TODO: implement Haversine
  return 0
}

export function bbox(_coords: Array<[number, number]>): [number, number, number, number] {
  // TODO: implement bounding box
  return [0, 0, 0, 0]
}

export function interpolateAlong(_coords: Array<[number, number]>, _distanceM: number): [number, number] {
  // TODO: implement interpolation along polyline
  return [0, 0]
}

// ── Coordinate parsing ────────────────────────────────────────────────────────

/** Decimal: "50.45, 30.52" or "50.45 30.52" */
const DECIMAL_RE = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/

/** DMS: "50°27'N 30°31'E" or "50°27'12"N 30°31'45"E" */
const DMS_RE =
  /^\s*(\d+)°(\d+)'(?:(\d+(?:\.\d+)?)")?([NS])\s+(\d+)°(\d+)'(?:(\d+(?:\.\d+)?)")?([EW])\s*$/i

function dmsToDecimal(deg: number, min: number, sec: number, dir: string): number {
  const val = deg + min / 60 + sec / 3600
  return dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W' ? -val : val
}

/**
 * Parse a coordinate string in decimal ("50.45, 30.52" / "50.45 30.52")
 * or DMS ("50°27'N 30°31'E") format.
 * Returns null if the input doesn't match any known format or is out of range.
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const decimal = DECIMAL_RE.exec(input)
  if (decimal) {
    const lat = parseFloat(decimal[1])
    const lng = parseFloat(decimal[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
    return null
  }

  const dms = DMS_RE.exec(input)
  if (dms) {
    const lat = dmsToDecimal(
      parseFloat(dms[1]),
      parseFloat(dms[2]),
      parseFloat(dms[3] ?? '0'),
      dms[4],
    )
    const lng = dmsToDecimal(
      parseFloat(dms[5]),
      parseFloat(dms[6]),
      parseFloat(dms[7] ?? '0'),
      dms[8],
    )
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
    return null
  }

  return null
}
