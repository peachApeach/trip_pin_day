import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'
import type { Place, TravelMode } from '../types'

const MODE_MAP: Partial<Record<TravelMode, string>> = {
  DRIVING: 'driving',
  TRANSIT: 'transit',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return points
}

function straightLine(from: Place, to: Place): { latitude: number; longitude: number }[] {
  return [
    { latitude: from.lat, longitude: from.lng },
    { latitude: to.lat, longitude: to.lng },
  ]
}

export async function fetchRoute(
  from: Place,
  to: Place,
  mode: TravelMode
): Promise<{ latitude: number; longitude: number }[]> {
  try {
    const origin = `${from.lat},${from.lng}`
    const destination = `${to.lat},${to.lng}`
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${MODE_MAP[mode]}&language=ko&key=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    const poly = data?.routes?.[0]?.overview_polyline?.points
    if (!poly) return straightLine(from, to)
    return decodePolyline(poly)
  } catch {
    return straightLine(from, to)
  }
}

export async function fetchAllRoutes(
  places: Place[],
  defaultMode: TravelMode,
  segmentModes: TravelMode[]
): Promise<{ latitude: number; longitude: number }[][]> {
  if (places.length < 2) return []
  const results = await Promise.all(
    places.slice(0, -1).map((place, i) =>
      fetchRoute(place, places[i + 1], segmentModes[i] ?? defaultMode)
    )
  )
  return results
}
