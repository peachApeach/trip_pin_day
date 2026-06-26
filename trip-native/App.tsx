import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Platform,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import MapScreen from './components/MapScreen'
import PlaceList from './components/PlaceList'
import Timetable from './components/Timetable'
import { fetchTravelSegments } from './utils/distanceMatrix'
import { COLORS } from './constants'
import type { Place, TravelMode, TravelSegment, TabKey } from './types'

interface Tab {
  key: TabKey
  icon: string
  label: string
}

export default function App() {
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(9, 0, 0, 0)
    return d
  })
  const [activeTab, setActiveTab] = useState<TabKey>('map')
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING')
  const [travelSegments, setTravelSegments] = useState<(TravelSegment | null)[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (places.length < 2) {
      setTravelSegments([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSegmentsLoading(true)
      const segments = await fetchTravelSegments(places, travelMode)
      setTravelSegments(segments)
      setSegmentsLoading(false)
    }, 800)
  }, [places, travelMode])

  const handleMapPress = useCallback((placeInfo: { lat: number; lng: number; name: string; address: string }) => {
    setPlaces((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: placeInfo.name,
        lat: placeInfo.lat,
        lng: placeInfo.lng,
        address: placeInfo.address,
        duration: 60,
      },
    ])
  }, [])

  const handleRemove = useCallback((id: number) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id))
    setSelectedPlaceId((prev) => (prev === id ? null : prev))
  }, [])

  const handleUpdateName = useCallback((id: number, name: string) => {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const handleUpdateDuration = useCallback((id: number, duration: number) => {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, duration } : p)))
  }, [])

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
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>📍</Text>
          <Text style={styles.appName}>핀데이</Text>
        </View>
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
            onMarkerPress={(id) => {
              setSelectedPlaceId(id)
              setActiveTab('list')
            }}
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
            onStartDateChange={setStartDate}
            travelMode={travelMode}
            onTravelModeChange={setTravelMode}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.bg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { fontSize: 22 },
  appName: { fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  pinCountBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  pinCountText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  content: { flex: 1 },
  mapWrapper: {
    flex: 1, position: 'relative',
    margin: 16, borderRadius: 24, overflow: 'hidden',
    shadowColor: COLORS.shadow,
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
