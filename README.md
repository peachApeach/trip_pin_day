# 📍 핀데이 (PinDay)

지도에 핀을 꽂고, 이동 시간까지 계산한 여행 일정을 자동으로 만들어주는 앱

## 주요 기능

- **장소 검색** — 검색창에 입력 → 결과 목록 팝업 → 선택 시 지도 이동 + 하단 카드 표시 (무한 스크롤 지원)
- **지도 탭** — 지도 빈 곳 또는 구글 POI 핀을 탭하면 하단 카드 표시
- **장소 추가** — 하단 카드의 **+ 추가** 버튼을 눌러야만 장소 추가 (실수 추가 방지)
- **장소 목록** — 장소 이름 수정, 체류 시간 설정, 순서 확인
- **타임테이블** — 출발 시간 + 이동 수단 선택 → 체류/이동 시간 합산 자동 일정 생성
- **이동 수단** — 자동차 / 대중교통 / 도보 / 자전거
- **탭 전환 시 지도 상태 유지** — 검색 결과, 지도 위치, 줌 레벨 그대로 유지
- **현재 위치 자동 이동** — 앱 실행 시 내 위치 기준으로 지도 표시

## 기술 스택

| 항목 | 내용 |
|------|------|
| Language | TypeScript |
| Framework | React Native + Expo SDK 54 |
| Map | react-native-maps |
| Safe Area | react-native-safe-area-context |
| Location | expo-location |
| API | Google Maps (Places Text Search / Geocoding / Distance Matrix) |

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
> - Places API (Text Search)
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
├── App.tsx                  # 루트 컴포넌트, 전역 상태 관리, 탭 네비게이션
├── types.ts                 # 공유 타입 정의 (Place, TravelSegment 등)
├── constants.ts             # 컬러 팔레트, API 키
├── components/
│   ├── MapScreen.tsx        # 지도, 마커, 검색, POI 탭, preview 카드
│   ├── PlaceList.tsx        # 장소 목록, 체류 시간 설정
│   └── Timetable.tsx        # 타임테이블, 이동 수단 선택
└── utils/
    └── distanceMatrix.ts    # Google Distance Matrix API 호출
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API 키 |

> `.env` 파일은 `.gitignore`에 포함되어 있어 git에 커밋되지 않습니다.
