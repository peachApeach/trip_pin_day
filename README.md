# 📍 핀데이 (PinDay)

지도에 핀을 꽂고, 이동 시간까지 계산한 여행 일정을 자동으로 만들어주는 앱

## 주요 기능

- **장소 검색** — 검색창에 입력하면 자동완성 목록 표시, 선택 시 지도 이동 + 핀 자동 추가 (Google Places API)
- **지도 탭** — 원하는 곳을 탭하면 자동으로 장소 추가 (역지오코딩으로 이름/주소 자동 입력)
- **장소 목록** — 장소 이름 수정, 체류 시간 설정, 순서 확인
- **타임테이블** — 출발 시간 설정 + 이동 수단 선택 → 장소별 체류 시간 + 이동 시간 합산해서 자동 생성
- **이동 수단** — 자동차 / 대중교통 / 도보 / 자전거 선택 가능 (Google Distance Matrix API)

## 기술 스택

| 항목 | 내용 |
|------|------|
| Language | TypeScript |
| Framework | React Native + Expo SDK 54 |
| Map | react-native-maps |
| API | Google Maps (Places / Geocoding / Distance Matrix) |

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

> Google Cloud Console에서 아래 4가지 API를 활성화해야 합니다.
> - Maps SDK for iOS / Android
> - Places API
> - Geocoding API
> - Distance Matrix API

### 3. 앱 실행

```bash
npx expo start
```

터미널에 QR 코드가 뜨면 폰에서 **Expo Go** 앱으로 스캔해서 실행합니다.

- iOS: 카메라 앱으로 QR 스캔
- Android: Expo Go 앱 안에서 QR 스캔

> 폰과 개발 PC가 **같은 Wi-Fi**에 연결되어 있어야 합니다.  
> 같은 네트워크가 아닐 경우 `npx expo start --tunnel` 로 실행하세요.

## 프로젝트 구조

```
trip-native/
├── App.tsx                  # 루트 컴포넌트, 전역 상태 관리
├── types.ts                 # 공유 타입 정의 (Place, TravelSegment 등)
├── constants.ts             # 컬러 팔레트, API 키
├── components/
│   ├── MapScreen.tsx        # 지도 뷰, 마커, 장소 검색, 탭 이벤트
│   ├── PlaceList.tsx        # 장소 목록, 체류 시간 설정
│   └── Timetable.tsx        # 타임테이블, 이동 수단 선택
└── utils/
    └── distanceMatrix.ts    # Google Distance Matrix API 호출
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API 키 (Geocoding + Distance Matrix용) |

`app.json`의 `ios.config.googleMapsApiKey`, `android.config.googleMaps.apiKey`는 네이티브 지도 렌더링용으로 별도로 설정해야 합니다.
