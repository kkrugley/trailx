interface OpenMeteoHourly {
  time: string[]
  temperature_2m: number[]
  precipitation: number[]
  windspeed_10m: number[]
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly
}

export interface WeatherSnapshot {
  temp: number    // celsius
  precip: number  // mm
  wind: number    // km/h
  time: Date
}

/**
 * Fetch the hourly weather snapshot closest to `at` for the given coordinates.
 * Returns null if the API is unreachable or the forecast doesn't cover `at`.
 */
export async function getWeatherAt(
  lat: number,
  lng: number,
  at: Date,
): Promise<WeatherSnapshot | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(6))
  url.searchParams.set('longitude', lng.toFixed(6))
  url.searchParams.set('hourly', 'temperature_2m,precipitation,windspeed_10m')
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('timezone', 'auto')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = (await res.json()) as OpenMeteoResponse

    const targetMs = at.getTime()
    let bestIdx = 0
    let bestDiff = Infinity

    for (let i = 0; i < data.hourly.time.length; i++) {
      const diff = Math.abs(new Date(data.hourly.time[i]).getTime() - targetMs)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }

    return {
      temp: data.hourly.temperature_2m[bestIdx],
      precip: data.hourly.precipitation[bestIdx],
      wind: data.hourly.windspeed_10m[bestIdx],
      time: new Date(data.hourly.time[bestIdx]),
    }
  } catch {
    return null
  }
}

/** Haversine distance in metres between two lat/lng pairs. */
export function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
