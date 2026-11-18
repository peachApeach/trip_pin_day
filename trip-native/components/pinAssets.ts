// 이 파일은 scripts/generate-pin-assets.py가 만든다. 직접 고치지 마라.
// 숫자가 이미지에 구워져 있는 이유는 생성기 주석을 참고.

export type PinColor = 'pink' | 'mint' | 'yellow' | 'lavender' | 'blue'
export type PinState = 'default' | 'selected'

/** 순서 숫자를 구워둔 최대 번호. 넘으면 숫자 없는 몸통으로 떨어진다. */
export const MAX_ORDER = 30

/** 카테고리 색 몸통. 숙소만 아이콘이 들어가 있다. */
export const BODY: Record<PinColor, Record<PinState, number>> = {
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

/** 순서 숫자 핀 (핑크 전용) */
export const NUMBERED: Record<PinState, Record<number, number>> = {
  default: {
    1: require('../assets/map-pins/pin_pink_01_default.png'),
    2: require('../assets/map-pins/pin_pink_02_default.png'),
    3: require('../assets/map-pins/pin_pink_03_default.png'),
    4: require('../assets/map-pins/pin_pink_04_default.png'),
    5: require('../assets/map-pins/pin_pink_05_default.png'),
    6: require('../assets/map-pins/pin_pink_06_default.png'),
    7: require('../assets/map-pins/pin_pink_07_default.png'),
    8: require('../assets/map-pins/pin_pink_08_default.png'),
    9: require('../assets/map-pins/pin_pink_09_default.png'),
    10: require('../assets/map-pins/pin_pink_10_default.png'),
    11: require('../assets/map-pins/pin_pink_11_default.png'),
    12: require('../assets/map-pins/pin_pink_12_default.png'),
    13: require('../assets/map-pins/pin_pink_13_default.png'),
    14: require('../assets/map-pins/pin_pink_14_default.png'),
    15: require('../assets/map-pins/pin_pink_15_default.png'),
    16: require('../assets/map-pins/pin_pink_16_default.png'),
    17: require('../assets/map-pins/pin_pink_17_default.png'),
    18: require('../assets/map-pins/pin_pink_18_default.png'),
    19: require('../assets/map-pins/pin_pink_19_default.png'),
    20: require('../assets/map-pins/pin_pink_20_default.png'),
    21: require('../assets/map-pins/pin_pink_21_default.png'),
    22: require('../assets/map-pins/pin_pink_22_default.png'),
    23: require('../assets/map-pins/pin_pink_23_default.png'),
    24: require('../assets/map-pins/pin_pink_24_default.png'),
    25: require('../assets/map-pins/pin_pink_25_default.png'),
    26: require('../assets/map-pins/pin_pink_26_default.png'),
    27: require('../assets/map-pins/pin_pink_27_default.png'),
    28: require('../assets/map-pins/pin_pink_28_default.png'),
    29: require('../assets/map-pins/pin_pink_29_default.png'),
    30: require('../assets/map-pins/pin_pink_30_default.png'),
  },
  selected: {
    1: require('../assets/map-pins/pin_pink_01_selected.png'),
    2: require('../assets/map-pins/pin_pink_02_selected.png'),
    3: require('../assets/map-pins/pin_pink_03_selected.png'),
    4: require('../assets/map-pins/pin_pink_04_selected.png'),
    5: require('../assets/map-pins/pin_pink_05_selected.png'),
    6: require('../assets/map-pins/pin_pink_06_selected.png'),
    7: require('../assets/map-pins/pin_pink_07_selected.png'),
    8: require('../assets/map-pins/pin_pink_08_selected.png'),
    9: require('../assets/map-pins/pin_pink_09_selected.png'),
    10: require('../assets/map-pins/pin_pink_10_selected.png'),
    11: require('../assets/map-pins/pin_pink_11_selected.png'),
    12: require('../assets/map-pins/pin_pink_12_selected.png'),
    13: require('../assets/map-pins/pin_pink_13_selected.png'),
    14: require('../assets/map-pins/pin_pink_14_selected.png'),
    15: require('../assets/map-pins/pin_pink_15_selected.png'),
    16: require('../assets/map-pins/pin_pink_16_selected.png'),
    17: require('../assets/map-pins/pin_pink_17_selected.png'),
    18: require('../assets/map-pins/pin_pink_18_selected.png'),
    19: require('../assets/map-pins/pin_pink_19_selected.png'),
    20: require('../assets/map-pins/pin_pink_20_selected.png'),
    21: require('../assets/map-pins/pin_pink_21_selected.png'),
    22: require('../assets/map-pins/pin_pink_22_selected.png'),
    23: require('../assets/map-pins/pin_pink_23_selected.png'),
    24: require('../assets/map-pins/pin_pink_24_selected.png'),
    25: require('../assets/map-pins/pin_pink_25_selected.png'),
    26: require('../assets/map-pins/pin_pink_26_selected.png'),
    27: require('../assets/map-pins/pin_pink_27_selected.png'),
    28: require('../assets/map-pins/pin_pink_28_selected.png'),
    29: require('../assets/map-pins/pin_pink_29_selected.png'),
    30: require('../assets/map-pins/pin_pink_30_selected.png'),
  },
}
