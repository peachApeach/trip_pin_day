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
  '/place/photo',
  '/geocode/json',
  '/distancematrix/json',
  '/directions/json',
  '/timezone/json',
])

// 사진만 JSON이 아니라 이미지 바이트를 돌려준다. 응답 처리가 달라서 따로 둔다.
const PHOTO_PATH = '/place/photo'

// 클라이언트가 보낼 수 있는 쿼리 파라미터. key는 서버가 주입하므로
// 클라이언트가 보낸 key는 무시한다(덮어쓰기 방지).
const ALLOWED_PARAMS = new Set([
  'query', 'input', 'place_id', 'fields', 'pagetoken',
  'location', 'latlng', 'radius', 'rankby', 'keyword', 'type',
  'origin', 'destination', 'origins', 'destinations', 'mode',
  'timestamp', 'language',
  'photo_reference', 'maxwidth', 'maxheight',
])

/**
 * 사진 크기 상한. 상한이 없으면 호출자가 maxwidth=4000으로 대용량 이미지를
 * 반복 요청해 할당량과 대역폭을 태울 수 있다. 카드 썸네일에는 이 정도면 충분하다.
 */
const PHOTO_MAX_PX = 800

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

/**
 * 장소 사진 중계. Google은 302로 실제 이미지 호스트를 가리키는데,
 * 그 Location URL에 키가 들어 있지 않으므로 리다이렉트를 따라가
 * 이미지 바이트만 돌려준다. redirect를 클라이언트에 넘기면
 * 앱이 Google 도메인을 직접 타게 되어 중계 의미가 줄어든다.
 */
async function photo(upstream, ctx) {
  // 사진은 photo_reference가 같으면 내용이 바뀌지 않는다. 길게 캐시한다.
  const ttl = 60 * 60 * 24 * 30
  const cacheKey = new Request(upstream.toString(), { method: 'GET' })
  const cache = caches.default

  const hit = await cache.match(cacheKey)
  if (hit) return hit

  let res
  try {
    res = await fetch(upstream.toString(), { redirect: 'follow' })
  } catch {
    return deny(502, 'photo fetch failed')
  }

  const type = res.headers.get('content-type') ?? ''
  // 에러일 때 Google은 JSON이나 HTML을 준다. 그걸 이미지로 캐시하면 안 된다.
  if (!res.ok || !type.startsWith('image/')) {
    return deny(502, 'photo unavailable')
  }

  const out = new Response(res.body, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': `public, max-age=${ttl}`,
    },
  })
  ctx.waitUntil(cache.put(cacheKey, out.clone()))
  return out
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

    if (url.pathname === PHOTO_PATH) {
      if (!upstream.searchParams.get('photo_reference')) {
        return deny(400, 'photo_reference required')
      }
      // 크기를 상한으로 깎는다. 둘 다 없으면 기본값을 넣어
      // Google이 원본 크기를 돌려주지 않게 한다.
      let sized = false
      for (const p of ['maxwidth', 'maxheight']) {
        const raw = upstream.searchParams.get(p)
        if (raw == null) continue
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) { upstream.searchParams.delete(p); continue }
        upstream.searchParams.set(p, String(Math.min(Math.floor(n), PHOTO_MAX_PX)))
        sized = true
      }
      if (!sized) upstream.searchParams.set('maxwidth', String(PHOTO_MAX_PX))
      return photo(upstream, ctx)
    }

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
