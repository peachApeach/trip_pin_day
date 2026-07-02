import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'
import type { Place, TravelMode, TravelSegment } from '../types'

const MODE_MAP: Partial<Record<TravelMode, string>> = {
  DRIVING: 'driving',
  TRANSIT: 'transit',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
}

const SPEED_KMH: Record<TravelMode, number> = {
  DRIVING: 40,
  TRANSIT: 25,
  WALKING: 5,
  BICYCLING: 15,
  OTHER: 20,
}

function haversineKm(from: Place, to: Place): number {
  const R = 6371
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estimateSegment(from: Place, to: Place, mode: TravelMode): TravelSegment {
  const speed = SPEED_KMH[mode]
  const km = haversineKm(from, to) * 1.3 // 실제 경로 보정 30%
  const duration = Math.ceil((km / speed) * 60)
  const distance = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`
  return { duration, distance, mode }
}

export async function fetchSegment(
  from: Place,
  to: Place,
  mode: TravelMode,
  customDuration?: number | null
): Promise<TravelSegment | null> {
  if (mode === 'OTHER') {
    if (!customDuration) return null
    const km = haversineKm(from, to) * 1.3
    const distance = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`
    return { duration: customDuration, distance, mode }
  }
  try {
    const origin = `${from.lat},${from.lng}`
    const destination = `${to.lat},${to.lng}`
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=${MODE_MAP[mode]}&language=ko&key=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === 'OK') {
      return {
        duration: Math.ceil(element.duration.value / 60),
        distance: element.distance.text as string,
        mode,
      }
    }
    return estimateSegment(from, to, mode)
  } catch {
    return estimateSegment(from, to, mode)
  }
}

export async function fetchTravelSegments(
  places: Place[],
  defaultMode: TravelMode,
  segmentModes?: TravelMode[],
  segmentDurations?: (number | null)[]
): Promise<(TravelSegment | null)[]> {
  if (places.length < 2) return []
  const segments: (TravelSegment | null)[] = []
  for (let i = 0; i < places.length - 1; i++) {
    const mode = segmentModes?.[i] ?? defaultMode
    const customDuration = segmentDurations?.[i] ?? null
    segments.push(await fetchSegment(places[i], places[i + 1], mode, customDuration))
  }
  return segments
}
