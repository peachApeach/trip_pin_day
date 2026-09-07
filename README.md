# ☁️ 구르미 (Gurmi)

지도에 핀을 꽂고, 이동 시간까지 계산한 여행 일정을 자동으로 만들어주는 앱

## 주요 기능

- **여행 목록** — 여러 여행 계획을 관리, 여행 추가 시 날짜 필수 지정
- **여행 Overview** — 여행 클릭 시 일자별 탭 + 전체 일정 지도 미리보기, 날짜 기간에 맞는 Day 버튼 자동 생성
- **장소 날짜 배정** — 일정 편집에서 각 장소를 Day에 배정, Overview 지도에 반영
- **장소 검색** — 검색창 입력 → 결과 목록 팝업 → 선택 시 지도 이동 + 하단 카드 표시 (무한 스크롤 지원)
- **지도 탭** — 지도 빈 곳 또는 구글 POI 핀을 탭하면 하단 카드 표시
- **장소 추가** — 하단 카드의 **+ 추가** 버튼을 눌러야만 장소 추가 (실수 추가 방지)
- **컬러 마커** — 핀 모양 기본 마커, 선택 시 뱃지 형태로 전환
- **타임테이블** — 출발 시간 + 이동 수단 선택 → 체류/이동 시간 합산 자동 일정 생성
- **이동 수단** — 자동차 / 대중교통 / 도보 / 자전거 / 기타 (구간별 개별 설정, 기타 선택 시 소요 시간 직접 입력)
- **이동 시간/거리 계산** — Google Distance Matrix API, 미지원 구간은 직선거리 추정 fallback
- **경로 시각화** — 지도 탭에 현재 Day 전체 구간 경로 항상 표시, 이동 패널 탭 시 해당 구간 강조 + 경로 API 미지원 시 직선 fallback
- **Day별 일정** — 여행 기간에 맞게 Day 자동 생성, 다음날 첫 요소로 전날 마지막 장소 표시
- **탭 전환 시 지도 상태 유지** — 검색 결과, 지도 위치, 줌 레벨 그대로 유지
- **현재 위치 자동 이동** — 앱 실행 시 내 위치 기준으로 지도 표시
- **데이터 영구 저장** — AsyncStorage로 앱 재시작 후에도 여행 데이터 유지
- **제휴 투어 연결** — 장소 카드와 근처 즐길거리 패널에서 클룩 투어 검색 연결 (제휴 커미션)
- **시차 처리** — 장소 추가 시 Google Time Zone API로 IANA 타임존을 저장하고, 방문 시각마다 DST(서머타임)를 반영해 오프셋을 계산. 일정은 절대 시각(UTC)을 기준으로 저장하고 화면에는 각 장소의 현지 시각으로 표시
- **구간 시차 표시** — 시차가 바뀌는 구간에 `+7시간` 배너와 도착지 현지 도착 시각 표시, 날짜가 넘어가면 `+1일` / `-1일` 뱃지 표시

## 기술 스택

| 항목 | 내용 |
|------|------|
| Language | TypeScript |
| Framework | React Native + Expo SDK 54 |
| Map | react-native-maps |
| Safe Area | react-native-safe-area-context |
| Location | expo-location |
| API | Google Maps (Places Text Search·Autocomplete·Details·Nearby / Geocoding / Distance Matrix / Directions / Time Zone) |
| Test | Jest + ts-jest (`npm test`) |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사해서 `.env` 파일을 만들고 API 키를 입력하세요.

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=여기에_구글맵_API_키_입력
```

> Google Cloud Console에서 아래 API를 활성화해야 합니다.
> - Maps SDK for iOS / Android
> - Places API (Text Search / Autocomplete / Details / Nearby Search)
> - Geocoding API
> - Distance Matrix API
> - Directions API
> - Time Zone API

> ⚠️ `EXPO_PUBLIC_` 접두사가 붙은 값은 JS 번들에 평문으로 포함되므로 앱을 배포하면 키를 추출할 수 있습니다.
> Time Zone·Distance Matrix·Directions는 **웹 서비스 API**여서 Android 앱 제한(패키지명 + SHA-1)이 적용되지 않습니다.
> 배포 전에 Google Cloud Console에서 **API별 할당량 상한(quota cap)** 을 설정해 과다 청구를 막으세요.
> 완전한 차단이 필요하면 키를 서버에 두고 프록시를 경유해야 합니다.

### 3. 앱 실행

```bash
npx expo start
```

터미널에 QR 코드가 뜨면 폰에서 **Expo Dev Client** 앱(또는 Expo Go)으로 스캔해서 실행합니다.

- iOS: 카메라 앱으로 QR 스캔
- Android: Expo Dev Client 앱 안에서 QR 스캔

> 폰과 개발 PC가 **같은 Wi-Fi**에 연결되어 있어야 합니다.  
> 같은 네트워크가 아닐 경우 `npx expo start --tunnel` 로 실행하세요.

## 사용 방법

### 장소 추가 방법 (2가지)

1. **검색으로 추가** — 검색창 입력 → 결과 목록에서 선택 → 지도 이동 + 하단 카드 확인 → **+ 추가**
2. **지도 탭으로 추가** — 지도 빈 곳 또는 구글 POI 핀 탭 → 하단 카드 확인 → **+ 추가**

### 일정 만들기

1. 장소 탭에서 각 장소의 체류 시간 설정
2. 일정 탭에서 출발 시간 및 이동 수단 선택
3. 타임테이블 자동 생성 확인

## 프로젝트 구조

```
trip-native/
├── App.tsx                      # 루트 컴포넌트, 화면 전환 및 상태 관리
├── types.ts                     # 공유 타입 정의 (Trip, Place, TravelSegment 등)
├── constants.ts                 # 컬러 팔레트, API 키
├── components/
│   ├── TripListScreen.tsx       # 여행 목록 홈 화면
│   ├── TripOverviewScreen.tsx   # 여행 overview (일자별 탭 + 지도 미리보기)
│   ├── MapScreen.tsx            # 지도, 마커, 검색, POI 탭, preview 카드
│   └── PlanScreen.tsx           # 장소 목록 + 타임테이블 통합 화면
├── utils/
│   ├── distanceMatrix.ts        # Google Distance Matrix API (이동 시간/거리 계산)
│   ├── directions.ts            # Google Directions API (경로 폴리라인)
│   ├── timezone.ts              # Time Zone API 조회, DST 반영 오프셋 계산, 현지 시각 포맷
│   └── geo.ts                   # 좌표를 URL 쿼리 파라미터로 안전하게 직렬화
└── __tests__/                   # Jest 테스트 (106개)
```

### 좌표 처리 규칙

AsyncStorage에서 읽은 `lat`/`lng`는 타입이 보장되지 않으므로, Google API URL에 직접 보간하지 않고
반드시 `utils/geo.ts`의 `latLngParam()`을 거칩니다. 숫자 또는 숫자 문자열만 통과시키고 유효 범위를
검사하며, 그 외에는 `null`을 반환해 요청 자체를 보내지 않습니다. 좌표가 거부되면 직선거리 추정
fallback도 건너뜁니다 (NaN 좌표로 계산하면 "NaN분"이 표시되기 때문).

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API 키 |

> `.env` 파일은 `.gitignore`에 포함되어 있어 git에 커밋되지 않습니다.
