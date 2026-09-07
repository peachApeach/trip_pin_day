import { GOOGLE_MAPS_API_KEY as API_KEY } from '../constants'

export interface TimeZoneInfo {
  timeZoneId: string
  utcOffsetMinutes: number
}

// 시차 정보를 가진 최소 형태 (Place 및 마이그레이션 중간 데이터 모두 허용)
export interface Zoned {
  utcOffsetMinutes?: number
  timeZoneId?: string
}

/** Google Timezone API로 좌표의 시간대 조회. timestamp(초) 시점 기준 DST가 반영된다. */
export async function fetchTimeZone(
  lat: number,
  lng: number,
  timestampSec: number
): Promise<TimeZoneInfo | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestampSec}&key=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.status !== 'OK') return null
    return {
      timeZoneId: String(data.timeZoneId),
      utcOffsetMinutes: Math.round((data.rawOffset + data.dstOffset) / 60),
    }
  } catch {
    return null
  }
}

/**
 * IANA 시간대(timeZoneId)의 특정 시점 UTC 오프셋(분)을 계산한다.
 * 저장된 오프셋과 달리 서머타임이 반영된다. Intl 미지원 환경에서는 null.
 */
export function offsetMinutesForZone(timeZoneId: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      // hourCycle h23을 명시 — hour12:false만 주면 ICU 버전에 따라 자정이
      // 전날 날짜의 '24'시로 나와서 하루가 밀린다
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at)
    const p: Record<string, string> = {}
    for (const part of parts) if (part.type !== 'literal') p[part.type] = part.value
    if (!p.year || !p.month || !p.day || !p.hour) return null
    const wallAsUtc = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour) % 24, Number(p.minute ?? 0), Number(p.second ?? 0)
    )
    if (Number.isNaN(wallAsUtc)) return null
    // 초 단위로 내림해서 비교 (formatToParts는 ms를 버림)
    return Math.round((wallAsUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
  } catch {
    return null
  }
}

/**
 * 장소의 특정 시점 실제 오프셋. timeZoneId가 있으면 DST 반영값을,
 * 없으면 장소 추가 시점에 저장된 오프셋을 쓴다.
 */
export function effectiveOffset(place: Zoned, at: Date): number | undefined {
  if (place.timeZoneId) {
    const resolved = offsetMinutesForZone(place.timeZoneId, at)
    if (resolved != null) return resolved
  }
  return place.utcOffsetMinutes
}

/**
 * 절대 시각을 해당 시간대의 벽시계 시각으로 옮긴 Date를 만든다.
 * 반환된 Date의 getHours() 등 로컬 게터가 그 시간대의 시각을 준다.
 * 오프셋이 없으면 기기 로컬 시각 그대로.
 */
export function toZonedDate(date: Date, utcOffsetMinutes?: number): Date {
  if (utcOffsetMinutes == null) return date
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utcMs + utcOffsetMinutes * 60000)
}

/**
 * 기기 로컬로 고른 벽시계 시각(예: 09:00)을 해당 시간대의 09:00으로 해석해
 * 절대 시각(UTC)으로 되돌린다.
 */
export function zonedWallClockToUtc(wallClock: Date, utcOffsetMinutes?: number): Date {
  if (utcOffsetMinutes == null) return new Date(wallClock.getTime())
  const wallAsUtc = wallClock.getTime() - wallClock.getTimezoneOffset() * 60000
  return new Date(wallAsUtc - utcOffsetMinutes * 60000)
}

export function formatTimeInZone(date: Date, utcOffsetMinutes?: number): string {
  const d = toZonedDate(date, utcOffsetMinutes)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 기준 시각 대비 날짜가 며칠 넘어갔는지. 각자의 시간대 벽시계 날짜로 비교한다. */
export function dayOffsetInZone(
  base: Date,
  target: Date,
  baseOffsetMinutes?: number,
  targetOffsetMinutes?: number
): number {
  const baseLocal = toZonedDate(base, baseOffsetMinutes)
  const targetLocal = toZonedDate(target, targetOffsetMinutes ?? baseOffsetMinutes)
  const baseMidnight = Date.UTC(baseLocal.getFullYear(), baseLocal.getMonth(), baseLocal.getDate())
  const targetMidnight = Date.UTC(targetLocal.getFullYear(), targetLocal.getMonth(), targetLocal.getDate())
  return Math.round((targetMidnight - baseMidnight) / 86400000)
}

/** '+1일' / '-1일' — 날짜가 같으면 null (표시 안 함) */
export function dayOffsetLabel(dayOffset: number): string | null {
  if (dayOffset === 0) return null
  return dayOffset > 0 ? `+${dayOffset}일` : `${dayOffset}일`
}

/** ' (UTC+9)' / ' (UTC+5:30)' — 오프셋 없으면 빈 문자열 */
export function tzLabel(utcOffsetMinutes?: number): string {
  if (utcOffsetMinutes == null) return ''
  return ` (UTC${formatOffsetDiff(utcOffsetMinutes)})`
}

/** '+9' / '-3:30' / '0' — 시차 차이 표기용 */
export function formatOffsetDiff(diffMinutes: number): string {
  if (diffMinutes === 0) return '0'
  const sign = diffMinutes > 0 ? '+' : '-'
  const abs = Math.abs(diffMinutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}` : `${sign}${h}`
}

/** '시차 -7시간' / '시차 +5시간 30분' — 차이가 없으면 null */
export function tzShiftLabel(fromOffset?: number, toOffset?: number): string | null {
  if (fromOffset == null || toOffset == null) return null
  const diff = toOffset - fromOffset
  if (diff === 0) return null
  const sign = diff > 0 ? '+' : '-'
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const body = h > 0 && m > 0 ? `${h}시간 ${m}분` : h > 0 ? `${h}시간` : `${m}분`
  return `시차 ${sign}${body}`
}
