import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator } from 'react-native'
import MapView, { Polyline } from 'react-native-maps'
import { COLORS, PLACE_COLORS } from '../constants'
import Icon from './Icon'
import MapPin from './MapPin'
import { tripTotalDays } from '../utils/schedule'
import type { Trip, Place } from '../types'

interface Props {
  trip: Trip
  onEnter: (dayIndex: number | null) => void
  onBack: () => void
  notifyEnabled: boolean
  notifyBusy: boolean
  /** 예약된 알림 수 (꺼져 있으면 0) */
  notifyCount: number
  onToggleNotify: (enabled: boolean) => void
}

function formatDate(iso: string | null, offset = 0): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + offset)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function TripOverviewScreen({
  trip, onEnter, onBack,
  notifyEnabled, notifyBusy, notifyCount, onToggleNotify,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const mapRef = useRef<MapView>(null)

  const totalDays = tripTotalDays(trip.tripStartDate, trip.tripEndDate)
  const days = Array.from({ length: totalDays }, (_, i) => i)

  const chronologicalPlaces = [...trip.places].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
  const visiblePlaces = selectedDay === null
    ? chronologicalPlaces
    : chronologicalPlaces.filter(p => (p.dayIndex ?? 0) === selectedDay)

  /** 그 장소가 속한 날에서 몇 번째인지. 핀에 찍히는 번호다. */
  const dayOrderOf = (place: Place) =>
    trip.places.filter(p => (p.dayIndex ?? 0) === (place.dayIndex ?? 0)).indexOf(place) + 1

  // fitToCoordinates는 지도가 준비된 뒤에만 먹는다. 첫 화면에서 한눈에
  // 들어오게 맞추려면 onMapReady를 기다려야 한다.
  const [mapReady, setMapReady] = useState(false)

  /** 장소가 한 곳뿐이면 감쌀 영역이 없어서 적당한 줌으로 내려앉힌다. */
  const SINGLE_DELTA = 0.02

  const initialRegion = trip.places.length > 0 ? {
    latitude: trip.places.reduce((s, p) => s + p.lat, 0) / trip.places.length,
    longitude: trip.places.reduce((s, p) => s + p.lng, 0) / trip.places.length,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  } : {
    latitude: 37.5665, longitude: 126.978,
    latitudeDelta: 0.1, longitudeDelta: 0.1,
  }

  /** 넘겨받은 장소 전체가 한 화면에 들어오게 카메라를 맞춘다. */
  const fitTo = (places: Place[]) => {
    if (!mapReady || places.length === 0) return
    const coords = places.map(p => ({ latitude: p.lat, longitude: p.lng }))
    if (coords.length === 1) {
      mapRef.current?.animateToRegion(
        { ...coords[0], latitudeDelta: SINGLE_DELTA, longitudeDelta: SINGLE_DELTA }, 400)
      return
    }
    // 핀(27x36dp)은 anchor가 아래 끝이라 좌표 위로 36dp 솟고 좌우로 ±14dp
    // 번진다. 지도가 260dp뿐이라 그만큼만 비우고 더 주지 않는다 — 여백이
    // 크면 정작 핀이 들어갈 자리가 좁아져서 더 멀리 잡힌다.
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 44, right: 24, bottom: 16, left: 24 },
      animated: true,
    })
  }

  // 들어온 직후 전체 일정이 한눈에 보이게. 날짜를 고른 상태면 그 날에 맞춘다.
  // 일정 상세에서 장소를 추가하고 돌아오면 이 화면은 그대로 있고 trip만
  // 갱신되므로, 좌표 목록이 바뀌었을 때도 다시 맞춘다.
  // selectedDay를 키에 넣는다 — 날짜별 장소가 같은 좌표일 수 있어서
  // (Day1·Day2 숙소가 같은 호텔) 좌표만으로는 탭 전환을 못 알아챈다.
  const fitKey = `${selectedDay}:${visiblePlaces.map(p => `${p.lat},${p.lng}`).join('|')}`
  useEffect(() => { fitTo(visiblePlaces) }, [mapReady, fitKey])

  // 카메라는 fitKey 이펙트가 맞춘다 — 여기서 또 부르면 애니메이션이 겹친다
  const handleSelectDay = (day: number | null) => setSelectedDay(day)

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>
        <TouchableOpacity style={styles.enterBtn} onPress={() => onEnter(selectedDay)}>
          <Text style={styles.enterBtnText}>일정 상세</Text>
          <Text style={styles.enterBtnArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 일정 알림 */}
      <View style={styles.notifyRow}>
        <View style={styles.notifyInfo}>
          <View style={styles.notifyTitleRow}>
            <Icon name="notification" size={15} color={notifyEnabled ? COLORS.primary : COLORS.textSub} />
            <Text style={styles.notifyTitle}>일정 10분 전 알림</Text>
          </View>
          <Text style={styles.notifySub}>
            {notifyBusy
              ? '알림 시간을 계산하고 있어요…'
              : notifyEnabled
                ? notifyCount > 0
                  ? `${notifyCount}개 예약됨 · 기기 시계 기준`
                  : '예약할 일정이 없어요 (이미 지난 일정)'
                : '장소 도착 10분 전에 알려드려요'}
          </Text>
        </View>
        {notifyBusy
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : <Switch
              value={notifyEnabled}
              onValueChange={onToggleNotify}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="white"
            />}
      </View>

      {/* 일자 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}
        style={styles.dayTabsWrap}
      >
        <TouchableOpacity
          style={[styles.dayTab, selectedDay === null && styles.dayTabActive]}
          onPress={() => handleSelectDay(null)}
        >
          <Text style={[styles.dayTabText, selectedDay === null && styles.dayTabTextActive]}>전체</Text>
        </TouchableOpacity>
        {days.map(day => {
          const count = trip.places.filter(p => (p.dayIndex ?? 0) === day).length
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, selectedDay === day && styles.dayTabActive]}
              onPress={() => handleSelectDay(day)}
            >
              <Text style={[styles.dayTabText, selectedDay === day && styles.dayTabTextActive]}>
                Day {day + 1}
              </Text>
              {!!trip.tripStartDate && (
                <Text style={[styles.dayTabDate, selectedDay === day && styles.dayTabDateActive]}>
                  {formatDate(trip.tripStartDate, day)}
                </Text>
              )}
              {count > 0 && (
                <View style={[styles.dayTabBadge, selectedDay === day && styles.dayTabBadgeActive]}>
                  <Text style={[styles.dayTabBadgeText, selectedDay === day && styles.dayTabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* 지도 */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          onMapReady={() => setMapReady(true)}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {visiblePlaces.length > 1 && (
            <Polyline
              coordinates={visiblePlaces.map(p => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor={COLORS.primary}
              strokeWidth={2}
              lineDashPattern={[6, 4]}
            />
          )}
          {/* 핀 번호는 그 날의 방문 순서다. 아래 목록은 여행 전체 순번을 쓰므로
              '전체' 탭에서는 둘이 다를 수 있다 — 핀은 날짜별로 읽는 게 맞다. */}
          {visiblePlaces.map((place) => (
            <MapPin
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              order={dayOrderOf(place)}
              onPress={() => onEnter(place.dayIndex ?? 0)}
            />
          ))}
        </MapView>

        {visiblePlaces.length === 0 && (
          <View style={styles.mapEmpty}>
            <Text style={styles.mapEmptyText}>이 날 장소가 없어요</Text>
            <TouchableOpacity style={styles.mapEmptyBtn} onPress={() => onEnter(selectedDay)}>
              <Icon name="plus" size={12} color="white" />
            <Text style={styles.mapEmptyBtnText}>일정 추가하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 장소 목록 */}
      <ScrollView style={styles.placeList} contentContainerStyle={styles.placeListContent}>
        {visiblePlaces.length === 0 ? (
          <Text style={styles.placeEmptyText}>일정 상세에서 장소를 추가해보세요</Text>
        ) : (
          visiblePlaces.map((place) => {
            const globalIdx = chronologicalPlaces.indexOf(place)
            const color = PLACE_COLORS[globalIdx % PLACE_COLORS.length]
            return (
              <TouchableOpacity key={place.id} style={styles.placeRow} onPress={() => onEnter(place.dayIndex ?? 0)} activeOpacity={0.75}>
                <View style={[styles.placeNum, { backgroundColor: color.bg }]}>
                  <Text style={[styles.placeNumText, { color: color.dot }]}>{globalIdx + 1}</Text>
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                  {!!place.address && <Text style={styles.placeAddr} numberOfLines={1}>{place.address}</Text>}
                </View>
                <Text style={styles.placeArrow}>›</Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

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
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  enterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  enterBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  enterBtnArrow: { color: 'white', fontSize: 15, fontWeight: '700', marginTop: -1 },

  notifyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: COLORS.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  notifyInfo: { flex: 1, gap: 2 },
  notifyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  notifySub: { fontSize: 11, color: COLORS.textSub },

  dayTabsWrap: { maxHeight: 64, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayTabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  dayTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  dayTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayTabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  dayTabTextActive: { color: 'white' },
  dayTabDate: { fontSize: 11, color: COLORS.textSub },
  dayTabDateActive: { color: 'rgba(255,255,255,0.8)' },
  dayTabBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  dayTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dayTabBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  dayTabBadgeTextActive: { color: 'white' },

  mapWrap: {
    height: 260, margin: 16, borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, gap: 12,
  },
  mapEmptyText: { fontSize: 13, color: COLORS.textSub },
  mapEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
  },
  mapEmptyBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  placeList: { flex: 1 },
  placeListContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  placeEmptyText: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', marginTop: 16 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 14, padding: 12,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  placeNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  placeNumText: { fontSize: 12, fontWeight: '800' },
  placeInfo: { flex: 1 },
  placeArrow: { fontSize: 20, color: COLORS.textMuted },
  placeName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  placeAddr: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
})
