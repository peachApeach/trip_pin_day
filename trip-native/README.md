# 구르미 (Gurmi)

여행 일정을 지도 위에서 만들고 관리하는 모바일 앱

## 주요 기능

- **지도 핀**: 지도를 탭하거나 장소를 검색해서 일정 추가
- **장소 정보 시트**: POI 탭 시 영업시간·별점·가격대·전화번호 표시 (Places API)
- **자동완성 검색**: 현재 지도 위치 기반 장소 검색 (Places Autocomplete)
- **타임라인**: 출발 시간 기준 방문 시각 자동 계산
- **이동수단 구간별 설정**: 자동차 / 대중교통 / 도보 / 자전거 / 기타(직접 입력)
- **경로 시각화**: 구간 탭 시 지도에 이동 경로 표시
- **장소 순서 변경**: 카드의 ☰ 핸들을 드래그해서 방문 순서 조정
- **일정 스와이프**: 일정탭에서 좌우 스와이프로 날짜 이동
- **여행 편집**: 제목·날짜 수정, 날짜 단축 시 초과 장소 삭제 확인
- **다중 여행 / 일자별 관리**: 여행별, Day별 일정 분리, 당일치기 지원
- **예산 관리**: 장소별 예상 금액 입력 + Day 합계 표시
- **근처 즐길거리 패널**: 지도 우측 손잡이 탭으로 현재 위치 기준 5km 관광지 표시, Klook 제휴 연결

## 기술 스택

- React Native + Expo SDK 54
- TypeScript
- react-native-maps
- Google Maps Platform (Places, Directions, Distance Matrix)
- AsyncStorage (로컬 저장)

## 개발 환경 설정

```bash
npm install
```

`.env` 파일 생성 후 API 키 입력:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

```bash
npx expo start
```

## 빌드 (EAS)

```bash
# 개발 APK
eas build --profile development --platform android

# 프로덕션 APK
eas build --profile production --platform android
```

## 테스트

```bash
npm test
```
