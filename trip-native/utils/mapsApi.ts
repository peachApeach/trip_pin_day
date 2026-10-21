import { MAPS_PROXY_URL, MAPS_PROXY_TOKEN, GOOGLE_MAPS_API_KEY } from '../constants'

/**
 * Google Maps 웹서비스 API 호출을 프록시 경유로 만든다.
 *
 * 프록시를 쓰는 이유: Places/Geocoding/Distance Matrix/Directions/Time Zone은
 * 웹서비스 API여서 Android 패키지명·iOS 번들 ID 제한이 적용되지 않는다.
 * 앱에서 직접 부르면 키가 번들에 평문으로 남고 추출 시 누구나 쓸 수 있다.
 * 네이티브 지도 렌더링용 Maps SDK 키는 프록시가 불가능해 앱에 남지만,
 * 그 키는 앱 제한이 적용되므로 추출해도 다른 곳에서 못 쓴다.
 *
 * MAPS_PROXY_URL이 비어 있으면 Google을 직접 호출한다. 프록시 배포 전이나
 * 로컬 개발에서 앱이 멈추지 않게 하기 위한 fallback이며, 이 경로로는
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY가 번들에 노출된다.
 */
const DIRECT_BASE = 'https://maps.googleapis.com/maps/api'

export function isProxied(): boolean {
  return !!MAPS_PROXY_URL
}

/**
 * path는 '/timezone/json'처럼 선행 슬래시를 포함한 API 경로.
 * params 값은 URLSearchParams가 인코딩하므로 호출부에서
 * encodeURIComponent를 중복 적용하면 안 된다.
 */
export function mapsUrl(path: string, params: Record<string, string | number>): string {
  const base = MAPS_PROXY_URL ? MAPS_PROXY_URL.replace(/\/$/, '') : DIRECT_BASE
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === '' || v == null) continue
    qs.set(k, String(v))
  }
  // 프록시는 서버에서 key를 주입한다. 직접 호출일 때만 앱의 키를 붙인다.
  if (!MAPS_PROXY_URL) qs.set('key', GOOGLE_MAPS_API_KEY)
  return `${base}${path}?${qs.toString()}`
}

export function mapsHeaders(): Record<string, string> {
  return MAPS_PROXY_URL && MAPS_PROXY_TOKEN ? { 'x-app-token': MAPS_PROXY_TOKEN } : {}
}

/** mapsUrl + 토큰 헤더를 함께 적용한 fetch. */
export function mapsFetch(path: string, params: Record<string, string | number>): Promise<Response> {
  return fetch(mapsUrl(path, params), { headers: mapsHeaders() })
}
