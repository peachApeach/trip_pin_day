/**
 * 구르미 Google Maps API 프록시 (Cloudflare Workers)
 *
 * 앱 번들에 Google API 키를 넣지 않기 위한 중계 서버.
 * 키는 Workers Secret에만 존재하고 응답에도 노출되지 않는다.
 *
 * Maps SDK(네이티브 지도 렌더링)용 키는 앱에 그대로 남는다 — 프록시 불가.
 * 대신 그 키는 Android 패키지명 + SHA-1, iOS 번들 ID 제한이 적용되므로
 * 추출해도 다른 곳에서 쓸 수 없다. 여기서 중계하는 것은 앱 제한이
 * 적용되지 않는 웹 서비스 API들이다.
 */

const UPSTREAM = 'https://maps.googleapis.com/maps/api'

// 중계를 허용하는 경로만 명시. 와일드카드로 열어두면 프록시가
// 임의의 Google API를 호출하는 통로가 된다(open proxy).
const ALLOWED_PATHS = new Set([
  '/place/textsearch/json',
  '/place/autocomplete/json',
  '/place/details/json',
  '/place/nearbysearch/json',
  '/geocode/json',
  '/distancematrix/json',
  '/directions/json',
  '/timezone/json',
])

// 클라이언트가 보낼 수 있는 쿼리 파라미터. key는 서버가 주입하므로
// 클라이언트가 보낸 key는 무시한다(덮어쓰기 방지).
const ALLOWED_PARAMS = new Set([
  'query', 'input', 'place_id', 'fields', 'pagetoken',
  'location', 'latlng', 'radius', 'rankby', 'keyword', 'type',
  'origin', 'destination', 'origins', 'destinations', 'mode',
  'timestamp', 'language',
])

const CACHE_TTL = {
  '/timezone/json': 60 * 60 * 24 * 30, // 타임존은 거의 안 바뀜
  '/geocode/json': 60 * 60 * 24,
  '/place/details/json': 60 * 60 * 6,
  '/distancematrix/json': 60 * 60,
  '/directions/json': 60 * 60,
}

function deny(status, message) {
  return new Response(JSON.stringify({ status: 'REQUEST_DENIED', error_message: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET') return deny(405, 'GET only')

    const url = new URL(request.url)

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return deny(404, 'unsupported path')
    }

    // 앱 토큰 검증. 키 유출은 막아도 프록시 URL은 공개되므로,
    // 아무나 호출해 할당량을 쓰는 것을 1차로 걸러낸다.
    if (env.APP_TOKEN && request.headers.get('x-app-token') !== env.APP_TOKEN) {
      return deny(401, 'invalid app token')
    }

    const upstream = new URL(UPSTREAM + url.pathname)
    for (const [k, v] of url.searchParams) {
      if (ALLOWED_PARAMS.has(k)) upstream.searchParams.set(k, v)
    }
    upstream.searchParams.set('key', env.GOOGLE_MAPS_API_KEY)

    // 같은 쿼리는 엣지 캐시에서 돌려준다. Google 호출량이 줄어
    // 비용과 남용 여지가 함께 내려간다. 캐시 키에는 key가 포함되지만
    // Cloudflare 캐시는 공개되지 않으므로 키가 노출되지는 않는다.
    const ttl = CACHE_TTL[url.pathname]
    const cacheKey = new Request(upstream.toString(), { method: 'GET' })
    const cache = caches.default

    if (ttl) {
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    }

    let res
    try {
      res = await fetch(upstream.toString(), {
        headers: { accept: 'application/json' },
      })
    } catch {
      return deny(502, 'upstream fetch failed')
    }

    const body = await res.text()
    const out = new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(ttl ? { 'cache-control': `public, max-age=${ttl}` } : { 'cache-control': 'no-store' }),
      },
    })

    // 정상 응답만 캐시. ZERO_RESULTS나 에러를 캐시하면 일시적
    // 실패가 TTL 내내 고정된다.
    if (ttl && res.ok) {
      let status
      try { status = JSON.parse(body)?.status } catch {}
      if (status === 'OK') ctx.waitUntil(cache.put(cacheKey, out.clone()))
    }

    return out
  },
}
