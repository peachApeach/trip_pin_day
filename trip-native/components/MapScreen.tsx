import { useRef, useState, useEffect } from 'react'
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, FlatList, ScrollView, Linking, Dimensions,
} from 'react-native'
import MapView, { Marker, Polyline, MapPressEvent, PoiClickEvent, Region } from 'react-native-maps'
import * as Location from 'expo-location'
import { GOOGLE_MAPS_API_KEY, COLORS, PLACE_COLORS } from '../constants'
import type { Place } from '../types'

interface ActivityItem {
  placeId: string
  name: string
  address: string
  rating?: number
  userRatingsTotal?: number
  priceLevel?: number
  photoRef?: string
  types: string[]
}

interface PlaceDetail {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  userRatingsTotal?: number
  priceLevel?: number
  openNow?: boolean
  todayHours?: string
  phone?: string
}

interface Props {
  places: Place[]
  selectedPlaceId: number | null
  focusPlaceId: number | null
  allRoutes: { latitude: number; longitude: number }[][]
  routeCoords: { latitude: number; longitude: number }[]
  routeStatus: 'idle' | 'loading' | 'ok' | 'failed'
  onMapPress: (info: { lat: number; lng: number; name: string; address: string }) => void
  onMarkerPress: (id: number) => void
  onRemove: (id: number) => void
}

interface SearchResult {
  name: string
  address: string
  lat: number
  lng: number
}

const INITIAL_REGION: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

const PANEL_TRANSLATE_X = Math.round(Dimensions.get('window').width * 0.72)

const act = StyleSheet.create({
  tab: {
    position: 'absolute',
    right: '100%', top: '35%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14, paddingHorizontal: 9,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  tabIcon: { fontSize: 16, color: 'white', fontWeight: '800' },
  tabLabel: { fontSize: 9, color: 'white', fontWeight: '700', textAlign: 'center', lineHeight: 13 },
  panel: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: '72%',
    backgroundColor: 'white',
    shadowColor: '#000', shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 12,
    zIndex: 9,
  },
  panelOpen: { right: 0 },
  panelClosed: { right: 0, transform: [{ translateX: PANEL_TRANSLATE_X }] },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 15, color: '#ccc' },
  loading: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  list: { padding: 10, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: '#FAFAFA', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#F0F0F0', gap: 6,
  },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  cardAddr: { fontSize: 10, color: COLORS.textSub },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaRating: { fontSize: 11, fontWeight: '700', color: '#FFA000' },
  metaCount: { fontSize: 10, color: COLORS.textSub },
  metaPrice: { fontSize: 11, fontWeight: '600', color: '#43A047' },
  klookBtn: {
    marginTop: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#FF6B35', alignItems: 'center',
  },
  klookBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },
})

export default function MapScreen({ places, selectedPlaceId, focusPlaceId, allRoutes, routeCoords, routeStatus, onMapPress, onMarkerPress, onRemove }: Props) {
  const mapRef = useRef<MapView>(null)
  const markerPressedRef = useRef(false)
  const geocodeIdRef = useRef(0)

  useEffect(() => {
    if (selectedPlaceId) setPreviewMarker(null)
  }, [selectedPlaceId])

  useEffect(() => {
    if (!focusPlaceId) return
    const place = places.find(p => p.id === focusPlaceId)
    if (!place) return
    mapRef.current?.animateToRegion({
      latitude: place.lat,
      longitude: place.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500)
  }, [focusPlaceId])

  useEffect(() => {
    if (routeCoords.length < 2) return
    const lats = routeCoords.map(c => c.latitude)
    const lngs = routeCoords.map(c => c.longitude)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    mapRef.current?.animateToRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.4 + 0.005,
      longitudeDelta: (maxLng - minLng) * 1.4 + 0.005,
    }, 600)
  }, [routeCoords])

  const handleMapReady = async () => {
    if (places.length > 0) {
      mapRef.current?.animateToRegion({
        latitude: places[0].lat,
        longitude: places[0].lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 600)
      return
    }
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 600)
  }
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previewMarker, setPreviewMarker] = useState<SearchResult | null>(null)
  const [suggestions, setSuggestions] = useState<{ placeId: string; description: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRegionRef = useRef<Region>(INITIAL_REGION)
  const [placeDetail, setPlaceDetail] = useState<PlaceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showActivities, setShowActivities] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  const fetchActivities = async () => {
    setActivitiesLoading(true)
    setActivities([])
    try {
      let latitude = currentRegionRef.current.latitude
      let longitude = currentRegionRef.current.longitude
      try {
        const camera = await mapRef.current?.getCamera()
        if (camera?.center) { latitude = camera.center.latitude; longitude = camera.center.longitude }
      } catch {}

      const types = 'tourist_attraction'
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=5000&type=${types}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK') {
        setActivities(data.results.slice(0, 20).map((r: any) => ({
          placeId: r.place_id,
          name: r.name ?? '',
          address: r.vicinity ?? '',
          rating: r.rating,
          userRatingsTotal: r.user_ratings_total,
          priceLevel: r.price_level,
          photoRef: r.photos?.[0]?.photo_reference,
          types: r.types ?? [],
        })))
      }
    } catch {}
    finally { setActivitiesLoading(false) }
  }

  const handleToggleActivities = () => {
    if (!showActivities) {
      setShowActivities(true)
      fetchActivities()
    } else {
      setShowActivities(false)
    }
  }

  const handleActivityPress = async (item: ActivityItem) => {
    setShowActivities(false)
    onMarkerPress(0)
    setDetailLoading(true)
    setPlaceDetail(null)
    const detail = await fetchPlaceDetail(item.placeId)
    setDetailLoading(false)
    if (!detail) return
    setPreviewMarker(detail)
    mapRef.current?.animateToRegion({
      latitude: detail.lat, longitude: detail.lng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 500)
  }

  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    const stars = item.rating ? `★ ${item.rating.toFixed(1)}` : null
    const price = item.priceLevel != null ? '₩'.repeat(item.priceLevel + 1) : null
    const klookUrl = `https://www.klook.com/ko/search/?query=${encodeURIComponent(item.name)}&af_id=PARTNER_ID`
    return (
      <TouchableOpacity style={act.card} onPress={() => handleActivityPress(item)} activeOpacity={0.75}>
        <Text style={act.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={act.cardAddr} numberOfLines={1}>📌 {item.address}</Text>
        <View style={act.cardMeta}>
          {stars && <Text style={act.metaRating}>{stars}</Text>}
          {item.userRatingsTotal != null && (
            <Text style={act.metaCount}>({item.userRatingsTotal.toLocaleString()})</Text>
          )}
          {price && <Text style={act.metaPrice}>{price}</Text>}
        </View>
        <TouchableOpacity style={act.klookBtn} onPress={(e) => { e.stopPropagation(); Linking.openURL(klookUrl) }}>
          <Text style={act.klookBtnText}>🎫 클룩에서 예약하기</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  const fetchSuggestions = async (text: string) => {
    if (text.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    try {
      const { latitude, longitude } = currentRegionRef.current
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&location=${latitude},${longitude}&radius=20000&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK') {
        setSuggestions(data.predictions.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          description: p.description,
        })))
        setShowSuggestions(true)
      }
    } catch {}
  }

  const fetchPlaceDetail = async (placeId: string): Promise<SearchResult | null> => {
    try {
      const fields = 'name,geometry,formatted_address,rating,user_ratings_total,price_level,opening_hours,formatted_phone_number'
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const r = data?.result
      if (!r) return null

      const todayIdx = new Date().getDay()
      const weekdayTexts: string[] | undefined = r.opening_hours?.weekday_text
      const todayHours = weekdayTexts?.[todayIdx === 0 ? 6 : todayIdx - 1]?.replace(/^[^:]+:\s*/, '') ?? undefined

      setPlaceDetail({
        placeId,
        name: r.name ?? '',
        address: r.formatted_address ?? '',
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        priceLevel: r.price_level,
        openNow: r.opening_hours?.open_now,
        todayHours,
        phone: r.formatted_phone_number,
      })

      return {
        name: r.name ?? '',
        address: r.formatted_address ?? '',
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }
    } catch { return null }
  }

  const fetchDetailByLatLng = async (lat: number, lng: number, name: string) => {
    setDetailLoading(true)
    setPlaceDetail(null)
    try {
      // Nearby Search로 가장 가까운 place_id 찾기
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&keyword=${encodeURIComponent(name)}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const nearbyRes = await fetch(nearbyUrl)
      const nearbyData = await nearbyRes.json()
      const placeId = nearbyData?.results?.[0]?.place_id
      if (placeId) {
        await fetchPlaceDetail(placeId)
      } else {
        setPlaceDetail({ placeId: '', name, address: '', lat, lng })
      }
    } catch {
      setPlaceDetail({ placeId: '', name, address: '', lat, lng })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSuggestionSelect = async (item: { placeId: string; description: string }) => {
    setShowSuggestions(false)
    setQuery(item.description)
    Keyboard.dismiss()
    onMarkerPress(0)
    setDetailLoading(true)
    setPlaceDetail(null)
    const detail = await fetchPlaceDetail(item.placeId)
    setDetailLoading(false)
    if (!detail) return
    setPreviewMarker(detail)
    mapRef.current?.animateToRegion(
      { latitude: detail.lat, longitude: detail.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    )
  }

  const handleQueryChange = (text: string) => {
    setQuery(text)
    setErrorMsg('')
    if (!text) { setSuggestions([]); setShowSuggestions(false) }
    if (autocompleteRef.current) clearTimeout(autocompleteRef.current)
    autocompleteRef.current = setTimeout(() => fetchSuggestions(text), 300)
  }

  const parseResults = (items: any[]): SearchResult[] =>
    items.map((r: any) => ({
      name: r.name ?? '',
      address: r.formatted_address ?? '',
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    }))

  const handleSearch = async () => {
    if (!query.trim()) return
    Keyboard.dismiss()
    setShowSuggestions(false)
    setSuggestions([])
    if (autocompleteRef.current) clearTimeout(autocompleteRef.current)
    setSearching(true)
    setErrorMsg('')
    setResults([])
    setNextPageToken(null)

    try {
      const { latitude, longitude } = currentRegionRef.current
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query.trim())}&location=${latitude},${longitude}&radius=20000&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.status !== 'OK' || !data.results?.length) {
        setErrorMsg(`검색 결과가 없어요 (${data.status})`)
        return
      }

      setResults(parseResults(data.results))
      setNextPageToken(data.next_page_token ?? null)
      setShowModal(true)
    } catch (e: any) {
      setErrorMsg(`에러: ${e?.message ?? '알 수 없는 오류'}`)
    } finally {
      setSearching(false)
    }
  }

  const handleLoadMore = async () => {
    if (!nextPageToken || loadingMore) return
    setLoadingMore(true)
    try {
      await new Promise((r) => setTimeout(r, 2000))
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK' && data.results?.length) {
        setResults((prev) => [...prev, ...parseResults(data.results)])
        setNextPageToken(data.next_page_token ?? null)
      } else {
        setNextPageToken(null)
      }
    } catch {
      setNextPageToken(null)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    setShowModal(false)
    setQuery('')
    onMarkerPress(0)
    setPreviewMarker(result)
    mapRef.current?.animateToRegion(
      { latitude: result.lat, longitude: result.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    )
  }

  const handlePoiClick = (e: PoiClickEvent) => {
    if (showModal) return
    setShowSuggestions(false)
    const { coordinate, name, placeId } = e.nativeEvent
    setPreviewMarker({ lat: coordinate.latitude, lng: coordinate.longitude, name, address: '' })
    setDetailLoading(true)
    setPlaceDetail(null)
    if (placeId) {
      fetchPlaceDetail(placeId).then(() => setDetailLoading(false))
    } else {
      fetchDetailByLatLng(coordinate.latitude, coordinate.longitude, name).then(() => setDetailLoading(false))
    }
  }

  const handleMapPress = async (e: MapPressEvent) => {
    if (showModal) return
    setShowSuggestions(false)
    if (markerPressedRef.current) { markerPressedRef.current = false; return }
    onMarkerPress(0)
    setPlaceDetail(null)
    const { latitude, longitude } = e.nativeEvent.coordinate
    setPreviewMarker({ lat: latitude, lng: longitude, name: '선택한 장소', address: '' })
    const id = ++geocodeIdRef.current
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (id !== geocodeIdRef.current) return
      const result = data?.results?.[0]
      const name: string = result?.address_components?.[0]?.long_name ?? '선택한 장소'
      const address: string = result?.formatted_address ?? ''
      setPreviewMarker({ lat: latitude, lng: longitude, name, address })
    } catch {}
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        onRegionChangeComplete={(region) => { currentRegionRef.current = region }}
        showsUserLocation
        showsMyLocationButton
      >
        {allRoutes.map((coords, i) =>
          coords.length >= 2 ? (
            <Polyline
              key={`route-${i}`}
              coordinates={coords}
              strokeColor={COLORS.primary + '80'}
              strokeWidth={3}
            />
          ) : null
        )}
        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={COLORS.primary}
            strokeWidth={5}
          />
        )}

        {previewMarker && !selectedPlaceId && (
          <Marker
            coordinate={{ latitude: previewMarker.lat, longitude: previewMarker.lng }}
            pinColor={COLORS.mint}
          />
        )}

        {places.map((place, index) => {
          const dotColor = PLACE_COLORS[index % PLACE_COLORS.length].dot
          const isSelected = selectedPlaceId === place.id
          return (
          <Marker
            key={`${place.id}-${isSelected}`}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            tracksViewChanges={true}
            anchor={isSelected ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
            onPress={() => {
              markerPressedRef.current = true
              setTimeout(() => { markerPressedRef.current = false }, 300)
              geocodeIdRef.current++
              onMarkerPress(place.id)
              setPreviewMarker(null)
            }}
          >
            {isSelected ? (
              // 뱃지 — 바깥 사각형 래퍼, borderRadius 없음
              <View collapsable={false} style={{ padding: 4 }}>
                <View collapsable={false} style={{
                  paddingHorizontal: 8, paddingVertical: 4,
                  backgroundColor: 'white',
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: dotColor,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: dotColor, fontSize: 12, fontWeight: '800' }}>{index + 1}</Text>
                </View>
              </View>
            ) : (
              // 핀 — 원 + 삼각형, borderRadius 없는 column
              <View collapsable={false} style={{ alignItems: 'center' }}>
                <View collapsable={false} style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: dotColor,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '800' }}>{index + 1}</Text>
                </View>
                <View style={{
                  width: 0, height: 0,
                  borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
                  borderLeftColor: 'transparent', borderRightColor: 'transparent',
                  borderTopColor: dotColor,
                }} />
              </View>
            )}
          </Marker>
        )})}
      </MapView>

      {/* 검색창 */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBox, !!errorMsg && styles.searchBoxError]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="장소 검색"
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => { setShowSuggestions(false); handleSearch() }}
          />
          {searching
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
            : !!query && (
              <TouchableOpacity onPress={() => { setQuery(''); setErrorMsg(''); setSuggestions([]); setShowSuggestions(false) }} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )
          }
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>
        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={item.placeId}
                style={[styles.suggestionItem, idx === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleSuggestionSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionIcon}>📍</Text>
                <Text style={styles.suggestionText} numberOfLines={1}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 경로 상태 배너 */}
      {routeStatus === 'loading' && (
        <View style={styles.routeBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.routeBannerText}>경로 불러오는 중...</Text>
        </View>
      )}
      {routeStatus === 'failed' && (
        <View style={[styles.routeBanner, styles.routeBannerFailed]}>
          <Text style={styles.routeBannerFailedText}>경로를 찾을 수 없어요</Text>
        </View>
      )}

      {/* 장소 정보 시트 — 기존 핀 선택 */}
      {selectedPlaceId && !previewMarker && (() => {
        const idx = places.findIndex(p => p.id === selectedPlaceId)
        const place = places[idx]
        if (!place) return null
        const dotColor = PLACE_COLORS[idx % PLACE_COLORS.length].dot
        return (
          <PlaceSheet
            name={place.name}
            address={place.address}
            accentColor={dotColor}
            detail={null}
            detailLoading={false}
            actionLabel="🗑 삭제"
            actionColor="#FF5252"
            onAction={() => { onRemove(place.id); onMarkerPress(0) }}
            onClose={() => onMarkerPress(0)}
          />
        )
      })()}

      {/* 장소 정보 시트 — 새 장소 / POI / 검색 결과 */}
      {previewMarker && (
        <PlaceSheet
          name={previewMarker.name}
          address={previewMarker.address}
          accentColor={COLORS.mint}
          detail={placeDetail}
          detailLoading={detailLoading}
          actionLabel="+ 일정 추가"
          actionColor={COLORS.mint}
          onAction={() => {
            const name = placeDetail?.name || previewMarker.name
            const address = placeDetail?.address || previewMarker.address
            onMapPress({ lat: previewMarker.lat, lng: previewMarker.lng, name, address })
            setPreviewMarker(null)
            setPlaceDetail(null)
          }}
          onClose={() => { setPreviewMarker(null); setPlaceDetail(null) }}
        />
      )}

      {/* 검색 결과 패널 */}
      {showModal && (
        <View style={styles.resultsPanel}>
          <TouchableOpacity
            style={styles.resultsOverlay}
            activeOpacity={1}
            onPress={() => setShowModal(false)}
          />
          <View style={styles.resultsSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.resultsTitleRow}>
              <Text style={styles.modalTitle}>검색 결과</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.resultsDismiss}>
                <Text style={styles.resultsDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingMoreText}>더 불러오는 중...</Text>
                  </View>
                ) : nextPageToken ? (
                  <View style={styles.loadingMore}>
                    <Text style={styles.loadingMoreText}>스크롤해서 더 보기</Text>
                  </View>
                ) : null
              }
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[styles.resultItem, index === results.length - 1 && !nextPageToken && styles.resultItemLast]}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultIcon}>
                    <Text style={styles.resultIconText}>📍</Text>
                  </View>
                  <View style={styles.resultTexts}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
                  </View>
                  <Text style={styles.resultArrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* 사이드 액티비티 패널 (손잡이 포함) */}
      <View style={[act.panel, showActivities ? act.panelOpen : act.panelClosed]}>
        {/* 손잡이 — 패널 왼쪽에 붙음 */}
        <TouchableOpacity style={act.tab} onPress={handleToggleActivities} activeOpacity={0.8}>
          <Text style={act.tabIcon}>{showActivities ? '›' : '‹'}</Text>
          <Text style={act.tabLabel}>{'즐\n길\n거\n리'}</Text>
        </TouchableOpacity>

        <View style={act.header}>
          <View>
            <Text style={act.title}>📍 근처 즐길거리</Text>
            <Text style={act.subtitle}>현재 지도 위치 기준 5km</Text>
          </View>
          <TouchableOpacity onPress={() => setShowActivities(false)} style={act.closeBtn}>
            <Text style={act.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {activitiesLoading ? (
          <View style={act.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={act.loadingText}>찾는 중...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={act.loading}>
            <Text style={act.loadingText}>주변에 관광지가 없어요</Text>
          </View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={item => item.placeId}
            contentContainerStyle={act.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderActivityItem}
          />
        )}
      </View>
    </View>
  )
}

function PlaceSheet({
  name, address, accentColor, detail, detailLoading,
  actionLabel, actionColor, onAction, onClose,
}: {
  name: string
  address: string
  accentColor: string
  detail: PlaceDetail | null
  detailLoading: boolean
  actionLabel: string
  actionColor: string
  onAction: () => void
  onClose: () => void
}) {
  const stars = detail?.rating ? '★'.repeat(Math.round(detail.rating)) + '☆'.repeat(5 - Math.round(detail.rating)) : null
  const price = detail?.priceLevel != null ? '₩'.repeat(detail.priceLevel + 1) : null

  return (
    <View style={sheet.container}>
      <View style={sheet.handle} />
      <View style={sheet.header}>
        <View style={[sheet.dot, { backgroundColor: accentColor }]} />
        <View style={sheet.headerTexts}>
          <Text style={sheet.name} numberOfLines={1}>{name}</Text>
          {!!address && <Text style={sheet.address} numberOfLines={1}>{address}</Text>}
        </View>
        <TouchableOpacity onPress={onClose} style={sheet.closeBtn}>
          <Text style={sheet.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {detailLoading && (
        <View style={sheet.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.textSub} />
          <Text style={sheet.loadingText}>정보 불러오는 중...</Text>
        </View>
      )}

      {detail && !detailLoading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheet.chips}>
          {detail.openNow != null && (
            <View style={[sheet.chip, { backgroundColor: detail.openNow ? '#E8F5E9' : '#FFEBEE' }]}>
              <Text style={[sheet.chipText, { color: detail.openNow ? '#2E7D32' : '#C62828' }]}>
                {detail.openNow ? '영업 중' : '영업 종료'}
              </Text>
            </View>
          )}
          {!!detail.todayHours && (
            <View style={sheet.chip}>
              <Text style={sheet.chipText}>🕐 {detail.todayHours}</Text>
            </View>
          )}
          {stars && (
            <View style={sheet.chip}>
              <Text style={sheet.chipText}>
                <Text style={{ color: '#FFA000' }}>{detail.rating?.toFixed(1)} </Text>
                <Text style={{ color: '#FFA000', fontSize: 11 }}>{stars}</Text>
                {detail.userRatingsTotal != null && (
                  <Text style={{ color: COLORS.textSub }}> ({detail.userRatingsTotal.toLocaleString()})</Text>
                )}
              </Text>
            </View>
          )}
          {price && (
            <View style={sheet.chip}>
              <Text style={sheet.chipText}>{price}</Text>
            </View>
          )}
          {!!detail.phone && (
            <TouchableOpacity style={sheet.chip} onPress={() => Linking.openURL(`tel:${detail.phone}`)}>
              <Text style={sheet.chipText}>📞 {detail.phone}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[sheet.actionBtn, { backgroundColor: actionColor }]} onPress={onAction}>
        <Text style={sheet.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

const sheet = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  headerTexts: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  address: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 14, color: '#ccc' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 12 },
  chip: {
    backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, flexShrink: 0,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  actionBtn: {
    paddingVertical: 13, borderRadius: 16, alignItems: 'center', marginTop: 4,
  },
  actionText: { color: 'white', fontSize: 14, fontWeight: '800' },
})

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchWrapper: {
    position: 'absolute', top: 14, left: 14, right: 14,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  searchBoxError: { borderColor: COLORS.primary },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text, padding: 0 },
  clearBtn: { padding: 4, marginRight: 4 },
  clearText: { fontSize: 13, color: '#ccc' },
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  searchBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  errorText: { marginTop: 6, marginLeft: 4, fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  suggestionsBox: {
    marginTop: 6, backgroundColor: 'white', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  suggestionIcon: { fontSize: 13 },
  suggestionText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },

  resultsPanel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
  },
  resultsOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  resultsSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 32,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 12,
  },
  resultsTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  resultsDismiss: { padding: 4 },
  resultsDismissText: { fontSize: 16, color: '#ccc' },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 12,
  },
  resultItemLast: { borderBottomWidth: 0 },
  resultIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  resultIconText: { fontSize: 16 },
  resultTexts: { flex: 1, gap: 2 },
  resultName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  resultAddress: { fontSize: 11, color: COLORS.textSub },
  resultArrow: { fontSize: 20, color: '#D0D0D0', fontWeight: '300' },
  loadingMore: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, gap: 8,
  },
  loadingMoreText: { fontSize: 12, color: COLORS.textSub },

  routeBanner: {
    position: 'absolute', top: 72, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  routeBannerText: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  routeBannerFailed: { backgroundColor: '#FFF3F3' },
  routeBannerFailedText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

})
