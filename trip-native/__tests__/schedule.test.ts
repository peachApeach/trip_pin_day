import {
  LEAD_MINUTES, computeDayArrivals, dayStartWallClock,
  durationsForDay, modesForDay, notificationScheduleSignature, restoreTripPlace, segmentInputPlaces, splitDayPlaces, tripTotalDays,
  updateTripPlaces,
} from '../utils/schedule'
import type { Place, TravelSegment, Trip } from '../types'

function place(over: Partial<Place> & { id: number }): Place {
  return {
    name: `P${over.id}`, lat: 37.5, lng: 127.0, address: '',
    duration: 60, ...over,
  }
}

const seg = (duration: number): TravelSegment => ({ duration, distance: '1 km', mode: 'DRIVING' })

/** 기기 로컬 'HH:MM' */
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

describe('updateTripPlaces', () => {
  const first = place({ id: 1 })
  const second = place({ id: 2, dayIndex: 0 })
  const third = place({ id: 3, dayIndex: 1 })
  const fourth = place({ id: 4, dayIndex: 1 })
  const fifth = place({ id: 5, dayIndex: 2 })
  const sixth = place({ id: 6, dayIndex: 2 })
  const trip: Trip = {
    id: 1, title: '여행', startDate: '2026-11-19T09:00:00+09:00',
    tripStartDate: '2026-11-19', tripEndDate: '2026-11-21', travelMode: 'DRIVING',
    places: [first, second, third, fourth, fifth, sixth],
    segmentModes: { 0: ['BICYCLING'], 1: ['TRANSIT', 'WALKING'], 2: ['OTHER', 'TRANSIT'] },
    segmentDurations: { 2: [20, null] },
  }

  it('Day 2에 장소를 추가하면 그날 마지막에 붙이고 Day 3에서 바뀐 연결만 초기화한다', () => {
    const added = place({ id: 7, dayIndex: 1 })
    const updated = updateTripPlaces(trip, [...trip.places, added], [1])
    expect(splitDayPlaces(updated.places, 1).dayPlaces).toEqual([third, fourth, added])
    expect(updated.segmentModes).toEqual({
      0: ['BICYCLING'], 1: ['TRANSIT', 'WALKING', null], 2: [null, 'TRANSIT'],
    })
    expect(updated.segmentDurations[2]).toEqual([null, null])
  })

  it('Day 2 첫 장소를 Day 1 끝으로 옮기면 같은 출발지와 도착지를 가진 설정만 유지한다', () => {
    const moved = { ...third, dayIndex: 0 }
    const updated = updateTripPlaces(trip, [first, second, fourth, fifth, sixth, moved], [1, 0])
    expect(splitDayPlaces(updated.places, 0).dayPlaces).toEqual([first, second, moved])
    expect(splitDayPlaces(updated.places, 1).dayPlaces).toEqual([fourth])
    expect(updated.segmentModes).toEqual({
      0: ['BICYCLING', 'TRANSIT'], 1: ['WALKING'], 2: ['OTHER', 'TRANSIT'],
    })
    expect(updated.segmentDurations[2]).toEqual([20, null])
  })

  it('삭제한 장소를 실행 취소하면 원래 순서와 연결 설정을 복구하고 이후 편집도 보존한다', () => {
    const withoutFourth = updateTripPlaces(trip, [first, second, third, fifth, sixth], [1])
    expect(withoutFourth.segmentModes[2]).toEqual([null, 'TRANSIT'])
    const added = place({ id: 7, dayIndex: 2 })
    const edited = updateTripPlaces(withoutFourth, [...withoutFourth.places, added], [2])
    edited.segmentModes[2][1] = 'BICYCLING'

    const restored = restoreTripPlace(edited, trip, fourth.id)
    expect(splitDayPlaces(restored.places, 1).dayPlaces).toEqual([third, fourth])
    expect(splitDayPlaces(restored.places, 2).dayPlaces).toEqual([fifth, sixth, added])
    expect(restored.segmentModes[1]).toEqual(['TRANSIT', 'WALKING'])
    expect(restored.segmentModes[2]).toEqual(['OTHER', 'BICYCLING', null])
    expect(restored.segmentDurations[2]).toEqual([20, null, null])
  })

  it('같은 날짜 안에서 순서를 뒤집으면 바뀐 구간에 이전의 이동 설정을 적용하지 않는다', () => {
    const reordered = updateTripPlaces(trip, [first, second, fourth, third, fifth, sixth], [1])
    expect(reordered.segmentModes[1]).toEqual([null, null])
    expect(reordered.segmentModes[2]).toEqual([null, 'TRANSIT'])
  })

  it('앱을 다시 열어도 수정한 일정과 마지막으로 예약된 일정을 구분한다', () => {
    const scheduled: Trip = { ...trip, notifyEnabled: true, notificationScheduleSignature: notificationScheduleSignature(trip) }
    const edited = { ...scheduled, places: scheduled.places.map(p => p.id === first.id ? { ...p, duration: 90 } : p) }
    const loaded: Trip = JSON.parse(JSON.stringify(edited))
    expect(notificationScheduleSignature(loaded)).not.toBe(loaded.notificationScheduleSignature)
    expect(notificationScheduleSignature({ ...scheduled, title: '제목만 수정' })).toBe(scheduled.notificationScheduleSignature)
  })
})

describe('LEAD_MINUTES', () => {
  it('10분이다', () => {
    expect(LEAD_MINUTES).toBe(10)
  })
})

describe('dayStartWallClock', () => {
  const startDate = new Date(2026, 0, 1, 9, 0, 0).toISOString()

  it('tripStartDate + dayIndex일에 startDate의 시/분을 얹는다', () => {
    const d = dayStartWallClock(new Date(2026, 4, 10).toISOString(), startDate, 0)!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 4, 10])
    expect(hhmm(d)).toBe('09:00')
  })

  it('dayIndex가 날짜를 넘긴다', () => {
    const d = dayStartWallClock(new Date(2026, 4, 10).toISOString(), startDate, 3)!
    expect(d.getDate()).toBe(13)
    expect(hhmm(d)).toBe('09:00')
  })

  it('달을 넘어가도 맞는다', () => {
    const d = dayStartWallClock(new Date(2026, 4, 30).toISOString(), startDate, 3)!
    expect([d.getMonth(), d.getDate()]).toEqual([5, 2])
  })

  it('tripStartDate가 없으면 startDate의 날짜를 Day 1로 쓴다', () => {
    const d = dayStartWallClock(null, startDate, 1)!
    expect([d.getMonth(), d.getDate()]).toEqual([0, 2])
  })

  it('잘못된 날짜는 null', () => {
    expect(dayStartWallClock(null, 'not-a-date', 0)).toBeNull()
    expect(dayStartWallClock('nope', startDate, 0)).toBeNull()
  })
})

describe('computeDayArrivals', () => {
  const dayStart = new Date(2026, 4, 10, 9, 0, 0)

  it('첫 장소는 출발 시각에 도착한다', () => {
    const places = [place({ id: 1 })]
    const out = computeDayArrivals(places, [], null, dayStart, 0)
    expect(out).toHaveLength(1)
    expect(hhmm(out[0].localTime)).toBe('09:00')
    expect(out[0].place.id).toBe(1)
    expect(out[0].dayIndex).toBe(0)
  })

  it('체류시간 + 이동시간을 누적한다', () => {
    const places = [
      place({ id: 1, duration: 90 }),
      place({ id: 2, duration: 60 }),
      place({ id: 3 }),
    ]
    // 09:00 도착 → 90분 체류 → 30분 이동 → 11:00 도착 → 60분 체류 → 15분 이동 → 12:15
    const out = computeDayArrivals(places, [seg(30), seg(15)], null, dayStart, 0)
    expect(out.map(a => hhmm(a.localTime))).toEqual(['09:00', '11:00', '12:15'])
  })

  it('전날 마지막 장소가 있으면 segments[0]이 전날→오늘 이동이라 출발이 밀린다', () => {
    const prev = place({ id: 99 })
    const places = [place({ id: 1 }), place({ id: 2 })]
    // 09:00 + 45분(전날→오늘) = 09:45 첫 도착
    const out = computeDayArrivals(places, [seg(45), seg(20)], prev, dayStart, 0)
    expect(out.map(a => hhmm(a.localTime))).toEqual(['09:45', '11:05'])
  })

  it('전날 장소는 결과에 포함되지 않는다', () => {
    const prev = place({ id: 99 })
    const out = computeDayArrivals([place({ id: 1 })], [seg(45)], prev, dayStart, 0)
    expect(out.map(a => a.place.id)).toEqual([1])
  })

  it('마지막 장소 뒤의 이동 구간은 무시한다', () => {
    const places = [place({ id: 1 }), place({ id: 2 })]
    const out = computeDayArrivals(places, [seg(30), seg(999)], null, dayStart, 0)
    expect(out.map(a => hhmm(a.localTime))).toEqual(['09:00', '10:30'])
  })

  it('이동 구간이 null이면 이동시간 0으로 본다', () => {
    const places = [place({ id: 1 }), place({ id: 2 })]
    const out = computeDayArrivals(places, [null], null, dayStart, 0)
    expect(out.map(a => hhmm(a.localTime))).toEqual(['09:00', '10:00'])
  })

  it('장소가 없으면 빈 배열', () => {
    expect(computeDayArrivals([], [seg(10)], null, dayStart, 0)).toEqual([])
  })

  it('dayIndex를 그대로 실어 보낸다', () => {
    const out = computeDayArrivals([place({ id: 1 })], [], null, dayStart, 4)
    expect(out[0].dayIndex).toBe(4)
  })

  // --- 시간대: 일정표에 보이는 벽시계 숫자를 기기 시계로 읽는다 ---

  it('해외 장소여도 일정표의 벽시계 시각을 기기 시계로 준다', () => {
    // 방콕(UTC+7) 장소. 일정표는 09:00으로 보여주므로 알림도 기기 09:00.
    const bangkok = place({ id: 1, utcOffsetMinutes: 420 })
    const out = computeDayArrivals([bangkok], [], null, dayStart, 0)
    expect(hhmm(out[0].localTime)).toBe('09:00')
  })

  it('시차가 다른 장소로 이동하면 현지 벽시계가 반영된다', () => {
    // 서울(+9) 09:00 출발 → 60분 체류 → 120분 비행 → 방콕(+7) 도착.
    // 절대시각으로 +3h인데 시차 -2h라서 현지 벽시계는 10:00.
    const seoul = place({ id: 1, utcOffsetMinutes: 540, duration: 60 })
    const bkk = place({ id: 2, utcOffsetMinutes: 420 })
    const out = computeDayArrivals([seoul, bkk], [seg(120)], null, dayStart, 0)
    expect(hhmm(out[0].localTime)).toBe('09:00')
    expect(hhmm(out[1].localTime)).toBe('10:00')
  })

  it('시차로 날짜가 넘어가도 날짜 필드가 따라간다', () => {
    // 서울(+9) 22:00 출발 → 0분 체류 → 300분 이동 → 하와이(-10)
    // 절대 13:00Z + 5h = 18:00Z → 하와이 08:00 (같은 날)
    const lateStart = new Date(2026, 4, 10, 22, 0, 0)
    const seoul = place({ id: 1, utcOffsetMinutes: 540, duration: 0 })
    const honolulu = place({ id: 2, utcOffsetMinutes: -600 })
    const out = computeDayArrivals([seoul, honolulu], [seg(300)], null, lateStart, 0)
    expect(hhmm(out[0].localTime)).toBe('22:00')
    expect(hhmm(out[1].localTime)).toBe('08:00')
    // 하와이는 날짜가 하루 전
    expect(out[1].localTime.getDate()).toBe(10)
  })

  it('오프셋 정보가 없는 장소는 기기 시각 그대로 쓴다', () => {
    const out = computeDayArrivals([place({ id: 1 }), place({ id: 2 })], [seg(30)], null, dayStart, 0)
    expect(out.map(a => hhmm(a.localTime))).toEqual(['09:00', '10:30'])
  })

  it('초/밀리초는 0으로 떨어진다 (알림이 애매한 시각에 울지 않도록)', () => {
    const out = computeDayArrivals([place({ id: 1 })], [], null, new Date(2026, 4, 10, 9, 0, 37, 500), 0)
    expect(out[0].localTime.getSeconds()).toBe(0)
    expect(out[0].localTime.getMilliseconds()).toBe(0)
  })
})

describe('splitDayPlaces', () => {
  const places = [
    place({ id: 1, dayIndex: 0 }),
    place({ id: 2, dayIndex: 0 }),
    place({ id: 3, dayIndex: 1 }),
    place({ id: 4, dayIndex: 2 }),
  ]

  it('해당 날의 장소만 고른다', () => {
    expect(splitDayPlaces(places, 0).dayPlaces.map(p => p.id)).toEqual([1, 2])
  })

  it('Day 1은 전날 장소가 없다', () => {
    expect(splitDayPlaces(places, 0).prevDayLastPlace).toBeNull()
  })

  it('전날의 마지막 장소를 집는다', () => {
    expect(splitDayPlaces(places, 1).prevDayLastPlace?.id).toBe(2)
  })

  it('전날이 비어 있으면 null', () => {
    const sparse = [place({ id: 1, dayIndex: 0 }), place({ id: 9, dayIndex: 2 })]
    expect(splitDayPlaces(sparse, 2).prevDayLastPlace).toBeNull()
  })

  it('dayIndex 없는 장소는 Day 1로 본다', () => {
    const legacy = [place({ id: 1 }), place({ id: 2, dayIndex: 1 })]
    expect(splitDayPlaces(legacy, 0).dayPlaces.map(p => p.id)).toEqual([1])
  })
})

describe('segmentInputPlaces', () => {
  it('전날 마지막 장소를 앞에 붙인다', () => {
    const r = segmentInputPlaces([place({ id: 2 })], place({ id: 1 }))
    expect(r.map(p => p.id)).toEqual([1, 2])
  })

  it('없으면 그대로', () => {
    const r = segmentInputPlaces([place({ id: 2 })], null)
    expect(r.map(p => p.id)).toEqual([2])
  })
})

describe('tripTotalDays', () => {
  it('출발·귀국 날짜로 일수를 센다 (당일치기는 1)', () => {
    const d = (m: number, day: number) => new Date(2026, m, day).toISOString()
    expect(tripTotalDays(d(4, 10), d(4, 10))).toBe(1)
    expect(tripTotalDays(d(4, 10), d(4, 12))).toBe(3)
  })

  it('날짜가 없으면 1', () => {
    expect(tripTotalDays(null, null)).toBe(1)
    expect(tripTotalDays(new Date(2026, 4, 10).toISOString(), null)).toBe(1)
  })

  it('귀국이 출발보다 빠르면 최소 1', () => {
    const d = (day: number) => new Date(2026, 4, day).toISOString()
    expect(tripTotalDays(d(12), d(10))).toBe(1)
  })

  it('잘못된 날짜는 1', () => {
    expect(tripTotalDays('nope', 'nope')).toBe(1)
  })
})

describe('modesForDay / durationsForDay', () => {
  it('해당 날의 배열을 돌려준다', () => {
    expect(modesForDay({ 0: ['TRANSIT'], 1: ['WALKING'] }, 1)).toEqual(['WALKING'])
    expect(durationsForDay({ 2: [15, null] }, 2)).toEqual([15, null])
  })

  it('없는 날이나 undefined는 빈 배열', () => {
    expect(modesForDay({ 0: ['TRANSIT'] }, 5)).toEqual([])
    expect(modesForDay(undefined, 0)).toEqual([])
    expect(durationsForDay(undefined, 0)).toEqual([])
  })

  it('배열이 아닌 값이 들어 있어도 빈 배열 (저장 데이터 손상 방어)', () => {
    expect(modesForDay({ 0: 'oops' as never }, 0)).toEqual([])
    expect(durationsForDay({ 0: 42 as never }, 0)).toEqual([])
  })
})
