import {
  offsetMinutesForZone, effectiveOffset, toZonedDate, zonedWallClockToUtc,
  formatTimeInZone, dayOffsetInZone, dayOffsetLabel, tzLabel, formatOffsetDiff, tzShiftLabel,
} from '../utils/timezone'

describe('offsetMinutesForZone', () => {
  test('서울은 DST 없이 항상 +540', () => {
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-01-15T00:00:00Z'))).toBe(540)
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-07-15T00:00:00Z'))).toBe(540)
  })

  test('파리는 겨울 +60, 여름 서머타임 +120', () => {
    expect(offsetMinutesForZone('Europe/Paris', new Date('2026-01-15T12:00:00Z'))).toBe(60)
    expect(offsetMinutesForZone('Europe/Paris', new Date('2026-07-15T12:00:00Z'))).toBe(120)
  })

  test('30분 단위 시간대 (인도 +330)', () => {
    expect(offsetMinutesForZone('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'))).toBe(330)
  })

  test('음수 오프셋 (뉴욕 겨울 -300, 여름 -240)', () => {
    expect(offsetMinutesForZone('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300)
    expect(offsetMinutesForZone('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(-240)
  })

  test('잘못된 시간대 → null', () => {
    expect(offsetMinutesForZone('Not/AZone', new Date('2026-07-15T12:00:00Z'))).toBeNull()
  })

  test('ms 단위가 섞여도 분 단위로 정확히 나온다', () => {
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-07-15T12:34:56.789Z'))).toBe(540)
  })

  test('현지 자정 정각에도 하루가 밀리지 않는다 (h23 hourCycle)', () => {
    // 서울 현지 2026-07-16 00:00 = UTC 2026-07-15 15:00
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-07-15T15:00:00Z'))).toBe(540)
    // 파리 현지 자정 (여름 +120) = UTC 22:00
    expect(offsetMinutesForZone('Europe/Paris', new Date('2026-07-15T22:00:00Z'))).toBe(120)
    // 뉴욕 현지 자정 (여름 -240) = UTC 04:00
    expect(offsetMinutesForZone('America/New_York', new Date('2026-07-15T04:00:00Z'))).toBe(-240)
  })

  test('DST 전환 경계 — 파리 2026-03-29 01:00 UTC 전후', () => {
    // 전환 직전 (UTC 00:59) → +60, 직후 (UTC 01:00) → +120
    expect(offsetMinutesForZone('Europe/Paris', new Date('2026-03-29T00:59:00Z'))).toBe(60)
    expect(offsetMinutesForZone('Europe/Paris', new Date('2026-03-29T01:00:00Z'))).toBe(120)
  })
})

describe('effectiveOffset', () => {
  const summer = new Date('2026-07-15T12:00:00Z')
  const winter = new Date('2026-01-15T12:00:00Z')

  test('timeZoneId 있으면 그 시점 DST 반영값을 쓴다 (저장값 무시)', () => {
    // 겨울(+60)에 저장된 파리 장소를 여름에 방문 → +120
    const place = { timeZoneId: 'Europe/Paris', utcOffsetMinutes: 60 }
    expect(effectiveOffset(place, summer)).toBe(120)
    expect(effectiveOffset(place, winter)).toBe(60)
  })

  test('timeZoneId 없으면 저장된 오프셋 사용 (구버전 데이터)', () => {
    expect(effectiveOffset({ utcOffsetMinutes: 540 }, summer)).toBe(540)
  })

  test('둘 다 없으면 undefined', () => {
    expect(effectiveOffset({}, summer)).toBeUndefined()
  })

  test('timeZoneId가 유효하지 않으면 저장된 오프셋으로 fallback', () => {
    expect(effectiveOffset({ timeZoneId: 'Not/AZone', utcOffsetMinutes: 60 }, summer)).toBe(60)
  })
})

describe('Intl 미지원 환경 fallback', () => {
  const RealIntl = global.Intl

  afterEach(() => { global.Intl = RealIntl })

  test('Intl이 던지면 offsetMinutesForZone은 null', () => {
    global.Intl = { DateTimeFormat: () => { throw new Error('no Intl') } } as unknown as typeof Intl
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-07-15T12:00:00Z'))).toBeNull()
  })

  test('Intl이 던져도 저장된 오프셋으로 동작한다', () => {
    global.Intl = { DateTimeFormat: () => { throw new Error('no Intl') } } as unknown as typeof Intl
    const place = { timeZoneId: 'Europe/Paris', utcOffsetMinutes: 120 }
    expect(effectiveOffset(place, new Date('2026-07-15T12:00:00Z'))).toBe(120)
  })

  test('formatToParts가 없어도 크래시하지 않는다', () => {
    global.Intl = { DateTimeFormat: () => ({}) } as unknown as typeof Intl
    expect(offsetMinutesForZone('Asia/Seoul', new Date('2026-07-15T12:00:00Z'))).toBeNull()
    expect(effectiveOffset({ timeZoneId: 'Asia/Seoul', utcOffsetMinutes: 540 }, new Date())).toBe(540)
  })
})

describe('toZonedDate', () => {
  test('오프셋 없으면 그대로', () => {
    const d = new Date('2026-07-15T12:00:00Z')
    expect(toZonedDate(d, undefined).getTime()).toBe(d.getTime())
  })

  test('UTC 03:00을 +540(서울)으로 보면 12시', () => {
    const d = new Date('2026-07-15T03:00:00Z')
    expect(toZonedDate(d, 540).getHours()).toBe(12)
  })

  test('음수 오프셋 (뉴욕 -240): UTC 16:00 → 12시', () => {
    const d = new Date('2026-07-15T16:00:00Z')
    expect(toZonedDate(d, -240).getHours()).toBe(12)
  })
})

describe('zonedWallClockToUtc', () => {
  test('오프셋 없으면 절대 시각 그대로 (복사본)', () => {
    const d = new Date('2026-07-15T09:00:00')
    const out = zonedWallClockToUtc(d, undefined)
    expect(out.getTime()).toBe(d.getTime())
    expect(out).not.toBe(d)
  })

  test('벽시계 09:00을 +540(서울)으로 해석 → UTC 00:00', () => {
    const wall = new Date('2026-07-15T09:00:00') // 기기 로컬 09:00
    const utc = zonedWallClockToUtc(wall, 540)
    expect(utc.toISOString()).toBe('2026-07-15T00:00:00.000Z')
  })

  test('벽시계 09:00을 +120(파리 여름)으로 해석 → UTC 07:00', () => {
    const wall = new Date('2026-07-15T09:00:00')
    expect(zonedWallClockToUtc(wall, 120).toISOString()).toBe('2026-07-15T07:00:00.000Z')
  })

  test('toZonedDate와 왕복하면 원래 벽시계 시각이 복원된다', () => {
    const wall = new Date('2026-07-15T09:30:00')
    for (const off of [540, 120, -240, 330, 0]) {
      const back = toZonedDate(zonedWallClockToUtc(wall, off), off)
      expect(formatTimeInZone(back, undefined)).toBe('09:30')
    }
  })
})

describe('formatTimeInZone', () => {
  test('각 장소 시간대의 현지 시각으로 표시', () => {
    const utc = new Date('2026-07-15T00:00:00Z')
    expect(formatTimeInZone(utc, 540)).toBe('09:00')   // 서울
    expect(formatTimeInZone(utc, 120)).toBe('02:00')   // 파리(여름)
    expect(formatTimeInZone(utc, -240)).toBe('20:00')  // 뉴욕(여름), 전날
    expect(formatTimeInZone(utc, 330)).toBe('05:30')   // 인도
  })
})

describe('dayOffsetInZone', () => {
  test('같은 날이면 0', () => {
    const base = new Date('2026-07-15T00:00:00Z')
    const target = new Date('2026-07-15T08:00:00Z')
    expect(dayOffsetInZone(base, target, 540, 540)).toBe(0)
  })

  test('현지 자정을 넘기면 +1', () => {
    // 서울 09:00 출발, 20시간 뒤 → 서울 05:00 다음날
    const base = new Date('2026-07-15T00:00:00Z')
    const target = new Date('2026-07-15T20:00:00Z')
    expect(dayOffsetInZone(base, target, 540, 540)).toBe(1)
  })

  test('도착지 시간대가 달라 날짜가 되돌아가면 음수', () => {
    // 서울 기준 7/15 09:00 출발, 2시간 비행 → 뉴욕 현지로는 아직 7/14 21:00
    const base = new Date('2026-07-15T00:00:00Z')
    const target = new Date('2026-07-15T02:00:00Z')
    expect(dayOffsetInZone(base, target, 540, -240)).toBe(-1)
  })

  test('도착지 오프셋 생략 시 기준 오프셋을 재사용', () => {
    const base = new Date('2026-07-15T00:00:00Z')
    const target = new Date('2026-07-15T20:00:00Z')
    expect(dayOffsetInZone(base, target, 540)).toBe(1)
  })

  test('오프셋이 전부 없으면 기기 로컬 날짜로 비교', () => {
    const base = new Date('2026-07-15T09:00:00')
    const target = new Date('2026-07-16T09:00:00')
    expect(dayOffsetInZone(base, target)).toBe(1)
  })
})

describe('dayOffsetLabel', () => {
  test('같은 날은 null', () => expect(dayOffsetLabel(0)).toBeNull())
  test('다음날', () => expect(dayOffsetLabel(1)).toBe('+1일'))
  test('전날 (서쪽 비행)', () => expect(dayOffsetLabel(-1)).toBe('-1일'))
  test('이틀 뒤', () => expect(dayOffsetLabel(2)).toBe('+2일'))
})

describe('tzLabel', () => {
  test('정시 오프셋', () => expect(tzLabel(540)).toBe(' (UTC+9)'))
  test('30분 오프셋', () => expect(tzLabel(330)).toBe(' (UTC+5:30)'))
  test('음수 오프셋', () => expect(tzLabel(-240)).toBe(' (UTC-4)'))
  test('음수 30분 오프셋 (뉴펀들랜드 -210)', () => expect(tzLabel(-210)).toBe(' (UTC-3:30)'))
  test('UTC 0', () => expect(tzLabel(0)).toBe(' (UTC0)'))
  test('없으면 빈 문자열', () => expect(tzLabel(undefined)).toBe(''))
})

describe('formatOffsetDiff', () => {
  test('양수', () => expect(formatOffsetDiff(540)).toBe('+9'))
  test('음수', () => expect(formatOffsetDiff(-420)).toBe('-7'))
  test('30분', () => expect(formatOffsetDiff(-210)).toBe('-3:30'))
  test('0', () => expect(formatOffsetDiff(0)).toBe('0'))
})

describe('tzShiftLabel', () => {
  test('서울 → 파리(여름): 시차 -7시간', () => {
    expect(tzShiftLabel(540, 120)).toBe('시차 -7시간')
  })

  test('파리 → 서울: 시차 +7시간', () => {
    expect(tzShiftLabel(120, 540)).toBe('시차 +7시간')
  })

  test('30분 단위 포함 (서울 → 인도 -3시간 30분)', () => {
    expect(tzShiftLabel(540, 330)).toBe('시차 -3시간 30분')
  })

  test('1시간 미만 차이는 분만 표시', () => {
    expect(tzShiftLabel(540, 510)).toBe('시차 -30분')
  })

  test('시차 없으면 null (표시 안 함)', () => {
    expect(tzShiftLabel(540, 540)).toBeNull()
  })

  test('한쪽 정보가 없으면 null', () => {
    expect(tzShiftLabel(undefined, 540)).toBeNull()
    expect(tzShiftLabel(540, undefined)).toBeNull()
  })
})

describe('타임라인 시나리오 — 서울 출발 파리 도착', () => {
  // 서울(+540) 09:00 출발 → 비행 12시간 → 파리(+120, 여름) 도착
  test('파리 현지 도착 시각은 14:00, 날짜는 안 넘어감', () => {
    const wall = new Date('2026-07-15T09:00:00')
    const departUtc = zonedWallClockToUtc(wall, 540)
    expect(formatTimeInZone(departUtc, 540)).toBe('09:00')

    const arriveUtc = new Date(departUtc.getTime() + 12 * 60 * 60000)
    expect(formatTimeInZone(arriveUtc, 120)).toBe('14:00')
    expect(dayOffsetInZone(departUtc, arriveUtc, 540, 120)).toBe(0)
  })

  test('같은 절대 시각이라도 서울 기준으로는 21:00 (같은 날)', () => {
    const departUtc = zonedWallClockToUtc(new Date('2026-07-15T09:00:00'), 540)
    const arriveUtc = new Date(departUtc.getTime() + 12 * 60 * 60000)
    expect(formatTimeInZone(arriveUtc, 540)).toBe('21:00')
    expect(dayOffsetInZone(departUtc, arriveUtc, 540, 540)).toBe(0)
  })

  test('비행 20시간이면 파리 현지로 다음날 05:00 (+1일)', () => {
    const departUtc = zonedWallClockToUtc(new Date('2026-07-15T09:00:00'), 540)
    const arriveUtc = new Date(departUtc.getTime() + 20 * 60 * 60000)
    expect(formatTimeInZone(arriveUtc, 120)).toBe('22:00')
    expect(dayOffsetInZone(departUtc, arriveUtc, 540, 120)).toBe(0)

    const later = new Date(departUtc.getTime() + 28 * 60 * 60000)
    expect(formatTimeInZone(later, 120)).toBe('06:00')
    expect(dayOffsetInZone(departUtc, later, 540, 120)).toBe(1)
  })
})
