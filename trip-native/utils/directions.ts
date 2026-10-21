import { latLngParam } from './geo'
import { mapsFetch } from './mapsApi'
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
  const origin = latLngParam(from.lat, from.lng)
  const destination = latLngParam(to.lat, to.lng)
  // 좌표가 손상된 경우 URL에 넣지 않는다. straightLine도 NaN 좌표를 그대로
  // Polyline에 넘기게 되므로 경로 없음(빈 배열)으로 처리한다.
  if (origin == null || destination == null) return []
  try {
    const res = await mapsFetch('/directions/json', {
      origin,
      destination,
      mode: MODE_MAP[mode] ?? '',
      language: 'ko',
    })
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
  segmentModes: (TravelMode | null)[]
): Promise<{ latitude: number; longitude: number }[][]> {
  if (places.length < 2) return []
  const results = await Promise.all(
    places.slice(0, -1).map((place, i) =>
      fetchRoute(place, places[i + 1], segmentModes[i] ?? defaultMode)
    )
  )
  return results
}
