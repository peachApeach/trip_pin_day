import { latLngParam } from '../utils/geo'

describe('latLngParam — 정상 좌표', () => {
  test('숫자 좌표', () => expect(latLngParam(37.5665, 126.978)).toBe('37.5665,126.978'))
  test('음수 좌표', () => expect(latLngParam(-33.8688, -151.2093)).toBe('-33.8688,-151.2093'))
  test('0,0', () => expect(latLngParam(0, 0)).toBe('0,0'))
  test('경계값 허용', () => {
    expect(latLngParam(90, 180)).toBe('90,180')
    expect(latLngParam(-90, -180)).toBe('-90,-180')
  })
  test('숫자 문자열은 정규화해서 통과', () => {
    expect(latLngParam('37.5665', '126.978')).toBe('37.5665,126.978')
  })
})

describe('latLngParam — 주입 차단', () => {
  test('쿼리 파라미터 주입 시도는 null', () => {
    expect(latLngParam('0&key=ATTACKER_KEY&x=', 1)).toBeNull()
    expect(latLngParam(1, '0&callback=evil')).toBeNull()
  })

  test('경로 조작/스킴 시도는 null', () => {
    expect(latLngParam('../../etc/passwd', 1)).toBeNull()
    expect(latLngParam('javascript:alert(1)', 1)).toBeNull()
  })

  test('공백 포함 문자열은 null', () => {
    expect(latLngParam('37.5 126.9', 1)).toBeNull()
  })
})

describe('latLngParam — 잘못된 값', () => {
  test('NaN / Infinity는 null', () => {
    expect(latLngParam(NaN, 1)).toBeNull()
    expect(latLngParam(1, Infinity)).toBeNull()
    expect(latLngParam(-Infinity, 1)).toBeNull()
  })

  test('null / undefined는 null', () => {
    expect(latLngParam(null, 1)).toBeNull()
    expect(latLngParam(undefined, undefined)).toBeNull()
    expect(latLngParam(1, null)).toBeNull()
  })

  test('범위를 벗어난 좌표는 null', () => {
    expect(latLngParam(91, 0)).toBeNull()
    expect(latLngParam(-91, 0)).toBeNull()
    expect(latLngParam(0, 181)).toBeNull()
    expect(latLngParam(0, -181)).toBeNull()
  })

  test('객체 / 배열은 null', () => {
    expect(latLngParam({}, 1)).toBeNull()
    expect(latLngParam([37.5], 1)).toBeNull()
    expect(latLngParam([37.5, 126.9], 1)).toBeNull()
  })

  test('빈 문자열 / 공백은 null (Number("")===0 함정)', () => {
    expect(latLngParam('', '')).toBeNull()
    expect(latLngParam('   ', 1)).toBeNull()
  })

  test('boolean은 null (Number(true)===1 함정)', () => {
    expect(latLngParam(true, 1)).toBeNull()
    expect(latLngParam(false, false)).toBeNull()
  })
})
