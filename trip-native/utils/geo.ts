/**
 * 좌표를 'lat,lng' 쿼리 파라미터로 안전하게 직렬화한다.
 * 저장 데이터가 손상돼 좌표가 문자열이면 URL에 그대로 보간될 때
 * 쿼리 파라미터가 주입될 수 있으므로, 숫자 또는 숫자 문자열만 받고
 * 유효 범위의 유한값만 통과시킨다. 그 외에는 null.
 *
 * Number()로 바로 강제하지 않는 이유: Number(null)===0,
 * Number([37.5])===37.5, Number('')===0 처럼 좌표가 아닌 값이
 * 조용히 유효한 좌표로 바뀌어 버린다.
 */
export function toCoord(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function latLngParam(lat: unknown, lng: unknown): string | null {
  const a = toCoord(lat)
  const b = toCoord(lng)
  if (a == null || b == null) return null
  if (a < -90 || a > 90 || b < -180 || b > 180) return null
  return `${a},${b}`
}
