export interface Trip {
  id: number
  title: string
  places: Place[]
  startDate: string
  travelMode: TravelMode
  segmentModes: { [dayIndex: number]: TravelMode[] }
  tripStartDate: string | null
  tripEndDate: string | null
}

export interface Place {
  id: number
  name: string
  lat: number
  lng: number
  address: string
  duration: number
  dayIndex?: number
}

export interface TravelSegment {
  duration: number
  distance: string
  mode: TravelMode
}

export type TravelMode = 'DRIVING' | 'TRANSIT' | 'WALKING' | 'BICYCLING'

export type TabKey = 'map' | 'plan'
