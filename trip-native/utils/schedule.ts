import { effectiveOffset, toZonedDate, zonedWallClockToUtc } from './timezone'
import type { Place, TravelMode, TravelSegment, Trip } from '../types'

/** 알림을 일정 시각보다 얼마나 앞서 보낼지 (분) */
export const LEAD_MINUTES = 10

export function notificationScheduleSignature(trip: Trip): string {
  const places = [...trip.places].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
  return JSON.stringify([
    trip.startDate, trip.tripStartDate, trip.tripEndDate, trip.travelMode,
    places.map(p => [p.id, p.dayIndex ?? 0, p.duration, p.lat, p.lng, p.name, p.address, p.timeZoneId, p.utcOffsetMinutes]),
    trip.segmentModes, trip.segmentDurations,
  ])
}

export interface ArrivalItem {
  place: Place
  dayIndex: number
  /**
   * 도착 시각 — **기기 로컬** Date.
   * 일정표에 보이는 벽시계 숫자를 그대로 기기 시간대로 읽은 값이다.
   * (일정표가 방콕 09:00을 보여주면, 폰이 한국에 있어도 09:00 KST)
   */
  localTime: Date
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

/** 여행 N일차의 기준 날짜. tripStartDate + dayIndex일, 시각은 startDate의 시/분. */
export function dayStartWallClock(
  tripStartDate: string | null,
  startDate: string,
  dayIndex: number
): Date | null {
  const time = new Date(startDate)
  if (Number.isNaN(time.getTime())) return null
  // tripStartDate가 없으면 startDate의 날짜를 Day 1로 본다
  const base = tripStartDate ? new Date(tripStartDate) : new Date(startDate)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayIndex)
  d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return d
}

/**
 * 하루치 도착 시각을 계산한다. PlanScreen의 타임라인 계산과 같은 산식이다.
 *
 * dayPlaces는 그 날의 장소들, segments는 fetchTravelSegments가 돌려준 구간 배열
 * (prevDayLastPlace가 있으면 segments[0]이 '전날 마지막 → 오늘 첫 장소' 구간).
 */
export function computeDayArrivals(
  dayPlaces: Place[],
  segments: (TravelSegment | null)[],
  prevDayLastPlace: Place | null,
  dayStart: Date,
  dayIndex: number
): ArrivalItem[] {
  if (dayPlaces.length === 0) return []

  const segOffset = prevDayLastPlace ? 1 : 0
  const firstSeg = prevDayLastPlace ? segments[0] : null

  // dayStart(기기에서 고른 벽시계)를 첫 장소의 현지 시각으로 해석해 절대 시각으로
  const firstPlaceOffset = effectiveOffset(dayPlaces[0], dayStart)
  let currentUtc = zonedWallClockToUtc(dayStart, firstPlaceOffset)
  if (firstSeg) currentUtc = addMinutes(currentUtc, firstSeg.duration)

  const out: ArrivalItem[] = []
  dayPlaces.forEach((place, index) => {
    const fromUtc = new Date(currentUtc)
    currentUtc = addMinutes(currentUtc, place.duration)
    const seg = segments[index + segOffset]
    if (seg && index < dayPlaces.length - 1) currentUtc = addMinutes(currentUtc, seg.duration)

    // 일정표에 보이는 벽시계(장소 현지 시각)를 꺼내서
    const offset = effectiveOffset(place, fromUtc)
    const shown = toZonedDate(fromUtc, offset)
    // 같은 시/분을 기기 로컬 시각으로 다시 읽는다. 시차로 날짜가 넘어가도
    // shown의 날짜 필드가 이미 반영하고 있어 그대로 쓰면 된다.
    const localTime = new Date(
      shown.getFullYear(), shown.getMonth(), shown.getDate(),
      shown.getHours(), shown.getMinutes(), 0, 0
    )
    out.push({ place, dayIndex, localTime })
  })
  return out
}

/** 그 날의 장소들과 전날 마지막 장소를 골라낸다 (App.tsx와 동일 규칙) */
export function splitDayPlaces(places: Place[], dayIndex: number) {
  const dayPlaces = places.filter(p => (p.dayIndex ?? 0) === dayIndex)
  const prevPlaces = dayIndex > 0 ? places.filter(p => (p.dayIndex ?? 0) === dayIndex - 1) : []
  const prevDayLastPlace = prevPlaces.length > 0 ? prevPlaces[prevPlaces.length - 1] : null
  return { dayPlaces, prevDayLastPlace }
}

/** fetchTravelSegments에 넘길 장소 배열 (전날 마지막 장소를 앞에 붙인 형태) */
export function segmentInputPlaces(dayPlaces: Place[], prevDayLastPlace: Place | null): Place[] {
  return prevDayLastPlace ? [prevDayLastPlace, ...dayPlaces] : dayPlaces
}

/** 장소가 바뀌어도 같은 출발지와 도착지 사이의 이동 설정을 유지한다. */
export function updateTripPlaces(trip: Trip, places: Place[], changedDays: number[], undoSnapshot?: Trip): Trip {
  const segmentModes = { ...trip.segmentModes }
  const segmentDurations = { ...trip.segmentDurations }
  const affectedDays = new Set(changedDays.flatMap(day => [day, day + 1]))
  const segmentKeys = (items: Place[], day: number) => {
    const { dayPlaces, prevDayLastPlace } = splitDayPlaces(items, day)
    const route = segmentInputPlaces(dayPlaces, prevDayLastPlace)
    return route.slice(1).map((to, index) => `${route[index].id}:${to.id}`)
  }
  const previousSettings = new Map<string, { mode: TravelMode | null; duration: number | null }>()
  for (const source of undoSnapshot ? [undoSnapshot, trip] : [trip]) {
    for (const day of affectedDays) {
      segmentKeys(source.places, day).forEach((key, index) => {
        previousSettings.set(key, {
          mode: source.segmentModes?.[day]?.[index] ?? null,
          duration: source.segmentDurations?.[day]?.[index] ?? null,
        })
      })
    }
  }
  for (const day of affectedDays) {
    const settings = segmentKeys(places, day).map(key => previousSettings.get(key))
    const modes = settings.map(setting => setting?.mode ?? null)
    const durations = settings.map(setting => setting?.duration ?? null)
    if (segmentModes[day] || modes.some(mode => mode !== null)) segmentModes[day] = modes
    if (segmentDurations[day] || durations.some(duration => duration !== null)) segmentDurations[day] = durations
  }
  return { ...trip, places, segmentModes, segmentDurations }
}

export function restoreTripPlace(trip: Trip, undoSnapshot: Trip, placeId: number): Trip {
  const place = undoSnapshot.places.find(p => p.id === placeId)
  if (!place || trip.places.some(p => p.id === placeId)) return trip

  const day = place.dayIndex ?? 0
  if (day >= tripTotalDays(trip.tripStartDate, trip.tripEndDate)) return trip
  const original = splitDayPlaces(undoSnapshot.places, day).dayPlaces
  const originalIndex = original.indexOf(place)
  const { dayPlaces } = splitDayPlaces(trip.places, day)
  const nextIndex = dayPlaces.findIndex(p => p.id === original[originalIndex + 1]?.id)
  const previousIndex = dayPlaces.findIndex(p => p.id === original[originalIndex - 1]?.id)
  const index = nextIndex >= 0 ? nextIndex : previousIndex >= 0 ? previousIndex + 1 : originalIndex
  dayPlaces.splice(index, 0, place)

  const otherDays = trip.places.filter(p => (p.dayIndex ?? 0) !== day)
  return updateTripPlaces(trip, [...otherDays, ...dayPlaces], [day], undoSnapshot)
}

/** 여행의 총 일수 */
export function tripTotalDays(tripStartDate: string | null, tripEndDate: string | null): number {
  if (!tripStartDate || !tripEndDate) return 1
  const diff = Math.round(
    (new Date(tripEndDate).getTime() - new Date(tripStartDate).getTime()) / 86400000
  )
  return Number.isNaN(diff) ? 1 : Math.max(1, diff + 1)
}

export function modesForDay(
  segmentModes: { [dayIndex: number]: (TravelMode | null)[] } | undefined,
  dayIndex: number
): (TravelMode | null)[] {
  const raw = (segmentModes ?? {})[dayIndex]
  return Array.isArray(raw) ? raw : []
}

export function durationsForDay(
  segmentDurations: { [dayIndex: number]: (number | null)[] } | undefined,
  dayIndex: number
): (number | null)[] {
  const raw = (segmentDurations ?? {})[dayIndex]
  return Array.isArray(raw) ? raw : []
}
