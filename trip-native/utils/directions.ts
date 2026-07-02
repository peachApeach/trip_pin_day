import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'
import type { Place, TravelMode } from '../types'

const MODE_MAP: Record<TravelMode, string> = {
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
    if (!poly) return []
    return decodePolyline(poly)
  } catch {
    return []
  }
}
