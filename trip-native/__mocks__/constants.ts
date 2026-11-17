// jest moduleNameMapper가 ../constants를 이 파일로 바꾼다.
// 색은 테스트가 검증하지 않지만, 실제 팔레트와 키가 어긋나면
// 스타일을 읽는 코드가 undefined를 받으므로 키는 똑같이 유지한다.
export const GOOGLE_MAPS_API_KEY = 'TEST_API_KEY'
export const MAPS_PROXY_URL = ''
export const MAPS_PROXY_TOKEN = ''
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
  mint: '#6BCDC4',
  mintLight: '#E8F7F4',
  yellow: '#FFD98B',
  yellowLight: '#FFF6E6',
  bg: '#FFFAF8',
  card: '#FFFFFF',
  text: '#292929',
  textSub: '#717171',
  border: '#F0ECEB',
  shadow: '#FF708D',
  textMuted: '#B5ADAB',
  surface: '#FAF6F4',
  tzText: '#8D6E00',
  danger: '#E8527A',
  rating: '#E8A33D',
  mintDark: '#2E938A',
  open: '#2E7D32',
  openBg: '#E8F5E9',
  closed: '#C62828',
  closedBg: '#FFEBEE',
}
