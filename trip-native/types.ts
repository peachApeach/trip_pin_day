export interface BudgetItem {
  currency: string
  amount: number
}

export interface Trip {
  id: number
  title: string
  places: Place[]
  startDate: string
  travelMode: TravelMode
  segmentModes: { [dayIndex: number]: (TravelMode | null)[] }
  segmentDurations: { [dayIndex: number]: (number | null)[] }
  tripStartDate: string | null
  tripEndDate: string | null
  budgets?: BudgetItem[]
}

export interface Place {
  id: number
  name: string
  lat: number
  lng: number
  address: string
  duration: number
  dayIndex?: number
  budget?: number
  budgetCurrency?: string
}

export interface TravelSegment {
  duration: number
  distance: string
  mode: TravelMode
}

export type TravelMode = 'DRIVING' | 'TRANSIT' | 'WALKING' | 'BICYCLING' | 'OTHER'

export type TabKey = 'map' | 'plan'
