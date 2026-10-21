import { fetchTimeZone } from '../utils/timezone'
import { fetchSegment } from '../utils/distanceMatrix'

const P = (lat: any, lng: any) => ({ id: 1, name: 'x', lat, lng, address: '', duration: 60 } as any)

describe('주입 차단 end-to-end', () => {
  beforeEach(() => { (global as any).fetch = jest.fn() })

  test('손상된 lat이면 fetch 자체를 호출하지 않는다', async () => {
    const r = await fetchTimeZone('0&key=ATTACKER&x=' as any, 1, 1700000000)
    expect(r).toBeNull()
    expect((global as any).fetch).not.toHaveBeenCalled()
  })

  test('정상 좌표는 그대로 URL에 실린다', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      json: async () => ({ status: 'OK', timeZoneId: 'Asia/Seoul', rawOffset: 32400, dstOffset: 0 }),
    })
    const r = await fetchTimeZone(37.5665, 126.978, 1700000000)
    expect(r).toEqual({ timeZoneId: 'Asia/Seoul', utcOffsetMinutes: 540 })
    const url = (global as any).fetch.mock.calls[0][0]
    // URLSearchParams가 쉼표를 %2C로 인코딩한다 — Google이 그대로 받는다.
    expect(decodeURIComponent(url)).toContain('location=37.5665,126.978')
    expect(url).toContain('timestamp=1700000000')
  })

  test('distanceMatrix: 손상 좌표는 fetch 없이 구간 없음 처리', async () => {
    const seg = await fetchSegment(P('1&key=EVIL', 1), P(37.6, 127.0), 'DRIVING')
    expect((global as any).fetch).not.toHaveBeenCalled()
    // NaN분으로 표시되지 않도록 null 반환 (UI는 '이동수단을 선택하면 계산돼요' 표시)
    expect(seg).toBeNull()
  })

  test('directions: 손상 좌표는 fetch 없이 빈 경로', async () => {
    const { fetchRoute } = await import('../utils/directions')
    const coords = await fetchRoute(P(1, '2&key=EVIL'), P(37.6, 127.0), 'DRIVING')
    expect((global as any).fetch).not.toHaveBeenCalled()
    expect(coords).toEqual([])
  })

  test('정상 좌표면 기존 fallback(직선거리 추정)은 그대로 동작', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      json: async () => ({ rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }] }),
    })
    const seg = await fetchSegment(P(37.5665, 126.978), P(37.6, 127.0), 'DRIVING')
    expect(seg).not.toBeNull()
    expect(seg!.duration).toBeGreaterThan(0)
    expect(Number.isNaN(seg!.duration)).toBe(false)
  })
})
