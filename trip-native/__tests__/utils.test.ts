// 순수 계산 함수 테스트 (타임라인, 날짜 계산 등)

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}

function calcTotalDays(start: string | null, end: string | null): number {
  if (!start || !end) return 1
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

function calcNights(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return diff > 0 ? `${diff}박 ${diff + 1}일` : ''
}

describe('addMinutes', () => {
  test('60분 더하기', () => {
    const base = new Date('2026-01-01T09:00:00')
    expect(addMinutes(base, 60).getHours()).toBe(10)
    expect(addMinutes(base, 60).getMinutes()).toBe(0)
  })

  test('자정 넘기기', () => {
    const base = new Date('2026-01-01T23:30:00')
    const result = addMinutes(base, 60)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(30)
  })

  test('0분 → 그대로', () => {
    const base = new Date('2026-01-01T09:00:00')
    expect(addMinutes(base, 0).getTime()).toBe(base.getTime())
  })
})

describe('formatTime', () => {
  test('9:05 → 09:05', () => {
    const d = new Date('2026-01-01T09:05:00')
    expect(formatTime(d)).toBe('09:05')
  })

  test('23:59', () => {
    const d = new Date('2026-01-01T23:59:00')
    expect(formatTime(d)).toBe('23:59')
  })

  test('00:00', () => {
    const d = new Date('2026-01-01T00:00:00')
    expect(formatTime(d)).toBe('00:00')
  })
})

describe('formatDuration', () => {
  test('30분', () => expect(formatDuration(30)).toBe('30분'))
  test('60분 → 1시간', () => expect(formatDuration(60)).toBe('1시간'))
  test('90분 → 1시간 30분', () => expect(formatDuration(90)).toBe('1시간 30분'))
  test('120분 → 2시간', () => expect(formatDuration(120)).toBe('2시간'))
  test('0분', () => expect(formatDuration(0)).toBe('0분'))
})

describe('calcTotalDays', () => {
  test('당일치기 → 1일', () => {
    expect(calcTotalDays('2026-01-01', '2026-01-01')).toBe(1)
  })

  test('3박 4일', () => {
    expect(calcTotalDays('2026-01-01', '2026-01-04')).toBe(4)
  })

  test('null → 1', () => {
    expect(calcTotalDays(null, null)).toBe(1)
    expect(calcTotalDays('2026-01-01', null)).toBe(1)
  })
})

describe('calcNights', () => {
  test('3박 4일', () => {
    expect(calcNights('2026-01-01', '2026-01-04')).toBe('3박 4일')
  })

  test('당일치기 → 빈 문자열', () => {
    expect(calcNights('2026-01-01', '2026-01-01')).toBe('')
  })

  test('null → 빈 문자열', () => {
    expect(calcNights(null, null)).toBe('')
  })
})

describe('타임라인 계산', () => {
  test('장소 2개 체류+이동 시간 합산', () => {
    const start = new Date('2026-01-01T09:00:00')
    let current = new Date(start)

    // 장소 A: 체류 60분
    const aFrom = new Date(current)
    current = addMinutes(current, 60)
    const aTo = new Date(current)
    // 이동 30분
    current = addMinutes(current, 30)

    // 장소 B: 체류 90분
    const bFrom = new Date(current)
    current = addMinutes(current, 90)
    const bTo = new Date(current)

    expect(formatTime(aFrom)).toBe('09:00')
    expect(formatTime(aTo)).toBe('10:00')
    expect(formatTime(bFrom)).toBe('10:30')
    expect(formatTime(bTo)).toBe('12:00')
  })
})
