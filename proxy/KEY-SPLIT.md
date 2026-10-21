# Google API 키 분리 가이드

프록시를 배포했어도 **같은 키가 앱 번들에 남아 있으면 효과가 절반**이다.
번들에서 추출한 키로 Places·Geocoding을 직접 호출할 수 있기 때문이다.

키를 2개로 나누면 APK에서 꺼낼 수 있는 키로는 지도 렌더링밖에 못 한다.

| 키 | 허용 API | 애플리케이션 제한 | 저장 위치 |
|---|---|---|---|
| **앱용** | Maps SDK for Android / iOS **만** | Android 패키지명+SHA-1, iOS 번들 ID | `trip-native/.env` (번들 포함) |
| **프록시용** | Places, Geocoding, Distance Matrix, Directions, Time Zone **만** | 없음 (웹서비스는 적용 불가) | Workers Secret |

## 순서가 중요하다

현재 키 하나를 앱과 프록시가 **동시에** 쓰고 있다.
기존 키에 먼저 제한을 걸면 **프록시가 즉시 죽는다.**

반드시 아래 순서를 지킨다.

```
1. 프록시용 키를 새로 만든다        (기존 키는 건드리지 않음 → 앱 계속 동작)
2. Workers Secret을 새 키로 교체    (프록시가 새 키로 동작)
3. 프록시 동작을 확인한다           ← 여기서 깨지면 4단계로 가지 않는다
4. 그 다음에 기존 키를 앱용으로 제한 (이 시점엔 프록시가 기존 키와 무관)
```

---

## 1단계 — 프록시용 키 생성

Google Cloud Console → **APIs & Services → Credentials**
https://console.cloud.google.com/apis/credentials

1. 상단 **+ CREATE CREDENTIALS → API key**
2. 생성된 키를 복사 (아직 창을 닫지 말 것)
3. **Edit API key** 클릭 후 이름을 `gurmi-proxy-webservice` 등으로 변경
4. **API restrictions** → `Restrict key` 선택 → 아래 5개만 체크
   - Places API
   - Geocoding API
   - Distance Matrix API
   - Directions API
   - Time Zone API
5. **Application restrictions** → `None` 으로 둔다
   웹서비스 API에는 앱 제한이 적용되지 않고, Workers는 고정 IP가 없어
   IP 제한도 쓸 수 없다. 이 키는 Secret에만 두는 것으로 보호한다.
6. **SAVE**

> 제한 변경은 반영까지 최대 5분 걸릴 수 있다.

## 2단계 — Workers Secret 교체

```bash
cd proxy
npm run secrets:google     # 새 키 입력 (GOOGLE_MAPS_API_KEY만 갱신)
```

Secret은 즉시 반영되며 재배포가 필요 없다.

## 3단계 — 프록시 확인

```bash
cd proxy
./verify.sh https://gurmi-maps-proxy.pandayh7.workers.dev <APP_TOKEN>
```

전부 통과해야 4단계로 넘어간다. `REQUEST_DENIED`가 나오면
새 키에서 해당 API를 체크하지 않은 것이다 (반영 지연일 수도 있으니 5분 후 재시도).

## 4단계 — 기존 키를 앱 전용으로 제한

3단계가 통과한 뒤에만 진행한다.

Credentials에서 **기존 키**(`AIzaSyDM0O...`)를 열고:

1. 이름을 `gurmi-app-mapssdk` 등으로 변경
2. **API restrictions** → `Restrict key` → 아래만 체크
   - Maps SDK for Android
   - Maps SDK for iOS
   (Places/Geocoding/Directions/Distance Matrix/Time Zone은 **해제**)
3. **Application restrictions** → `Android apps` → **ADD**
   - Package name: `com.gurmi.app`
   - SHA-1: 아래 "SHA-1 확인" 참고
4. iOS도 쓸 거면 `iOS apps`에 번들 ID `com.gurmi.app` 추가
   (Android/iOS 제한은 키 하나에 동시 설정 가능)
5. **SAVE**

### SHA-1 확인

EAS가 키스토어를 관리하므로 대시보드에서 본다.

https://expo.dev/accounts/peachapeach/projects/trip-native/credentials

Android → Keystore → **SHA-1 Certificate Fingerprint** 값을 복사한다.

CLI로도 볼 수 있다 (대화형 메뉴).

```bash
eas credentials --platform android
# → production 선택 → Keystore → 정보 출력
```

> **Google Play에 올렸다면** Play Console이 앱을 재서명하므로
> SHA-1이 달라진다. Play Console → 테스트 및 release → **앱 서명**에서
> "앱 서명 키 인증서"의 SHA-1도 **함께 추가**해야 한다.
> 두 개를 모두 등록해두면 로컬 빌드와 스토어 빌드가 다 동작한다.

## 5단계 — 앱 재빌드

`.env`의 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`는 그대로 쓴다(기존 키를 제한만 한 것).
키 값이 바뀌지 않았으므로 **재빌드 없이 동작**하지만, 제한이 올바른지
확인하려면 앱을 실행해 지도가 뜨는지 본다.

지도가 회색으로 뜨면 SHA-1이나 패키지명이 틀린 것이다.

## 6단계 — 할당량 상한 (별개로 반드시)

키를 분리해도 **앱 토큰은 APK에서 추출 가능하다.** 프록시 URL도 공개된다.
청구액에 천장을 두는 것은 할당량 상한뿐이다.

https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas

각 API → **Quotas & System Limits** → 일일 요청 한도를 설정한다.
결제 알림도 함께 걸어둔다: Billing → **Budgets & alerts**.

## 완료 후 상태

```
APK에서 추출 가능한 것:
  - Maps SDK 키   → 패키지명+SHA-1 검증으로 다른 곳에서 사용 불가
  - 앱 토큰        → 프록시 호출만 가능, 할당량 상한으로 피해 제한
APK에 없는 것:
  - 웹서비스 Google 키 → Workers Secret에만 존재
```
