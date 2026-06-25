import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'
import type { Place, TravelMode, TravelSegment } from '../types'

const MODE_MAP: Record<TravelMode, string> = {
  DRIVING: 'driving',
  TRANSIT: 'transit',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
}

export async function fetchTravelSegments(
  places: Place[],
  travelMode: TravelMode
): Promise<(TravelSegment | null)[]> {
  if (places.length < 2) return []

  const segments: (TravelSegment | null)[] = []
  const mode = MODE_MAP[travelMode]

  for (let i = 0; i < places.length - 1; i++) {
    const origin = `${places[i].lat},${places[i].lng}`
    const destination = `${places[i + 1].lat},${places[i + 1].lng}`

    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=${mode}&language=ko&key=${API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const element = data?.rows?.[0]?.elements?.[0]
      if (element?.status === 'OK') {
        segments.push({
          duration: Math.ceil(element.duration.value / 60),
          distance: element.distance.text as string,
        })
      } else {
        segments.push(null)
      }
    } catch {
      segments.push(null)
    }
  }

  return segments
}
