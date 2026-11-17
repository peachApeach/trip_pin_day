import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native'
import { Marker } from 'react-native-maps'
import { COLORS } from '../constants'
import Icon, { type IconName } from './Icon'

/**
 * 지도 핀. 이미지에는 몸통만 있고 숫자·아이콘은 이 컴포넌트가 위에 올린다.
 *
 * 좌표계: 원본 PNG는 256×320이고 안에서
 *   - 전구(원형) 중심이 세로 32.2% 지점
 *   - 꼬리 끝이 세로 91.6% 지점
 * 에 있다. 숫자를 전구 중심에, Marker anchor를 꼬리 끝에 맞추는 데 쓴다.
 * 기본형·선택형이 같은 캔버스를 쓰므로 두 상태의 꼬리 위치가 어긋나지 않는다.
 */
const PIN_ASPECT = 256 / 320
const BULB_CENTER_Y = 103.5 / 320
const TIP_Y = 293 / 320

/** 선택 핀 기준 크기. 기본 핀은 여기에 DEFAULT_SCALE을 곱한 크기로 보인다. */
const SELECTED_H = 55
const SELECTED_W = Math.round(SELECTED_H * PIN_ASPECT) // 44
const DEFAULT_H = 45
const DEFAULT_SCALE = DEFAULT_H / SELECTED_H

/** 확대/축소 애니메이션 */
const GROW_MS = 180

export type PinColor = 'pink' | 'mint' | 'yellow' | 'lavender' | 'blue'

const BODIES: Record<PinColor, { default: number; selected: number }> = {
  pink: {
    default: require('../assets/map-pins/pin_pink_default.png'),
    selected: require('../assets/map-pins/pin_pink_selected.png'),
  },
  mint: {
    default: require('../assets/map-pins/pin_mint_default.png'),
    selected: require('../assets/map-pins/pin_mint_selected.png'),
  },
  yellow: {
    default: require('../assets/map-pins/pin_yellow_default.png'),
    selected: require('../assets/map-pins/pin_yellow_selected.png'),
  },
  lavender: {
    default: require('../assets/map-pins/pin_lavender_default.png'),
    selected: require('../assets/map-pins/pin_lavender_selected.png'),
  },
  blue: {
    default: require('../assets/map-pins/pin_blue_default.png'),
    selected: require('../assets/map-pins/pin_blue_selected.png'),
  },
}

export type PlaceCategory = 'food' | 'cafe' | 'sight' | 'lodging' | 'shopping' | 'default'

/**
 * Google Places의 types로 카테고리를 가른다. 저장된 장소에는 types가 없어
 * 'default'(핑크)가 되고, 검색·추천 결과만 카테고리 색을 받는다.
 * 카테고리 필드를 새로 만들지 않기 위해 이미 들어오는 types만 쓴다.
 */
export function categoryOf(types?: string[]): PlaceCategory {
  if (!types || types.length === 0) return 'default'
  const has = (t: string) => types.includes(t)
  // 카페가 식당 types를 함께 갖는 경우가 많아 카페를 먼저 본다
  if (has('cafe') || has('bakery')) return 'cafe'
  if (has('restaurant') || has('food') || has('meal_takeaway') || has('bar')) return 'food'
  if (has('lodging') || has('hotel')) return 'lodging'
  if (has('shopping_mall') || has('department_store') || has('store') || has('clothing_store')) {
    return 'shopping'
  }
  if (
    has('tourist_attraction') || has('natural_feature') || has('park') ||
    has('museum') || has('point_of_interest')
  ) return 'sight'
  return 'default'
}

const CATEGORY_COLOR: Record<PlaceCategory, PinColor> = {
  default: 'pink',
  food: 'yellow',
  cafe: 'yellow',
  sight: 'mint',
  lodging: 'lavender',
  shopping: 'blue',
}

/**
 * 카테고리 아이콘. 시안 아이콘 세트에 식기·커피·카메라·쇼핑백이 없어서
 * 지금은 숙소(home)만 대응된다. 나머지는 몸통만 보여준다 —
 * 이모지로 때우면 핀마다 모양이 달라지고 OS별로도 달라진다.
 */
const CATEGORY_ICON: Partial<Record<PlaceCategory, IconName>> = {
  lodging: 'home',
}

export function pinColorFor(category: PlaceCategory): PinColor {
  return CATEGORY_COLOR[category]
}

/**
 * 안드로이드는 마커를 비트맵으로 캡처해서 그린다. tracksViewChanges를 계속
 * 켜두면 매 프레임 다시 캡처해 깜빡이고 느려지므로, 모양이 바뀐 직후
 * 잠깐만 켜고 되돌린다.
 */
function useTrackWindow(trigger: unknown, ms: number): boolean {
  const [tracking, setTracking] = useState(true)
  useEffect(() => {
    setTracking(true)
    const timer = setTimeout(() => setTracking(false), ms)
    return () => clearTimeout(timer)
  }, [trigger, ms])
  return tracking
}

interface Props {
  coordinate: { latitude: number; longitude: number }
  /** 일정에 등록된 장소의 방문 순서. 있으면 카테고리 아이콘보다 우선한다. */
  order?: number
  category?: PlaceCategory
  selected?: boolean
  onPress?: () => void
  /** 지도 위에서 겹칠 때 누가 위로 올라오는지 */
  zIndex?: number
}

export default function MapPin({
  coordinate, order, category = 'default', selected = false, onPress, zIndex,
}: Props) {
  const body = BODIES[pinColorFor(category)][selected ? 'selected' : 'default']
  const icon = order == null ? CATEGORY_ICON[category] : undefined

  const grow = useRef(new Animated.Value(selected ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(grow, {
      toValue: selected ? 1 : 0,
      duration: GROW_MS,
      easing: Easing.out(Easing.quad),
      // 마커는 네이티브 드라이버로 돌리면 안드로이드에서 비트맵이
      // 갱신되지 않는다. JS 드라이버 + tracksViewChanges 조합을 쓴다.
      useNativeDriver: false,
    }).start()
  }, [selected, grow])

  // 확대 애니메이션이 끝날 때까지, 그리고 순서가 바뀌어 숫자가 달라졌을 때
  // 다시 캡처해야 안드로이드에서 변화가 화면에 반영된다.
  const tracksViewChanges = useTrackWindow(`${selected}:${order}`, GROW_MS + 120)

  return (
    <Marker
      coordinate={coordinate}
      // 꼬리 끝이 좌표를 가리킨다. 꼬리를 기준으로 확대하므로 두 상태 모두 같은 점.
      anchor={{ x: 0.5, y: TIP_Y }}
      tracksViewChanges={tracksViewChanges}
      zIndex={zIndex}
      onPress={onPress}
    >
      {/* 바깥 래퍼는 선택 크기로 고정 — 커질 때 비트맵이 잘리지 않는다 */}
      <View collapsable={false} style={styles.box}>
        <Animated.View
          collapsable={false}
          style={[
            styles.box,
            {
              transform: [{
                scale: grow.interpolate({ inputRange: [0, 1], outputRange: [DEFAULT_SCALE, 1] }),
              }],
              // 꼬리 끝을 축으로 키워서 가리키는 좌표가 흔들리지 않게 한다
              transformOrigin: ['50%', `${TIP_Y * 100}%`, 0],
            },
          ]}
        >
          <Image source={body} style={styles.body} resizeMode="contain" fadeDuration={0} />
          <View style={styles.glyph} pointerEvents="none">
            {order != null ? (
              <Text style={styles.order} allowFontScaling={false}>{order}</Text>
            ) : icon ? (
              <Icon name={icon} size={17} color={COLORS.text} />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  box: { width: SELECTED_W, height: SELECTED_H },
  body: StyleSheet.absoluteFillObject,
  // 높이를 전구 중심의 두 배로 잡고 가운데 정렬하면 글자가 전구 정중앙에 온다
  glyph: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: SELECTED_H * BULB_CENTER_Y * 2,
    alignItems: 'center', justifyContent: 'center',
  },
  // 폭을 주지 않아 두 자릿수도 잘리지 않는다
  order: { fontSize: 16, fontWeight: '700', color: COLORS.text, includeFontPadding: false },
})
