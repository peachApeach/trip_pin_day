import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'
import type { Place, TravelMode, TravelSegment } from '../types'

const MODE_MAP: Record<TravelMode, string> = {
  DRIVING: 'driving',
  TRANSIT: 'transit',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
}

export async function fetchSegment(
  from: Place,
  to: Place,
  mode: TravelMode
): Promise<TravelSegment | null> {
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
    return null
  } catch {
    return null
  }
}

export async function fetchTravelSegments(
  places: Place[],
  defaultMode: TravelMode,
  segmentModes?: TravelMode[]
): Promise<(TravelSegment | null)[]> {
  if (places.length < 2) return []
  const segments: (TravelSegment | null)[] = []
  for (let i = 0; i < places.length - 1; i++) {
    const mode = segmentModes?.[i] ?? defaultMode
    segments.push(await fetchSegment(places[i], places[i + 1], mode))
  }
  return segments
}
