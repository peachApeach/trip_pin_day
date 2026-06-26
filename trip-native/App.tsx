import { useState, useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Platform,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import MapScreen from './components/MapScreen'
import PlaceList from './components/PlaceList'
import Timetable from './components/Timetable'
import TripListScreen from './components/TripListScreen'
import { fetchTravelSegments } from './utils/distanceMatrix'
import { COLORS } from './constants'
import type { Trip, Place, TravelMode, TravelSegment, TabKey } from './types'

interface Tab {
  key: TabKey
  icon: string
  label: string
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 앱 시작 시 저장된 데이터 불러오기
  useEffect(() => {
    AsyncStorage.getItem('trips').then((json) => {
      if (json) setTrips(JSON.parse(json))
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // trips 변경 시 저장
  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem('trips', JSON.stringify(trips)).catch(() => {})
  }, [trips, loaded])
  const [activeTab, setActiveTab] = useState<TabKey>('map')
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)
  const [travelSegments, setTravelSegments] = useState<(TravelSegment | null)[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const places = activeTrip?.places ?? []
  const startDate = activeTrip ? new Date(activeTrip.startDate) : (() => { const d = new Date(); d.setHours(9,0,0,0); return d })()
  const travelMode = activeTrip?.travelMode ?? 'DRIVING'

  useEffect(() => {
    const currentPlaces = activeTrip?.places ?? []
    const currentMode = activeTrip?.travelMode ?? 'DRIVING'
    if (currentPlaces.length < 2) { setTravelSegments([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSegmentsLoading(true)
      const segments = await fetchTravelSegments(currentPlaces, currentMode)
      setTravelSegments(segments)
      setSegmentsLoading(false)
    }, 800)
  }, [activeTrip])

  const updateTrip = useCallback((updater: (t: Trip) => Trip) => {
    setActiveTrip((prev) => prev ? updater(prev) : prev)
    setTrips((prev) => prev.map((t) => activeTrip && t.id === activeTrip.id ? updater(t) : t))
  }, [activeTrip])

  const handleMapPress = useCallback((info: { lat: number; lng: number; name: string; address: string }) => {
    updateTrip((t) => ({
      ...t,
      places: [...t.places, { id: Date.now(), name: info.name, lat: info.lat, lng: info.lng, address: info.address, duration: 60 }],
    }))
  }, [updateTrip])

  const handleRemove = useCallback((id: number) => {
    updateTrip((t) => ({ ...t, places: t.places.filter((p) => p.id !== id) }))
    setSelectedPlaceId((prev) => prev === id ? null : prev)
  }, [updateTrip])

  const handleUpdateName = useCallback((id: number, name: string) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, name } : p) }))
  }, [updateTrip])

  const handleUpdateDuration = useCallback((id: number, duration: number) => {
    updateTrip((t) => ({ ...t, places: t.places.map((p) => p.id === id ? { ...p, duration } : p) }))
  }, [updateTrip])

  const handleStartDateChange = useCallback((date: Date) => {
    updateTrip((t) => ({ ...t, startDate: date.toISOString() }))
  }, [updateTrip])

  const handleTravelModeChange = useCallback((mode: TravelMode) => {
    updateTrip((t) => ({ ...t, travelMode: mode }))
  }, [updateTrip])

  const handleAddTrip = (title: string) => {
    const d = new Date(); d.setHours(9, 0, 0, 0)
    const newTrip: Trip = { id: Date.now(), title, places: [], startDate: d.toISOString(), travelMode: 'DRIVING' }
    setTrips((prev) => [...prev, newTrip])
    setActiveTrip(newTrip)
    setActiveTab('map')
    setSelectedPlaceId(null)
    setTravelSegments([])
  }

  const handleDeleteTrip = (id: number) => {
    setTrips((prev) => prev.filter((t) => t.id !== id))
  }

  const handleSelectTrip = (trip: Trip) => {
    setActiveTrip(trip)
    setActiveTab('map')
    setSelectedPlaceId(null)
    setTravelSegments([])
  }

  const handleBackToList = () => {
    setActiveTrip(null)
  }

  if (!loaded) return null

  // 홈 화면 (여행 목록)
  if (!activeTrip) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <TripListScreen
            trips={trips}
            onSelect={handleSelectTrip}
            onAdd={handleAddTrip}
            onDelete={handleDeleteTrip}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  const TABS: Tab[] = [
    { key: 'map', icon: '🗺️', label: '지도' },
    { key: 'list', icon: '📍', label: `장소 (${places.length})` },
    { key: 'timetable', icon: '🕐', label: '일정' },
  ]

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBackToList}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.tripTitle} numberOfLines={1}>{activeTrip.title}</Text>
          <View style={styles.pinCountBadge}>
            <Text style={styles.pinCountText}>{places.length}개 장소</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.mapWrapper, activeTab !== 'map' && { display: 'none' }]}>
            <MapScreen
              places={places}
              selectedPlaceId={selectedPlaceId}
              onMapPress={handleMapPress}
              onMarkerPress={(id) => { setSelectedPlaceId(id); setActiveTab('list') }}
            />
            {places.length === 0 && (
              <View style={styles.mapHint}>
                <Text style={styles.mapHintText}>✨ 지도를 탭해서 장소를 추가해요</Text>
              </View>
            )}
          </View>

          {activeTab === 'list' && (
            <PlaceList
              places={places}
              selectedPlaceId={selectedPlaceId}
              onSelect={setSelectedPlaceId}
              onRemove={handleRemove}
              onUpdateName={handleUpdateName}
              onUpdateDuration={handleUpdateDuration}
              onShowMap={() => setActiveTab('map')}
            />
          )}

          {activeTab === 'timetable' && (
            <Timetable
              places={places}
              startDate={startDate}
              onStartDateChange={handleStartDateChange}
              travelMode={travelMode}
              onTravelModeChange={handleTravelModeChange}
              travelSegments={travelSegments}
              segmentsLoading={segmentsLoading}
            />
          )}
        </View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
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
  pinCountBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  pinCountText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  content: { flex: 1 },
  mapWrapper: {
    flex: 1, position: 'relative',
    margin: 16, borderRadius: 24, overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  mapHint: {
    position: 'absolute', bottom: 16, alignSelf: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  mapHintText: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  tabBar: {
    flexDirection: 'row', backgroundColor: 'white',
    paddingBottom: Platform.OS === 'ios' ? 8 : 4, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },
  tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 1 },
})
