# 구르미 Maps API 프록시

앱 번들에 Google API 키를 넣지 않기 위한 Cloudflare Workers 중계 서버.

## 왜 필요한가

Google의 API 키 제한은 API 종류마다 다르게 동작한다.

| API | 앱 제한(패키지명+SHA-1) | 처리 |
|---|---|---|
| Maps SDK (네이티브 지도 렌더링) | ✅ 적용됨 | 앱에 키 유지 — 추출해도 다른 곳에서 못 씀 |
| Places / Geocoding / Distance Matrix / Directions / Time Zone | ❌ 적용 안 됨 | **이 프록시로 중계** |

아래쪽은 HTTP 웹서비스여서 키만 있으면 어디서든 호출된다. 앱에서 직접 부르면
키가 APK에 평문으로 남고, 추출 시 제3자가 할당량을 쓸 수 있다.

## 비용

Workers 무료 플랜은 **일 10만 요청**이고 기간 제한이 없다. 이 앱은 장소 추가
한 번에 호출 몇 개 수준이라 실질적으로 영구 무료다. EC2처럼 상시 띄워둘
인스턴스가 없어 유휴 비용도 없다.

## 배포

wrangler는 Node.js 22+를 요구한다. 이 머신 기본 node가 v21이어서
`wrangler.sh` 래퍼가 22 이상인 node를 자동으로 찾아 실행한다.
아래 npm 스크립트는 모두 그 래퍼를 거치므로 node 버전을 신경 쓸 필요가 없다.

### 1. Cloudflare 로그인

브라우저가 열리고 계정 인증을 한다. 무료 플랜으로 충분하고 카드 등록도 필요 없다.

```bash
npm run login
```

### 2. 비밀값 등록

`wrangler.toml`에 적지 않는다 — git에 올라가면 의미가 없다.
Workers Secret은 암호화 저장되고 대시보드에서도 다시 볼 수 없다.

```bash
npm run secrets
```

순서대로 두 번 입력을 받는다.

1. `GOOGLE_MAPS_API_KEY` — 웹서비스용 Google 키 (아래 "Google 키 분리" 참고)
2. `APP_TOKEN` — 임의의 긴 랜덤 문자열. 아래로 생성한다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 3. 배포

```bash
npm run deploy
```

출력되는 `https://gurmi-maps-proxy.<subdomain>.workers.dev` 주소를 받아둔다.

### 4. 앱 연결

`trip-native/.env`에 주소와 토큰을 넣는다. 토큰은 2단계에서 등록한 값과
**정확히 같아야** 한다 (다르면 전부 401).

```env
EXPO_PUBLIC_MAPS_PROXY_URL=https://gurmi-maps-proxy.xxx.workers.dev
EXPO_PUBLIC_MAPS_PROXY_TOKEN=2단계에서_등록한_APP_TOKEN
```

`.env`는 빌드 시점에 번들로 들어가므로 **앱을 다시 빌드/재시작해야** 적용된다.

### 5. 확인

```bash
# 토큰 없이 → 401
curl -s -o /dev/null -w "%{http_code}\n" "https://<주소>/timezone/json?location=37.5,127&timestamp=1"

# 토큰과 함께 → timeZoneId가 돌아와야 한다
curl -s -H "x-app-token: <APP_TOKEN>" \
  "https://<주소>/timezone/json?location=37.5665,126.978&timestamp=1700000000"
```

두 번째가 `{"timeZoneId":"Asia/Seoul",...,"status":"OK"}`면 성공이다.
`REQUEST_DENIED`가 나오면 Google 키가 잘못됐거나 Time Zone API가
활성화되지 않은 것이다.

`EXPO_PUBLIC_MAPS_PROXY_URL`이 비어 있으면 앱은 Google을 직접 호출한다
(프록시 배포 전에도 동작하게 한 fallback). 그 경로로는 키가 번들에 노출된다.

### 롤백

문제가 생기면 `.env`의 `EXPO_PUBLIC_MAPS_PROXY_URL`을 비우고 다시 빌드하면
직접 호출로 돌아간다. Worker를 지울 필요는 없다.

## Google 키 분리 권장

Cloud Console에서 키를 2개로 나누는 것이 좋다.

1. **앱용** — Maps SDK for Android/iOS만 허용 + 패키지명·번들 ID 제한.
   `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`에 넣는다.
2. **프록시용** — Places·Geocoding·Distance Matrix·Directions·Time Zone만 허용.
   Workers Secret에만 두고 앱에는 넣지 않는다.

이렇게 하면 APK에서 추출 가능한 키로는 지도 렌더링밖에 못 한다.

## 보안 설계

- **경로 allowlist** — `ALLOWED_PATHS`에 없는 경로는 404. 와일드카드로 열면
  임의의 Google API를 부르는 open proxy가 된다.
- **파라미터 allowlist** — `ALLOWED_PARAMS`만 전달. `key`는 목록에 없어서
  클라이언트가 서버 키를 덮어쓸 수 없고, `callback` 같은 JSONP 주입도 막힌다.
- **앱 토큰** — `x-app-token` 헤더 검증. 키 유출은 막아도 프록시 URL은
  공개되므로, 아무나 호출해 할당량을 쓰는 것을 1차로 걸러낸다.
- **GET 전용** — 그 외 메서드는 405.
- **엣지 캐시** — 같은 쿼리는 TTL 내 캐시에서 응답. `status === 'OK'`인
  응답만 캐시해서 일시적 실패가 고정되지 않게 한다.

### 한계

앱 토큰도 APK에서 추출할 수 있다. 키 유출보다 장벽이 높을 뿐 완벽하지 않다.
더 강하게 막으려면 Workers Rate Limiting이나 단말별 토큰 발급이 필요한데,
개인 앱 규모에서는 **토큰 + Cloud Console 할당량 상한** 조합이 합리적이다.
할당량 상한은 프록시와 별개로 반드시 설정해야 한다 — 프록시가 뚫리든
앱 키가 유출되든 청구액에 천장을 만들어준다.

## 로컬 확인

```bash
npm run dev -- --port 8787 --var GOOGLE_MAPS_API_KEY:FAKE --var APP_TOKEN:test

curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/place/photo          # 404
curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/timezone/json        # 401
curl -s -H "x-app-token: test" "localhost:8787/timezone/json?location=37.5,127&timestamp=1"
```

마지막 호출은 가짜 키라 Google이 `REQUEST_DENIED`를 돌려주는데, 그게 곧
중계 경로가 정상 동작한다는 뜻이다.
