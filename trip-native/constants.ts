export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string

export const G20_CURRENCIES = [
  { code: 'KRW', symbol: '₩', label: '한국 원' },
  { code: 'USD', symbol: '$', label: '미국 달러' },
  { code: 'JPY', symbol: '¥', label: '일본 엔' },
  { code: 'CNY', symbol: '¥', label: '중국 위안' },
  { code: 'EUR', symbol: '€', label: '유로' },
  { code: 'GBP', symbol: '£', label: '영국 파운드' },
  { code: 'AUD', symbol: 'A$', label: '호주 달러' },
  { code: 'CAD', symbol: 'C$', label: '캐나다 달러' },
  { code: 'INR', symbol: '₹', label: '인도 루피' },
  { code: 'IDR', symbol: 'Rp', label: '인도네시아 루피아' },
  { code: 'BRL', symbol: 'R$', label: '브라질 헤알' },
  { code: 'MXN', symbol: 'MX$', label: '멕시코 페소' },
  { code: 'SAR', symbol: '﷼', label: '사우디 리얄' },
  { code: 'ZAR', symbol: 'R', label: '남아공 란드' },
  { code: 'TRY', symbol: '₺', label: '튀르키예 리라' },
  { code: 'ARS', symbol: 'AR$', label: '아르헨티나 페소' },
  { code: 'RUB', symbol: '₽', label: '러시아 루블' },
] as const

export const PLACE_COLORS = [
  { bg: '#FFE8EE', dot: '#FF6B8A' },
  { bg: '#E0F7F5', dot: '#4ECDC4' },
  { bg: '#FFF8E1', dot: '#FFB300' },
  { bg: '#EDE7F6', dot: '#7C4DFF' },
  { bg: '#E8F5E9', dot: '#43A047' },
]

export const COLORS = {
  primary: '#FF6B8A',
  primaryLight: '#FFE8EE',
  primaryDark: '#E8527A',
  mint: '#4ECDC4',
  mintLight: '#E0F7F5',
  yellow: '#FFD93D',
  yellowLight: '#FFF8E1',
  bg: '#FFF6F8',
  card: '#FFFFFF',
  text: '#2D2D2D',
  textSub: '#9E9E9E',
  border: '#F0E0E5',
  shadow: '#FF6B8A',
} as const
