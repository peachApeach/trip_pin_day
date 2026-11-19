import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { fetchTravelSegments } from './distanceMatrix'
import {
  LEAD_MINUTES, computeDayArrivals, dayStartWallClock, durationsForDay,
  modesForDay, segmentInputPlaces, splitDayPlaces, tripTotalDays,
  type ArrivalItem,
} from './schedule'
import type { Trip } from '../types'

const CHANNEL_ID = 'schedule'

/** data 페이로드로 우리 알림을 식별한다 (취소할 때 남의 알림을 건드리지 않도록) */
const TAG = 'gurmi-schedule'

/** 앱이 켜져 있을 때도 배너를 띄운다 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

/**
 * 알림 권한을 확보한다. Android 13+는 채널이 먼저 있어야 권한 요청이 먹는다.
 * 이미 거부된 상태면 다시 묻지 않고 false (OS가 재요청을 무시한다).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '일정 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B8A',
    })
  }
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

/** 이 앱이 예약한 일정 알림만 취소한다 */
export async function cancelTripNotifications(tripId?: number) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(scheduled.map(async req => {
    const data = req.content.data as { tag?: string; tripId?: number } | undefined
    if (data?.tag !== TAG) return
    if (tripId != null && data.tripId !== tripId) return
    await Notifications.cancelScheduledNotificationAsync(req.identifier)
  }))
}

/**
 * 여행 전체 일정의 도착 시각을 계산한다.
 * 이동 시간은 네트워크에서 오므로(실패 시 직선거리 추정) async다.
 */
export async function computeTripArrivals(trip: Trip): Promise<ArrivalItem[]> {
  const totalDays = tripTotalDays(trip.tripStartDate, trip.tripEndDate)
  const out: ArrivalItem[] = []

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const { dayPlaces, prevDayLastPlace } = splitDayPlaces(trip.places, dayIndex)
    if (dayPlaces.length === 0) continue

    const dayStart = dayStartWallClock(trip.tripStartDate, trip.startDate, dayIndex)
    if (!dayStart) continue

    const inputPlaces = segmentInputPlaces(dayPlaces, prevDayLastPlace)
    const segments = inputPlaces.length >= 2
      ? await fetchTravelSegments(
          inputPlaces,
          trip.travelMode,
          modesForDay(trip.segmentModes, dayIndex),
          durationsForDay(trip.segmentDurations, dayIndex)
        )
      : []

    out.push(...computeDayArrivals(dayPlaces, segments, prevDayLastPlace, dayStart, dayIndex))
  }
  return out
}

/**
 * iOS는 대기 중인 로컬 알림을 64개까지만 유지하고 나머지를 조용히 버린다.
 * 넘치면 뒤쪽(먼 미래) 일정이 통째로 사라지므로, 가까운 일정부터 채우고
 * 몇 개를 못 걸었는지 호출한 쪽에 알려준다.
 */
const MAX_PENDING = Platform.OS === 'ios' ? 60 : 450

export interface ScheduleResult {
  scheduled: number
  /** 이미 지나가서 건너뛴 알림 수 */
  skippedPast: number
  /** OS 한도를 넘어 걸지 못한 알림 수 */
  droppedOverLimit: number
}

/**
 * 여행의 모든 장소에 대해 도착 10분 전 알림을 예약한다.
 * 기존 예약은 지우고 다시 깔기 때문에 여러 번 불러도 중복되지 않는다.
 */
export async function scheduleTripNotifications(trip: Trip, isCurrent: () => boolean): Promise<ScheduleResult | null> {
  const arrivals = await computeTripArrivals(trip)
  if (!isCurrent()) return null
  await cancelTripNotifications(trip.id)
  // 지금보다 과거인 알림은 OS가 즉시 발사해버리므로 걸러낸다
  const now = Date.now()
  let skippedPast = 0
  let scheduled = 0
  let droppedOverLimit = 0

  // 가까운 일정이 먼저 등록되도록 시각순으로 정렬한다 (한도에 걸릴 때 중요)
  const sorted = [...arrivals].sort((a, b) => a.localTime.getTime() - b.localTime.getTime())

  for (const { place, dayIndex, localTime } of sorted) {
    if (!isCurrent()) return null
    const fireAt = new Date(localTime.getTime() - LEAD_MINUTES * 60000)
    if (fireAt.getTime() <= now) { skippedPast++; continue }
    if (scheduled >= MAX_PENDING) { droppedOverLimit++; continue }

    const hh = String(localTime.getHours()).padStart(2, '0')
    const mm = String(localTime.getMinutes()).padStart(2, '0')
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${LEAD_MINUTES}분 후 ${place.name}`,
        body: `${hh}:${mm} 도착 예정${place.address ? ` · ${place.address}` : ''}`,
        sound: true,
        data: { tag: TAG, tripId: trip.id, placeId: place.id, dayIndex },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    })
    scheduled++
  }

  return { scheduled, skippedPast, droppedOverLimit }
}

/** 디버그/표시용 — 현재 이 앱이 예약해둔 일정 알림 수 */
export async function countScheduledNotifications(tripId?: number): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  return scheduled.filter(req => {
    const data = req.content.data as { tag?: string; tripId?: number } | undefined
    if (data?.tag !== TAG) return false
    return tripId == null || data.tripId === tripId
  }).length
}
