import { fetchRoute, fetchAllRoutes } from '../utils/directions'
import type { Place } from '../types'

const placeA: Place = { id: 1, name: '서울역', lat: 37.5547, lng: 126.9707, address: '서울', duration: 60 }
const placeB: Place = { id: 2, name: '강남역', lat: 37.4979, lng: 127.0276, address: '강남', duration: 60 }
const placeC: Place = { id: 3, name: '홍대', lat: 37.5573, lng: 126.9245, address: '홍대', duration: 60 }

const mockFetch = jest.fn()
global.fetch = mockFetch

// 간단한 폴리라인 인코딩: 두 점 (`_seqEkfaxS` = 37.5,127.0 → 37.55,127.05 대략)
// 실제 디코딩 테스트용으로 알려진 인코딩값 사용
const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'

function makeDirectionsResponse(poly: string | null) {
  return {
    ok: true,
    json: async () => poly
      ? { routes: [{ overview_polyline: { points: poly } }] }
      : { routes: [] },
  }
}

beforeEach(() => mockFetch.mockReset())

describe('fetchRoute', () => {
  test('폴리라인 있음 → 디코딩된 좌표 배열 반환', async () => {
    mockFetch.mockResolvedValue(makeDirectionsResponse(ENCODED))
    const result = await fetchRoute(placeA, placeB, 'DRIVING')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('latitude')
    expect(result[0]).toHaveProperty('longitude')
  })

  test('빈 routes → 직선 fallback 2점 반환', async () => {
    mockFetch.mockResolvedValue(makeDirectionsResponse(null))
    const result = await fetchRoute(placeA, placeB, 'WALKING')
    expect(result).toHaveLength(2)
    expect(result[0].latitude).toBe(placeA.lat)
    expect(result[1].latitude).toBe(placeB.lat)
  })

  test('fetch 예외 → 직선 fallback', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    const result = await fetchRoute(placeA, placeB, 'DRIVING')
    expect(result).toHaveLength(2)
  })

  test('URL에 mode 파라미터 포함', async () => {
    mockFetch.mockResolvedValue(makeDirectionsResponse(ENCODED))
    await fetchRoute(placeA, placeB, 'TRANSIT')
    const url: string = mockFetch.mock.calls[0][0]
    expect(url).toContain('mode=transit')
  })
})

describe('fetchAllRoutes', () => {
  test('장소 2개 미만 → 빈 배열', async () => {
    const result = await fetchAllRoutes([placeA], 'DRIVING', [])
    expect(result).toEqual([])
  })

  test('장소 3개 → 경로 2개 반환', async () => {
    mockFetch.mockResolvedValue(makeDirectionsResponse(ENCODED))
    const result = await fetchAllRoutes([placeA, placeB, placeC], 'DRIVING', [])
    expect(result).toHaveLength(2)
  })

  test('segmentModes 지정 → 각 구간 mode URL 반영', async () => {
    mockFetch.mockResolvedValue(makeDirectionsResponse(ENCODED))
    await fetchAllRoutes([placeA, placeB, placeC], 'DRIVING', ['WALKING', 'TRANSIT'])
    const urls: string[] = mockFetch.mock.calls.map((c: any) => c[0])
    expect(urls[0]).toContain('mode=walking')
    expect(urls[1]).toContain('mode=transit')
  })
})
