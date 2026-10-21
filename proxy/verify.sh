#!/usr/bin/env bash
# 배포된 프록시가 정상 동작하는지 검증한다.
# 사용법: ./verify.sh <프록시URL> <APP_TOKEN>
set -uo pipefail

URL="${1:-}"
TOKEN="${2:-}"
if [ -z "$URL" ] || [ -z "$TOKEN" ]; then
  echo "사용법: ./verify.sh https://gurmi-maps-proxy.xxx.workers.dev <APP_TOKEN>" >&2
  exit 2
fi
URL="${URL%/}"

pass=0; fail=0
ok()   { echo "  ✅ $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ $1"; fail=$((fail+1)); }

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
# body/jstatus는 경로만 받는다 (URL은 내부에서 붙인다)
body() { curl -s -H "x-app-token: $TOKEN" "$URL$1"; }
# 응답 JSON의 status 값만 뽑는다 (jq 없이)
jstatus() { body "$1" | tr -d ' \n' | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p'; }

echo "대상: $URL"
echo
echo "[1] 접근 제어"
[ "$(code "$URL/timezone/json?location=37.5,127&timestamp=1")" = "401" ] \
  && ok "토큰 없이 차단(401)" || bad "토큰 없이도 통과 — APP_TOKEN이 등록됐는지 확인"
[ "$(code -H "x-app-token: wrong-$TOKEN" "$URL/timezone/json?location=37.5,127&timestamp=1")" = "401" ] \
  && ok "틀린 토큰 차단(401)" || bad "틀린 토큰이 통과함"
[ "$(code "$URL/place/photo")" = "404" ] \
  && ok "허용 외 경로 차단(404)" || bad "허용 외 경로가 열려 있음 — open proxy 위험"
[ "$(code -X POST -H "x-app-token: $TOKEN" "$URL/timezone/json")" = "405" ] \
  && ok "POST 차단(405)" || bad "POST가 통과함"

echo
echo "[2] 엔드포인트 (Google 응답 status)"
check() { # <라벨> <경로> <기대status...>
  local label="$1" path="$2"; shift 2
  local s; s="$(jstatus "$path")"
  for want in "$@"; do
    [ "$s" = "$want" ] && { ok "$label → $s"; return; }
  done
  bad "$label → ${s:-응답없음} (기대: $*)"
}
check "timezone"       "/timezone/json?location=37.5665%2C126.978&timestamp=1700000000" OK
check "geocode"        "/geocode/json?latlng=37.5665%2C126.978&language=ko" OK
check "textsearch"     "/place/textsearch/json?query=%EA%B2%BD%EB%B3%B5%EA%B6%81&language=ko" OK
check "autocomplete"   "/place/autocomplete/json?input=%EA%B2%BD%EB%B3%B5&location=37.5%2C127&radius=20000&language=ko" OK
check "nearbysearch"   "/place/nearbysearch/json?location=37.5665%2C126.978&radius=5000&type=tourist_attraction&language=ko" OK
check "distancematrix" "/distancematrix/json?origins=37.5665%2C126.978&destinations=37.5796%2C126.977&mode=driving&language=ko" OK
# 한국은 Google이 driving/walking 경로를 제공하지 않아 ZERO_RESULTS가 정상이다.
# transit으로 확인한다.
check "directions"     "/directions/json?origin=37.5665%2C126.978&destination=35.1798%2C129.075&mode=transit&language=ko" OK

echo
echo "[3] 키 노출 / 주입 차단"
leak=$(curl -s -D- -H "x-app-token: $TOKEN" "$URL/geocode/json?latlng=37.5%2C127&language=ko" | grep -c "AIzaSy" || true)
[ "$leak" = "0" ] && ok "응답에 Google 키 없음" || bad "응답에 키가 노출됨 ($leak 건)"

s=$(jstatus "/timezone/json?location=37.5%2C127&timestamp=1700000000&key=AIzaSyATTACKERFAKE123")
[ "$s" = "OK" ] && ok "클라이언트 key 덮어쓰기 무시" || bad "클라이언트 key가 전달됨 ($s)"

# 파이프에 head를 쓰면 curl이 SIGPIPE로 죽어 pipefail에 걸리므로 변수에 받는다.
jsonp_body="$(body "/geocode/json?latlng=37.5%2C127&callback=evilFn")"
case "$jsonp_body" in
  '{'*) ok "JSONP(callback) 주입 차단" ;;
  *)    bad "callback이 전달돼 JSONP로 응답함" ;;
esac

echo
echo "────────────────"
echo "통과 $pass / 실패 $fail"
[ "$fail" -eq 0 ] || { echo "실패가 있으면 키 분리 다음 단계로 넘어가지 말 것."; exit 1; }
echo "정상입니다."
