import { fetchSegment, fetchTravelSegments } from '../utils/distanceMatrix'
import type { Place } from '../types'

const placeA: Place = { id: 1, name: '서울역', lat: 37.5547, lng: 126.9707, address: '서울', duration: 60 }
const placeB: Place = { id: 2, name: '강남역', lat: 37.4979, lng: 127.0276, address: '강남', duration: 60 }
const placeC: Place = { id: 3, name: '홍대입구역', lat: 37.5573, lng: 126.9245, address: '홍대', duration: 60 }

// fetch mock
const mockFetch = jest.fn()
global.fetch = mockFetch

function makeApiResponse(status: string, durationSec = 1200, distanceText = '8.5 km') {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      rows: [{ elements: [{ status, duration: { value: durationSec }, distance: { text: distanceText } }] }],
    }),
  }
}

beforeEach(() => mockFetch.mockReset())

describe('fetchSegment', () => {
  test('API OK → 분 단위 duration과 distance 반환', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('OK', 1200, '8.5 km'))
    const result = await fetchSegment(placeA, placeB, 'DRIVING')
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(20)
    expect(result!.distance).toBe('8.5 km')
    expect(result!.mode).toBe('DRIVING')
  })

  test('1초 미만 올림 → 1분 반환', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('OK', 1, '0.1 km'))
    const result = await fetchSegment(placeA, placeB, 'DRIVING')
    expect(result!.duration).toBe(1)
  })

  test('ZERO_RESULTS → 직선거리 추정 fallback (null 아님)', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('ZERO_RESULTS'))
    const result = await fetchSegment(placeA, placeB, 'WALKING')
    expect(result).not.toBeNull()
    expect(result!.duration).toBeGreaterThan(0)
    expect(result!.mode).toBe('WALKING')
  })

  test('fetch 예외 → 직선거리 추정 fallback', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const result = await fetchSegment(placeA, placeB, 'DRIVING')
    expect(result).not.toBeNull()
    expect(result!.duration).toBeGreaterThan(0)
  })

  test('OTHER + customDuration 있음 → 입력값 그대로 반환', async () => {
    const result = await fetchSegment(placeA, placeB, 'OTHER', 45)
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(45)
    expect(result!.mode).toBe('OTHER')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('OTHER + customDuration 없음 → null 반환', async () => {
    const result = await fetchSegment(placeA, placeB, 'OTHER', null)
    expect(result).toBeNull()
  })
})

describe('fetchTravelSegments', () => {
  test('장소 2개 미만 → 빈 배열', async () => {
    const result = await fetchTravelSegments([placeA], 'DRIVING')
    expect(result).toEqual([])
  })

  test('장소 3개 → 구간 2개 반환', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('OK', 600, '5.0 km'))
    const result = await fetchTravelSegments([placeA, placeB, placeC], 'DRIVING')
    expect(result).toHaveLength(2)
  })

  test('segmentModes 지정 → 각 구간에 해당 모드 적용', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('OK', 900, '3.0 km'))
    const result = await fetchTravelSegments([placeA, placeB, placeC], 'DRIVING', ['TRANSIT', 'WALKING'])
    expect(result[0]!.mode).toBe('TRANSIT')
    expect(result[1]!.mode).toBe('WALKING')
  })

  test('segmentModes 부족 → defaultMode 사용', async () => {
    mockFetch.mockResolvedValue(makeApiResponse('OK', 900, '3.0 km'))
    const result = await fetchTravelSegments([placeA, placeB, placeC], 'BICYCLING', ['TRANSIT'])
    expect(result[0]!.mode).toBe('TRANSIT')
    expect(result[1]!.mode).toBe('BICYCLING')
  })

  test('OTHER + segmentDurations → 해당 구간 직접 입력값 사용', async () => {
    const result = await fetchTravelSegments(
      [placeA, placeB, placeC], 'DRIVING',
      ['OTHER', 'DRIVING'],
      [30, null]
    )
    expect(result[0]!.duration).toBe(30)
    expect(result[0]!.mode).toBe('OTHER')
  })
})
