import { Marker } from 'react-native-maps'
import { BODY, MAX_ORDER, NUMBERED, type PinColor } from './pinAssets'

export type { PinColor }

/**
 * 지도 핀.
 *
 * Marker에 자식 뷰를 두지 않고 image 속성만 쓴다. 안드로이드에서 자식 뷰가
 * 있으면 MapMarker가 그 뷰를 "레이아웃으로 측정된 크기"의 비트맵에 draw()해서
 * 올리는데(MapMarker.createDrawable), 측정값이 shadow node에서 비동기로 오기
 * 때문에 아직 안 왔으면 100x100 물리픽셀로 떨어져 오른쪽·아래가 직각으로
 * 잘린다. 자식이 없으면 getIcon()이 비트맵을 그대로 돌려줘서(MapMarker:466)
 * 그 캡처 경로를 아예 타지 않는다 — tracksViewChanges도 무의미해진다
 * (MapMarker:261에서 hasCustomMarkerView와 AND로 묶여 있다).
 *
 * 그래서 순서 숫자와 카테고리 아이콘은 빌드 시점에 PNG로 구워둔다.
 * scripts/generate-pin-assets.py 가 만들고 pinAssets.ts 가 목록이다.
 */

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

export function pinColorFor(category: PlaceCategory): PinColor {
  return CATEGORY_COLOR[category]
}

/**
 * 순서가 있으면 숫자 핀, 없으면 카테고리 색 몸통.
 * 숫자 핀은 핑크만 구워져 있다 — 저장된 장소에는 카테고리 정보가 없어서
 * 순서 핀은 항상 핑크이고, 색깔별로 1..30을 다 만들면 에셋이 다섯 배가 된다.
 */
function sourceFor(category: PlaceCategory, order: number | undefined, selected: boolean) {
  const state = selected ? 'selected' : 'default'
  if (order != null && order >= 1 && order <= MAX_ORDER) {
    return NUMBERED[state][order]
  }
  // MAX_ORDER를 넘는 일정은 숫자 없이 몸통만 보여준다 (잘린 핀보다는 낫다)
  return BODY[pinColorFor(category)][state]
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
  return (
    <Marker
      coordinate={coordinate}
      image={sourceFor(category, order, selected)}
      // 이미지 아래 끝이 꼬리 끝이다 (생성기가 꼬리 마지막 픽셀에 맞춰 잘라낸다)
      anchor={{ x: 0.5, y: 1 }}
      // 자식 뷰가 없어 캡처가 일어나지 않지만, 기본값(true)이면 안드로이드가
      // 매 프레임 마커를 갱신하려 든다. 꺼두는 게 맞다.
      tracksViewChanges={false}
      zIndex={zIndex}
      onPress={onPress}
    />
  )
}
