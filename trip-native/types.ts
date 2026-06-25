export interface Place {
  id: number
  name: string
  lat: number
  lng: number
  address: string
  duration: number
}

export interface TravelSegment {
  duration: number
  distance: string
}

export type TravelMode = 'DRIVING' | 'TRANSIT' | 'WALKING' | 'BICYCLING'

export type TabKey = 'map' | 'list' | 'timetable'
