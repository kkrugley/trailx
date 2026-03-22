export type DistanceUnit = 'km' | 'mi'

const M_TO_FT = 3.28084
const KM_TO_MI = 0.621371
const KPH_TO_MPH = 0.621371

/** Format a distance given in metres, respecting the active unit setting. */
export function fmtDist(meters: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const miles = (meters / 1000) * KM_TO_MI
    if (miles >= 0.1) return `${miles.toFixed(1)} mi`
    return `${Math.round(meters * M_TO_FT)} ft`
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

/** Format an elevation value given in metres, respecting the active unit setting. */
export function fmtElev(meters: number, unit: DistanceUnit): string {
  if (unit === 'mi') return `${Math.round(meters * M_TO_FT)} ft`
  return `${Math.round(meters)} m`
}

/** Format a speed stored in km/h, respecting the active unit setting. */
export function fmtSpeed(kph: number, unit: DistanceUnit): string {
  if (unit === 'mi') return `${Math.round(kph * KPH_TO_MPH)} mph`
  return `${kph} км/ч`
}

/** Convert a speed value from the display unit back to km/h for storage. */
export function displayToKph(displayValue: number, unit: DistanceUnit): number {
  if (unit === 'mi') return Math.round(displayValue / KPH_TO_MPH)
  return displayValue
}

/** Convert a km/h value to the display unit for rendering in inputs. */
export function kphToDisplay(kph: number, unit: DistanceUnit): number {
  if (unit === 'mi') return Math.round(kph * KPH_TO_MPH)
  return kph
}

/** Speed unit label string. */
export function speedUnit(unit: DistanceUnit): string {
  return unit === 'mi' ? 'mph' : 'км/ч'
}
