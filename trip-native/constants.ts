// 네이티브 지도 렌더링(Maps SDK)용. 프록시 불가 — 앱에 반드시 포함된다.
// Cloud Console에서 Android 패키지명+SHA-1 / iOS 번들 ID 제한을 걸어두면
// 추출해도 다른 곳에서 쓸 수 없다.
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string

// 웹서비스 API(Places/Geocoding/Distance Matrix/Directions/Time Zone) 프록시.
// 비어 있으면 Google을 직접 호출하며, 그 경우 위 키가 번들에 노출된다.
export const MAPS_PROXY_URL = (process.env.EXPO_PUBLIC_MAPS_PROXY_URL ?? '') as string
export const MAPS_PROXY_TOKEN = (process.env.EXPO_PUBLIC_MAPS_PROXY_TOKEN ?? '') as string

export const PLACE_COLORS = [
  { bg: '#FFF0F3', dot: '#FF708D' },
  { bg: '#E8F7F4', dot: '#6BCDC4' },
  { bg: '#FFF6E6', dot: '#F0B952' },
  { bg: '#EDE7F6', dot: '#7C4DFF' },
  { bg: '#E8F5E9', dot: '#43A047' },
]

export const COLORS = {
  primary: '#FF708D',
  primaryLight: '#FFF0F3',
  primaryDark: '#E8527A',
  primaryInk: '#A52D4D',
  mint: '#6BCDC4',
  mintLight: '#E8F7F4',
  yellow: '#FFD98B',
  // 노란색은 배경으로 쓰면 글씨가 안 읽힌다. 뱃지 배경용 연한 톤.
  yellowLight: '#FFF6E6',
  bg: '#FFFAF8',
  card: '#FFFFFF',
  text: '#292929',
  textSub: '#717171',
  border: '#F0ECEB',
  shadow: '#FF708D',
  /** 입력 자리표시·화살표 등 본문보다 더 연한 글씨 */
  textMuted: '#B5ADAB',
  /** 카드 안쪽에 한 단계 들어간 면 (배경보다 살짝 어둡게) */
  surface: '#FAF6F4',
  /** 버터옐로 배경 위 글씨 — 노란색 자체는 대비가 부족해 못 쓴다 */
  tzText: '#8D6E00',
  /** 삭제 등 되돌릴 수 없는 동작 */
  danger: '#E8527A',
  /** 별점 — 팔레트 밖이지만 별은 노란색이어야 읽힌다 */
  rating: '#E8A33D',
  /** 민트 배경 위 글씨 — 민트 자체는 흰 바탕에서도 연해서 본문엔 못 쓴다 */
  mintDark: '#17615B',
  /** 영업 중 / 종료 뱃지 */
  open: '#2E7D32',
  openBg: '#E8F5E9',
  closed: '#C62828',
  closedBg: '#FFEBEE',
} as const
