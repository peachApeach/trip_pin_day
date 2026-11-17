import { Image, StyleSheet } from 'react-native'
import type { ImageStyle, StyleProp } from 'react-native'
import { COLORS } from '../constants'

/**
 * 시안 아이콘 세트. 전부 단색 PNG라 tintColor로 색을 바꿀 수 있다.
 * 이모지를 쓰면 OS·버전마다 모양이 달라지는데, 이쪽은 어디서나 같게 나온다.
 *
 * notification.png는 사용자가 직접 교체하는 파일이므로 건드리지 않는다.
 */
const SOURCES = {
  calendar: require('../assets/icons/calendar.png'),
  car: require('../assets/icons/car.png'),
  clock: require('../assets/icons/clock.png'),
  edit: require('../assets/icons/edit.png'),
  home: require('../assets/icons/home.png'),
  map: require('../assets/icons/map.png'),
  more: require('../assets/icons/more.png'),
  notification: require('../assets/icons/notification.png'),
  pin: require('../assets/icons/pin.png'),
  plus: require('../assets/icons/plus.png'),
  settings: require('../assets/icons/settings.png'),
  train: require('../assets/icons/train.png'),
  walk: require('../assets/icons/walk.png'),
} as const

export type IconName = keyof typeof SOURCES

interface Props {
  name: IconName
  size?: number
  /** 기본은 본문 색. 비활성 상태는 COLORS.textSub를 넘긴다. */
  color?: string
  style?: StyleProp<ImageStyle>
}

export default function Icon({ name, size = 20, color = COLORS.text, style }: Props) {
  return (
    <Image
      source={SOURCES[name]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      tintColor={color}
    />
  )
}

/**
 * 닫기(✕). 세트에 ✕가 없어서 plus를 45° 돌려 만든다.
 * 이모지 ✕는 폰트마다 굵기가 달라 아이콘들과 안 맞는다.
 */
export function CloseIcon({ size = 14, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return <Icon name="plus" size={size} color={color} style={close.rotated} />
}

const close = StyleSheet.create({
  rotated: { transform: [{ rotate: '45deg' }] },
})
