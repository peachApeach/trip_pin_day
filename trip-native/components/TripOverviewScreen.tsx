import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { COLORS, PLACE_COLORS } from '../constants'
import type { Trip, Place } from '../types'

interface Props {
  trip: Trip
  onEnter: (dayIndex: number | null) => void
  onBack: () => void
}

function formatDate(iso: string | null, offset = 0): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + offset)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function calcDays(start: string, end: string): number {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

export default function TripOverviewScreen({ trip, onEnter, onBack }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const mapRef = useRef<MapView>(null)

  const totalDays = calcDays(trip.tripStartDate!, trip.tripEndDate!)
  const days = Array.from({ length: totalDays }, (_, i) => i)

  const visiblePlaces = selectedDay === null
    ? trip.places
    : trip.places.filter(p => (p.dayIndex ?? 0) === selectedDay)

  const initialRegion = trip.places.length > 0 ? {
    latitude: trip.places.reduce((s, p) => s + p.lat, 0) / trip.places.length,
    longitude: trip.places.reduce((s, p) => s + p.lng, 0) / trip.places.length,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  } : {
    latitude: 37.5665, longitude: 126.978,
    latitudeDelta: 0.1, longitudeDelta: 0.1,
  }

  const handleSelectDay = (day: number | null) => {
    setSelectedDay(day)
    const places = day === null ? trip.places : trip.places.filter(p => (p.dayIndex ?? 0) === day)
    if (places.length === 0) return
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length
    const lng = places.reduce((s, p) => s + p.lng, 0) / places.length
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 400)
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>
        <TouchableOpacity style={styles.enterBtn} onPress={() => onEnter(selectedDay)}>
          <Text style={styles.enterBtnText}>일정 편집 →</Text>
        </TouchableOpacity>
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
          scrollEnabled={false}
          zoomEnabled={false}
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
          {visiblePlaces.map((place, idx) => {
            const globalIdx = trip.places.indexOf(place)
            const dotColor = PLACE_COLORS[globalIdx % PLACE_COLORS.length].dot
            return (
              <Marker
                key={`${place.id}`}
                coordinate={{ latitude: place.lat, longitude: place.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View collapsable={false} style={{ alignItems: 'center' }}>
                  <View collapsable={false} style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: dotColor,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>{globalIdx + 1}</Text>
                  </View>
                  <View style={{
                    width: 0, height: 0,
                    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
                    borderLeftColor: 'transparent', borderRightColor: 'transparent',
                    borderTopColor: dotColor,
                  }} />
                </View>
              </Marker>
            )
          })}
        </MapView>

        {visiblePlaces.length === 0 && (
          <View style={styles.mapEmpty}>
            <Text style={styles.mapEmptyText}>이 날 장소가 없어요</Text>
          </View>
        )}
      </View>

      {/* 장소 목록 */}
      <ScrollView style={styles.placeList} contentContainerStyle={styles.placeListContent}>
        {visiblePlaces.length === 0 ? (
          <Text style={styles.placeEmptyText}>일정 편집에서 장소를 추가해보세요</Text>
        ) : (
          visiblePlaces.map((place, idx) => {
            const globalIdx = trip.places.indexOf(place)
            const color = PLACE_COLORS[globalIdx % PLACE_COLORS.length]
            return (
              <View key={place.id} style={styles.placeRow}>
                <View style={[styles.placeNum, { backgroundColor: color.bg }]}>
                  <Text style={[styles.placeNumText, { color: color.dot }]}>{globalIdx + 1}</Text>
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                  {!!place.address && <Text style={styles.placeAddr} numberOfLines={1}>{place.address}</Text>}
                </View>
              </View>
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  enterBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },

  dayTabsWrap: { maxHeight: 64, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayTabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  dayTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: 'white',
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  mapEmptyText: { fontSize: 13, color: COLORS.textSub },

  placeList: { flex: 1 },
  placeListContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  placeEmptyText: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', marginTop: 16 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  placeNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  placeNumText: { fontSize: 12, fontWeight: '800' },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  placeAddr: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
})
