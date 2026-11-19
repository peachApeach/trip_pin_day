import { useState, useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Platform, BackHandler, Alert, PanResponder,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import MapScreen from './components/MapScreen'
import PlanScreen from './components/PlanScreen'
import TripListScreen from './components/TripListScreen'
import TripOverviewScreen from './components/TripOverviewScreen'
import Icon, { type IconName } from './components/Icon'
import { fetchTravelSegments, fetchSegment } from './utils/distanceMatrix'
import { fetchRoute, fetchAllRoutes } from './utils/directions'
import { fetchTimeZone, type TimeZoneInfo } from './utils/timezone'
import {
  notificationScheduleSignature, restoreTripPlace, segmentInputPlaces, splitDayPlaces, tripTotalDays, updateTripPlaces,
} from './utils/schedule'
import {
  configureNotificationHandler, ensureNotificationPermission,
  scheduleTripNotifications, cancelTripNotifications, countScheduledNotifications,
} from './utils/notifications'
import { COLORS } from './constants'
import type { Trip, Place, TravelMode, TravelSegment, TabKey } from './types'

configureNotificationHandler()

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([])
  const tripsRef = useRef(trips)
  tripsRef.current = trips
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  const [overviewTrip, setOverviewTrip] = useState<Trip | null>(null)
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('map')
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)
  const [focusPlaceId, setFocusPlaceId] = useState<number | null>(null)
  const [deletedPlace, setDeletedPlace] = useState<{ id: number; name: string; trip: Trip } | null>(null)
  const [travelSegments, setTravelSegments] = useState<(TravelSegment | null)[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const [allRoutes, setAllRoutes] = useState<{ latitude: number; longitude: number }[][]>([])
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([])
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ok' | 'failed'>('idle')
  const routeGenRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGenRef = useRef(0)
  const lastPlaceIdRef = useRef(0)
  // 알림은 여행별로 따로 켜고 끈다. 둘 다 여행 id로 키를 잡는다.
  const [notifyBusyIds, setNotifyBusyIds] = useState<number[]>([])
  const [notifyCounts, setNotifyCounts] = useState<Record<number, number>>({})
  const notifyGenRef = useRef<Record<number, number>>({})
  // 렌더를 기다리지 않고 바로 읽어야 하는 쪽(effect)을 위한 사본
  const notifyBusyRef = useRef<Set<number>>(new Set())
  const notifyQueueRef = useRef(new Map<number, Promise<void>>())
  const notifyFeedbackRef = useRef(new Set<number>())

  const queueNotificationWork = useCallback((id: number, work: () => Promise<void>) => {
    const queue = notifyQueueRef.current
    const pending = (queue.get(id) ?? Promise.resolve()).then(work).catch(() => {})
    queue.set(id, pending)
    void pending.then(() => {
      if (queue.get(id) === pending) queue.delete(id)
    })
  }, [])

  useEffect(() => {
    if (!activeTrip && !overviewTrip) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTrip) {
        setOverviewTrip(trips.find(t => t.id === activeTrip.id) ?? null)
        setActiveTrip(null)
      } else if (overviewTrip) {
        setOverviewTrip(null)
      }
      return true
    })
    return () => sub.remove()
  }, [activeTrip, overviewTrip, trips])

  useEffect(() => {
    AsyncStorage.getItem('trips').then((json) => {
      if (json) {
        const parsed: Trip[] = JSON.parse(json)
        const VALID = new Set(['DRIVING', 'TRANSIT', 'WALKING', 'BICYCLING', 'OTHER'])
        const fixed = parsed.map(t => ({
          ...t,
          tripStartDate: t.tripStartDate ?? null,
          tripEndDate: t.tripEndDate ?? null,
          segmentModes: Object.fromEntries(
            Object.entries(t.segmentModes ?? {}).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.map(m => (typeof m === 'string' && VALID.has(m) ? m : null)) : [],
            ])
          ),
          segmentDurations: Object.fromEntries(
            Object.entries(t.segmentDurations ?? {}).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.map(d => (typeof d === 'number' ? d : null)) : [],
            ])
          ),
        }))
        setTrips(fixed)

        // 시간대 정보(timeZoneId / utcOffsetMinutes) 없는 장소들 Timezone API로 일괄 채우기.
        // timeZoneId가 있어야 여행 날짜 기준으로 서머타임을 반영할 수 있다.
        const missingPlaces: { tripId: number; placeId: number; lat: number; lng: number; at: number }[] = []
        fixed.forEach(t => t.places.forEach(p => {
          if (p.timeZoneId != null && p.utcOffsetMinutes != null) return
          // 여행 시작일 기준으로 조회해야 그 시점 DST가 반영된 오프셋을 받는다
          const tripStart = t.tripStartDate ? new Date(t.tripStartDate).getTime() : Date.now()
          const at = Math.floor((Number.isNaN(tripStart) ? Date.now() : tripStart) / 1000)
          missingPlaces.push({ tripId: t.id, placeId: p.id, lat: p.lat, lng: p.lng, at })
        }))
        if (missingPlaces.length > 0) {
          Promise.all(missingPlaces.map(async ({ tripId, placeId, lat, lng, at }) => {
            const tz = await fetchTimeZone(lat, lng, at)
            return tz ? { tripId, placeId, ...tz } : null
          })).then(results => {
            const updates = results.filter((r): r is { tripId: number; placeId: number } & TimeZoneInfo => r !== null)
            if (updates.length === 0) return
            setTrips(prev =>
              prev.map(t => ({
                ...t,
                places: t.places.map(p => {
                  const u = updates.find(r => r.tripId === t.id && r.placeId === p.id)
                  return u ? { ...p, utcOffsetMinutes: u.utcOffsetMinutes, timeZoneId: u.timeZoneId } : p
                }),
              }))
            )
          })
        }
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem('trips', JSON.stringify(trips)).catch(() => {})
  }, [trips, loaded])

  useEffect(() => {
    const { dayPlaces, prevDayLastPlace } = splitDayPlaces(activeTrip?.places ?? [], activeDayIndex)
    const currentPlaces = segmentInputPlaces(dayPlaces, prevDayLastPlace)
    const currentMode = activeTrip?.travelMode ?? 'DRIVING'
    const raw = (activeTrip?.segmentModes ?? {})[activeDayIndex]
    const currentSegmentModes: (TravelMode | null)[] = Array.isArray(raw) ? raw : []
    const gen = ++fetchGenRef.current
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (currentPlaces.length < 2) {
      setTravelSegments([])
      setSegmentsLoading(false)
      return
    }
    console.log('[App] trigger gen:', gen, 'places:', currentPlaces.length, 'segmentModes:', JSON.stringify(currentSegmentModes))
    debounceRef.current = setTimeout(async () => {
      setSegmentsLoading(true)
      const rawDur = (activeTrip?.segmentDurations ?? {})[activeDayIndex]
      const currentSegmentDurations: (number | null)[] = Array.isArray(rawDur) ? rawDur : []
      const segments = await fetchTravelSegments(currentPlaces, currentMode, currentSegmentModes, currentSegmentDurations)
      if (fetchGenRef.current !== gen) {
        console.log('[App] stale result dropped, gen:', gen, 'current:', fetchGenRef.current)
        return
      }
      console.log('[App] travelSegments result gen:', gen, JSON.stringify(segments))
      setTravelSegments(segments)
      setSegmentsLoading(false)
    }, 300)
  }, [activeTrip, activeDayIndex])

  useEffect(() => {
    const { dayPlaces, prevDayLastPlace } = splitDayPlaces(activeTrip?.places ?? [], activeDayIndex)
    const currentPlaces = segmentInputPlaces(dayPlaces, prevDayLastPlace)
    const currentMode = activeTrip?.travelMode ?? 'DRIVING'
    const raw = (activeTrip?.segmentModes ?? {})[activeDayIndex]
    const currentSegmentModes: (TravelMode | null)[] = Array.isArray(raw) ? raw : []
    setAllRoutes([])
    const gen = ++routeGenRef.current
    if (currentPlaces.length < 2) return
    fetchAllRoutes(currentPlaces, currentMode, currentSegmentModes).then(routes => {
      if (routeGenRef.current !== gen) return
      setAllRoutes(routes)
    })
  }, [activeTrip, activeDayIndex])

  const activeTripId = activeTrip?.id
  const updateTrip = useCallback((updater: (t: Trip) => Trip) => {
    if (activeTripId === undefined) return
    setActiveTrip(prev => prev?.id === activeTripId ? updater(prev) : prev)
    setOverviewTrip(prev => prev?.id === activeTripId ? updater(prev) : prev)
    setTrips(prev => prev.map(t => t.id === activeTripId ? updater(t) : t))
  }, [activeTripId])

  const handleAddMapPlace = useCallback((info: Pick<Place, 'lat' | 'lng' | 'name' | 'address'>) => {
    const id = Math.max(Date.now(), lastPlaceIdRef.current + 1)
    lastPlaceIdRef.current = id
    const place: Place = { ...info, id, duration: 60, dayIndex: activeDayIndex }
    updateTrip(t => updateTripPlaces(t, [...t.places, place], [activeDayIndex]))

    void fetchTimeZone(info.lat, info.lng, Math.floor(id / 1000)).then(tz => {
      if (!tz) return
      updateTrip(t => ({
        ...t,
        places: t.places.map(p => p.id === id ? { ...p, ...tz } : p),
      }))
    })
  }, [updateTrip, activeDayIndex])

  const handleRemove = useCallback((id: number) => {
    const removed = activeTrip?.places.find(place => place.id === id)
    if (!activeTrip || !removed) return
    setDeletedPlace({ id, name: removed.name, trip: activeTrip })
    updateTrip(t => {
      const place = t.places.find(p => p.id === id)
      return place ? updateTripPlaces(t, t.places.filter(p => p.id !== id), [place.dayIndex ?? 0]) : t
    })
    setSelectedPlaceId((prev) => prev === id ? null : prev)
  }, [activeTrip, updateTrip])

  useEffect(() => {
    if (!deletedPlace) return
    const timer = setTimeout(() => setDeletedPlace(null), 10000)
    return () => clearTimeout(timer)
  }, [deletedPlace])

  const handleUndoRemove = () => {
    if (!deletedPlace || deletedPlace.trip.id !== activeTripId) return
    updateTrip(t => restoreTripPlace(t, deletedPlace.trip, deletedPlace.id))
    setDeletedPlace(null)
  }

  const handleUpdateName = useCallback((id: number, name: string) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, name } : p) }))
  }, [updateTrip])

  const handleUpdateDuration = useCallback((id: number, duration: number) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, duration } : p) }))
  }, [updateTrip])

  const handleUpdateBudget = useCallback((id: number, budget: number | undefined) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, budget } : p) }))
  }, [updateTrip])

  const handleUpdateBudgetCurrency = useCallback((id: number, budgetCurrency: string) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, budgetCurrency } : p) }))
  }, [updateTrip])

  const handleDayChange = useCallback((dayIndex: number) => {
    setActiveDayIndex(dayIndex)
    setSelectedPlaceId(null)
    setTravelSegments([])
    setAllRoutes([])
    setRouteCoords([])
    setRouteStatus('idle')
  }, [])

  const handleUpdateDayIndex = useCallback((id: number, dayIndex: number) => {
    updateTrip(t => {
      const place = t.places.find(p => p.id === id)
      if (!place || (place.dayIndex ?? 0) === dayIndex) return t
      const places = t.places.filter(p => p.id !== id)
      places.push({ ...place, dayIndex })
      return updateTripPlaces(t, places, [place.dayIndex ?? 0, dayIndex])
    })
    handleDayChange(dayIndex)
  }, [updateTrip, handleDayChange])

  const handleReorderPlaces = useCallback((dayIndex: number, reordered: Place[]) => {
    const order = new Map(reordered.map((place, index) => [place.id, index]))
    updateTrip(t => {
      const { dayPlaces } = splitDayPlaces(t.places, dayIndex)
      dayPlaces.sort((a, b) => (order.get(a.id) ?? reordered.length) - (order.get(b.id) ?? reordered.length))
      const others = t.places.filter(p => (p.dayIndex ?? 0) !== dayIndex)
      return updateTripPlaces(t, [...others, ...dayPlaces], [dayIndex])
    })
  }, [updateTrip])

  const handleStartDateChange = useCallback((date: Date) => {
    updateTrip((t) => ({ ...t, startDate: date.toISOString() }))
  }, [updateTrip])

  const handleTravelModeChange = useCallback((mode: TravelMode) => {
    updateTrip((t) => ({ ...t, travelMode: mode }))
  }, [updateTrip])

  const handleTripDatesChange = useCallback((start: string | null, end: string | null) => {
    updateTrip((t) => ({ ...t, tripStartDate: start, tripEndDate: end }))
  }, [updateTrip])

  const handleSegmentModeChange = useCallback((segIdx: number, mode: TravelMode) => {
    const hasPrevDay = activeDayIndex > 0
    updateTrip((t) => {
      const prevPlaces = hasPrevDay ? t.places.filter(p => (p.dayIndex ?? 0) === activeDayIndex - 1) : []
      const hasPrevLast = prevPlaces.length > 0
      const all = { ...(t.segmentModes ?? {}) }
      const VALID_MODES = new Set(['DRIVING', 'TRANSIT', 'WALKING', 'BICYCLING', 'OTHER'])
      const existing = all[activeDayIndex]
      const dayModes = (Array.isArray(existing) ? existing : []).map((m: unknown) =>
        typeof m === 'string' && VALID_MODES.has(m) ? m as TravelMode : null
      )
      // segIdx -1: 전날 마지막 → 오늘 첫 구간 → index 0
      // segIdx >= 0: 오늘 내 구간 → prevLast 있으면 +1 offset
      const storeIdx = segIdx === -1 ? 0 : (hasPrevLast ? segIdx + 1 : segIdx)
      dayModes[storeIdx] = mode
      all[activeDayIndex] = dayModes
      return { ...t, segmentModes: all }
    })
  }, [updateTrip, activeDayIndex])

  const handleSegmentDurationChange = useCallback((segIdx: number, duration: number | null) => {
    const hasPrevDay = activeDayIndex > 0
    updateTrip((t) => {
      const prevPlaces = hasPrevDay ? t.places.filter(p => (p.dayIndex ?? 0) === activeDayIndex - 1) : []
      const hasPrevLast = prevPlaces.length > 0
      const all = { ...(t.segmentDurations ?? {}) }
      const existing = all[activeDayIndex]
      const dayDurations = Array.isArray(existing) ? [...existing] : []
      const storeIdx = segIdx === -1 ? 0 : (hasPrevLast ? segIdx + 1 : segIdx)
      dayDurations[storeIdx] = duration
      all[activeDayIndex] = dayDurations
      return { ...t, segmentDurations: all }
    })
  }, [updateTrip, activeDayIndex])

  const handleSegmentPress = useCallback(async (fromPlace: Place, toPlace: Place, mode: TravelMode) => {
    setActiveTab('map')
    setRouteCoords([])
    setRouteStatus('loading')
    const coords = await fetchRoute(fromPlace, toPlace, mode)
    if (coords.length >= 2) {
      setRouteCoords(coords)
      setRouteStatus('ok')
    } else {
      setRouteCoords([])
      setRouteStatus('failed')
    }
  }, [])

  const handleAddTrip = (title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: import('./types').BudgetItem[]) => {
    const d = new Date(); d.setHours(9, 0, 0, 0)
    const newTrip: Trip = {
      id: Date.now(), title, places: [],
      startDate: d.toISOString(), travelMode: 'DRIVING',
      segmentModes: {}, segmentDurations: {},
      tripStartDate, tripEndDate, budgets,
    }
    setTrips((prev) => [...prev, newTrip])
    setActiveTrip(newTrip)
    setActiveTab('map')
    setSelectedPlaceId(null)
    setTravelSegments([])
    setAllRoutes([])
    setRouteCoords([])
    setRouteStatus('idle')
  }

  const handleDeleteTrip = (id: number) => {
    setTrips((prev) => prev.filter((t) => t.id !== id))
    notifyGenRef.current[id] = (notifyGenRef.current[id] ?? 0) + 1
    notifyFeedbackRef.current.delete(id)
    setNotifyBusy(id, false)
    setNotifyCounts(prev => { const next = { ...prev }; delete next[id]; return next })
    queueNotificationWork(id, () => cancelTripNotifications(id))
  }

  const handleEditTrip = (id: number, title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: import('./types').BudgetItem[]) => {
    const trip = trips.find(t => t.id === id)
    if (!trip) return

    if (tripStartDate && tripEndDate) {
      const newDays = Math.max(1, Math.round((new Date(tripEndDate).getTime() - new Date(tripStartDate).getTime()) / 86400000) + 1)

      // prevDayLastPlace(dayIndex = 이전날)는 자신의 dayIndex로 저장되므로 자연히 제외됨.
      // 실제로 dayIndex >= newDays 인 장소만 카운트.
      const exceedingPlaces = trip.places.filter(p => (p.dayIndex ?? 0) >= newDays)

      if (exceedingPlaces.length > 0) {
        Alert.alert(
          '일정 초기화',
          `변경된 날짜 범위(${newDays}일)를 벗어나는 장소 ${exceedingPlaces.length}곳이 있어요.\n해당 장소를 삭제하고 날짜를 변경할까요?`,
          [
            { text: '취소', style: 'cancel' },
            {
              text: '삭제하고 변경',
              style: 'destructive',
              onPress: () => {
                setTrips(prev => prev.map(t => t.id === id ? {
                  ...t, title, tripStartDate, tripEndDate, budgets,
                  places: t.places.filter(p => (p.dayIndex ?? 0) < newDays),
                  segmentModes: Object.fromEntries(
                    Object.entries(t.segmentModes ?? {}).filter(([k]) => Number(k) < newDays)
                  ),
                  segmentDurations: Object.fromEntries(
                    Object.entries(t.segmentDurations ?? {}).filter(([k]) => Number(k) < newDays)
                  ),
                } : t))
              },
            },
          ]
        )
        return
      }
    }

    setTrips(prev => prev.map(t => t.id === id ? { ...t, title, tripStartDate, tripEndDate, budgets } : t))
  }

  // 저장된 notifyEnabled와 OS 상태가 어긋날 수 있다(권한 회수, 앱 재설치 등).
  // 화면에 보여줄 숫자는 OS에 실제로 걸린 것을 신뢰한다.
  const notifyEnabledKey = trips.map(t => `${t.id}:${t.notifyEnabled ? 1 : 0}`).join(',')
  useEffect(() => {
    if (!loaded) return
    let alive = true
    // 지금 예약/취소 중인 여행은 건너뛴다. 중간 상태(아직 0개)를 읽어서
    // 방금 계산한 숫자를 덮어쓰면 안 된다.
    const targets = trips.filter(t => t.notifyEnabled && !notifyBusyRef.current.has(t.id))
    Promise.all(targets.map(async t => [t.id, await countScheduledNotifications(t.id)] as const))
      .then(pairs => {
        if (alive) {
          const idlePairs = pairs.filter(([id]) => !notifyBusyRef.current.has(id))
          setNotifyCounts(prev => ({ ...prev, ...Object.fromEntries(idlePairs) }))
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [loaded, notifyEnabledKey])

  const setNotifyBusy = useCallback((id: number, busy: boolean) => {
    if (busy) notifyBusyRef.current.add(id)
    else notifyBusyRef.current.delete(id)
    setNotifyBusyIds(prev => busy ? [...new Set([...prev, id])] : prev.filter(x => x !== id))
  }, [])

  const pendingSchedules = trips.flatMap(trip => {
    if (!trip.notifyEnabled) return []
    const signature = notificationScheduleSignature(trip)
    return signature === trip.notificationScheduleSignature ? [] : [{ id: trip.id, signature }]
  })
  const pendingScheduleKey = JSON.stringify(pendingSchedules)

  useEffect(() => {
    if (!loaded || pendingSchedules.length === 0) return
    const timer = setTimeout(() => {
      for (const { id, signature } of pendingSchedules) {
        const generation = notifyGenRef.current[id]
        queueNotificationWork(id, async () => {
          const isCurrent = () => {
            const latest = tripsRef.current.find(t => t.id === id)
            return notifyGenRef.current[id] === generation && !!latest?.notifyEnabled
              && notificationScheduleSignature(latest) === signature
          }
          const trip = tripsRef.current.find(t => t.id === id)
          if (!trip || !isCurrent() || trip.notificationScheduleSignature === signature) return

          setNotifyBusy(id, true)
          setTrips(prev => prev.map(t => t.id === id && t.notificationScheduleSignature !== undefined
            ? { ...t, notificationScheduleSignature: undefined }
            : t
          ))
          try {
            const result = await scheduleTripNotifications(trip, isCurrent)
            if (!result || !isCurrent()) return
            setTrips(prev => prev.map(t => t.id === id && t.notifyEnabled && notificationScheduleSignature(t) === signature
              ? { ...t, notificationScheduleSignature: signature }
              : t
            ))
            const { scheduled, skippedPast, droppedOverLimit } = result
            setNotifyCounts(prev => ({ ...prev, [id]: scheduled }))
            if (!notifyFeedbackRef.current.delete(id)) return
            if (scheduled === 0) {
              Alert.alert('예약할 알림이 없어요', skippedPast > 0
                ? `일정 ${skippedPast}개가 모두 지난 시각이에요.`
                : '알림을 걸 일정을 찾지 못했어요.')
            } else if (skippedPast > 0 || droppedOverLimit > 0) {
              const notes = [`${scheduled}개 예약했어요.`]
              if (skippedPast > 0) notes.push(`이미 지난 일정 ${skippedPast}개는 건너뛰었어요.`)
              if (droppedOverLimit > 0) notes.push(`기기 한도 때문에 먼 일정 ${droppedOverLimit}개는 제외했어요.`)
              Alert.alert('알림 설정 완료', notes.join('\n'))
            }
          } catch {
            if (isCurrent() && notifyFeedbackRef.current.delete(id)) {
              Alert.alert('알림 설정 실패', '앱을 다시 열면 알림 예약을 다시 시도합니다.')
            }
          } finally {
            if (notifyGenRef.current[id] === generation) setNotifyBusy(id, false)
          }
        })
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [loaded, pendingScheduleKey, queueNotificationWork, setNotifyBusy])

  const handleToggleNotify = useCallback(async (tripId: number, enabled: boolean) => {
    const gen = (notifyGenRef.current[tripId] ?? 0) + 1
    notifyGenRef.current[tripId] = gen

    const persist = (on: boolean) => {
      setTrips(prev => prev.map(t => t.id === tripId
        ? { ...t, notifyEnabled: on, notificationScheduleSignature: undefined }
        : t
      ))
      setOverviewTrip(prev => prev?.id === tripId ? { ...prev, notifyEnabled: on } : prev)
    }

    if (!enabled) {
      persist(false)
      notifyFeedbackRef.current.delete(tripId)
      setNotifyCounts(prev => ({ ...prev, [tripId]: 0 }))
      setNotifyBusy(tripId, false)
      queueNotificationWork(tripId, () => cancelTripNotifications(tripId))
      return
    }

    const trip = tripsRef.current.find(t => t.id === tripId)
    if (!trip) return
    if (trip.places.length === 0) {
      Alert.alert('일정이 비어 있어요', '장소를 먼저 추가해주세요.')
      return
    }

    setNotifyBusy(tripId, true)
    const granted = await ensureNotificationPermission().catch(() => false)
    if (notifyGenRef.current[tripId] !== gen) return
    if (!granted) {
      setNotifyBusy(tripId, false)
      Alert.alert('알림 권한이 필요해요', '설정 → 구르미 → 알림에서 권한을 켜주세요.')
      return
    }

    notifyFeedbackRef.current.add(tripId)
    persist(true)
  }, [queueNotificationWork, setNotifyBusy])

  const handleSelectTrip = (trip: Trip) => {
    setActiveTrip(null)
    setOverviewTrip(trip)
  }

  const handleEnterTrip = (trip: Trip, dayIndex: number | null) => {
    setOverviewTrip(null)
    setActiveTrip(trip)
    setActiveDayIndex(dayIndex ?? 0)
    setActiveTab('plan')
    setSelectedPlaceId(null)
    setTravelSegments([])
    setAllRoutes([])
    setRouteCoords([])
    setRouteStatus('idle')
  }



  if (!loaded) return null

  if (!activeTrip && !overviewTrip) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <TripListScreen
            trips={trips}
            onSelect={handleSelectTrip}
            onAdd={handleAddTrip}
            onEdit={handleEditTrip}
            onDelete={handleDeleteTrip}
            notifyBusyIds={notifyBusyIds}
            notifyCounts={notifyCounts}
            onToggleNotify={handleToggleNotify}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  if (overviewTrip) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <TripOverviewScreen
            trip={overviewTrip}
            onEnter={(dayIndex) => handleEnterTrip(overviewTrip, dayIndex)}
            onBack={() => setOverviewTrip(null)}
            notifyEnabled={overviewTrip.notifyEnabled ?? false}
            notifyBusy={notifyBusyIds.includes(overviewTrip.id)}
            notifyCount={notifyCounts[overviewTrip.id] ?? 0}
            onToggleNotify={(enabled) => handleToggleNotify(overviewTrip.id, enabled)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  if (!activeTrip) return null

  const { dayPlaces: places, prevDayLastPlace } = splitDayPlaces(activeTrip.places, activeDayIndex)
  const startDate = new Date(activeTrip.startDate)
  const travelMode = activeTrip.travelMode

  const totalDays = tripTotalDays(activeTrip.tripStartDate, activeTrip.tripEndDate)

  function formatDayDate(dayIdx: number) {
    if (!activeTrip!.tripStartDate) return `Day ${dayIdx + 1}`
    const d = new Date(activeTrip!.tripStartDate)
    d.setDate(d.getDate() + dayIdx)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const TABS = [
    { key: 'plan' as TabKey, icon: 'calendar' as IconName, label: `일정 (${places.length})` },
    { key: 'map' as TabKey, icon: 'map' as IconName, label: '지도' },
  ]

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            setOverviewTrip(trips.find(t => t.id === activeTrip!.id) ?? null)
            setActiveTrip(null)
          }}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.tripTitle} numberOfLines={1}>{activeTrip.title}</Text>
          <View style={styles.dayNav}>
            <TouchableOpacity
              style={[styles.dayNavBtn, activeDayIndex === 0 && styles.dayNavBtnDisabled]}
              onPress={() => handleDayChange(activeDayIndex - 1)}
              disabled={activeDayIndex === 0}
            >
              <Text style={styles.dayNavArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.dayNavLabel}>
              <Text style={styles.dayNavDay}>Day {activeDayIndex + 1}</Text>
              <Text style={styles.dayNavDate}>{formatDayDate(activeDayIndex)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.dayNavBtn, activeDayIndex === totalDays - 1 && styles.dayNavBtnDisabled]}
              onPress={() => handleDayChange(activeDayIndex + 1)}
              disabled={activeDayIndex === totalDays - 1}
            >
              <Text style={styles.dayNavArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.mapWrapper, activeTab !== 'map' && { display: 'none' }]}>
            <MapScreen
              places={places}
              dayNumber={activeDayIndex + 1}
              active={activeTab === 'map'}
              fitKey={`${activeTrip.id}-${activeDayIndex}`}
              selectedPlaceId={selectedPlaceId}
              focusPlaceId={focusPlaceId}
              allRoutes={allRoutes}
              routeCoords={routeCoords}
              routeStatus={routeStatus}
              onAddPlace={handleAddMapPlace}
              onMarkerPress={(id) => { setSelectedPlaceId(id || null); setRouteCoords([]); setRouteStatus('idle') }}
              onFocusHandled={() => setFocusPlaceId(null)}
              onRemove={handleRemove}
            />
            {places.length === 0 && (
              <View style={styles.mapHint}>
                <Icon name="pin" size={14} color={COLORS.primary} />
                <Text style={styles.mapHintText}>지도를 탭해서 장소를 추가해요</Text>
              </View>
            )}
          </View>

          {activeTab === 'plan' && (
            <SwipeDayWrapper
              activeDayIndex={activeDayIndex}
              totalDays={totalDays}
              onDayChange={handleDayChange}
            >
              <PlanScreen
                places={places}
                dayLabels={Array.from({ length: totalDays }, (_, day) =>
                  activeTrip.tripStartDate ? `Day ${day + 1} · ${formatDayDate(day)}` : `Day ${day + 1}`
                )}
                selectedPlaceId={selectedPlaceId}
                onSelect={setSelectedPlaceId}
                onRemove={handleRemove}
                onUpdateDuration={handleUpdateDuration}
                onUpdateBudget={handleUpdateBudget}
                onUpdateBudgetCurrency={handleUpdateBudgetCurrency}
                onUpdateDayIndex={handleUpdateDayIndex}
                onReorder={(reordered) => handleReorderPlaces(activeDayIndex, reordered)}
                onSegmentModeChange={handleSegmentModeChange}
                onSegmentDurationChange={handleSegmentDurationChange}
                onSegmentPress={handleSegmentPress}
                segmentModes={(activeTrip.segmentModes ?? {})[activeDayIndex] ?? []}
                segmentDurations={(activeTrip.segmentDurations ?? {})[activeDayIndex] ?? []}
                prevDayLastPlace={prevDayLastPlace}
                onShowMap={() => setActiveTab('map')}
                onFocusPlace={(id) => { setFocusPlaceId(id); setActiveTab('map') }}
                startDate={startDate}
                onStartDateChange={handleStartDateChange}
                travelMode={travelMode}
                travelSegments={travelSegments}
                segmentsLoading={segmentsLoading}
              />
            </SwipeDayWrapper>
          )}
        </View>

        {deletedPlace?.trip.id === activeTrip.id && (
          <View style={styles.undoBar}>
            <Text style={styles.undoMessage} numberOfLines={2} accessibilityLiveRegion="polite">
              {deletedPlace.name} 삭제됨
            </Text>
            <TouchableOpacity style={styles.undoButton} onPress={handleUndoRemove} accessibilityRole="button">
              <Text style={styles.undoAction}>실행 취소</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon
                name={tab.icon}
                size={22}
                color={activeTab === tab.key ? COLORS.primary : COLORS.textSub}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

function SwipeDayWrapper({ activeDayIndex, totalDays, onDayChange, children }: {
  activeDayIndex: number
  totalDays: number
  onDayChange: (idx: number) => void
  children: React.ReactNode
}) {
  const dayRef = useRef(activeDayIndex)
  dayRef.current = activeDayIndex
  const totalRef = useRef(totalDays)
  totalRef.current = totalDays

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => {
      const absX = Math.abs(gs.dx)
      const absY = Math.abs(gs.dy)
      return absX > 10 && absX > absY * 1.5
    },
    onPanResponderRelease: (_, gs) => {
      if (Math.abs(gs.dx) < 50) return
      if (gs.dx < 0 && dayRef.current < totalRef.current - 1) {
        onDayChange(dayRef.current + 1)
      } else if (gs.dx > 0 && dayRef.current > 0) {
        onDayChange(dayRef.current - 1)
      }
    },
  })).current

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 22, color: COLORS.primary, fontWeight: '700', lineHeight: 26 },
  tripTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  dayNav: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 4,
  },
  dayNavBtn: { padding: 6 },
  dayNavBtnDisabled: { opacity: 0.3 },
  dayNavArrow: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  dayNavLabel: { alignItems: 'center', paddingHorizontal: 4 },
  dayNavDay: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  dayNavDate: { fontSize: 10, color: COLORS.primary, opacity: 0.7 },
  content: { flex: 1 },
  mapWrapper: {
    flex: 1, position: 'relative',
    margin: 16, borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  mapHint: {
    position: 'absolute', bottom: 16, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  mapHintText: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  undoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, paddingLeft: 14, paddingRight: 4, backgroundColor: COLORS.text,
  },
  undoMessage: { flex: 1, color: 'white', fontSize: 13 },
  undoButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  undoAction: { color: COLORS.primaryLight, fontSize: 13, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 },
  tabLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },
  tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 1 },
})
