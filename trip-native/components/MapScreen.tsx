import { useCallback, useRef, useState, useEffect } from 'react'
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, FlatList, ScrollView, Linking, Dimensions, Image,
} from 'react-native'
import MapView, { Polyline, MapPressEvent, PoiClickEvent, Region } from 'react-native-maps'
import * as Location from 'expo-location'
import { COLORS, PLACE_COLORS } from '../constants'
import Icon, { CloseIcon } from './Icon'
import MapPin, { categoryOf } from './MapPin'
import { klookSearchUrl } from '../utils/affiliate'
import { latLngParam } from '../utils/geo'
import { mapsFetch, mapsImageSource } from '../utils/mapsApi'
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
  dayNumber: number
  active: boolean
  /** 이 값이 바뀌면 전체 경로에 맞춰 카메라를 다시 맞춘다 (여행·Day 전환). */
  fitKey: string
  selectedPlaceId: number | null
  focusPlaceId: number | null
  allRoutes: { latitude: number; longitude: number }[][]
  routeCoords: { latitude: number; longitude: number }[]
  routeStatus: 'idle' | 'loading' | 'ok' | 'failed'
  onAddPlace: (info: Pick<Place, 'lat' | 'lng' | 'name' | 'address'>) => void
  onMarkerPress: (id: number) => void
  onRemove: (id: number) => void
  /** 한 장소로 이동을 끝냈음을 알린다. 안 비우면 이후 전체 경로 맞추기가 계속 막힌다. */
  onFocusHandled: () => void
}

interface SearchResult {
  name: string
  address: string
  lat: number
  lng: number
  /** Places가 돌려주는 분류. 핀 색을 고르는 데만 쓴다. */
  types?: string[]
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
    width: 48, minHeight: 48, paddingVertical: 16,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
    alignItems: 'center', gap: 5,
    shadowColor: COLORS.text, shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  tabIcon: { fontSize: 17, color: COLORS.text, fontWeight: '800' },
  tabLabel: { fontSize: 12, color: COLORS.text, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  panel: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: '72%',
    backgroundColor: COLORS.card,
    shadowColor: COLORS.text, shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 12,
    zIndex: 9,
  },
  panelOpen: { right: 0 },
  panelClosed: { right: 0, transform: [{ translateX: PANEL_TRANSLATE_X }] },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  list: { padding: 10, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  // 사진 + 글을 좌우로 — 사진이 없는 카드와 높이가 비슷하게 유지된다
  cardRow: { flexDirection: 'row', gap: 10 },
  cardTexts: { flex: 1, gap: 4 },
  thumb: {
    width: 68, height: 68, borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  // 사진이 없거나 못 불러왔을 때 자리만 지킨다 (레이아웃이 흔들리지 않게)
  thumbFallback: {
    width: 68, height: 68, borderRadius: 10,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  cardAddr: { flex: 1, fontSize: 10, color: COLORS.textSub },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaRating: { fontSize: 11, fontWeight: '700', color: COLORS.rating },
  metaCount: { fontSize: 10, color: COLORS.textSub },
  metaPrice: { fontSize: 11, fontWeight: '600', color: COLORS.mintDark },
  klookBtn: {
    marginTop: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  klookBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
})

export default function MapScreen({ places, dayNumber, active, fitKey, selectedPlaceId, focusPlaceId, allRoutes, routeCoords, routeStatus, onAddPlace, onMarkerPress, onRemove, onFocusHandled }: Props) {
  const mapRef = useRef<MapView>(null)
  const markerPressedRef = useRef(false)
  const previewRequestRef = useRef(0)
  const mapReadyRef = useRef(false)
  // 이 fitKey에 대해 자동 맞추기가 아직 유효한지. 사용자가 지도를 조작하면 해제한다.
  const autoFitKeyRef = useRef<string | null>(null)

  // 전체 경로가 한 화면에 들어오도록 카메라를 맞춘다.
  // 마커 좌표만 쓰면 경로선이 직선 바깥으로 휠 때(실제 도로/대중교통) 잘리므로
  // 그려진 경로 좌표까지 범위에 포함한다. 장소가 하나면 그 지점을 확대한다.
  const fitToAll = () => {
    if (!mapReadyRef.current) return
    const coords = [
      ...places.map(p => ({ latitude: p.lat, longitude: p.lng })),
      ...allRoutes.flat(),
    ]
    if (coords.length === 0) return
    if (coords.length === 1) {
      mapRef.current?.animateToRegion({
        ...coords[0],
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 600)
      return
    }
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 90, right: 70, bottom: 170, left: 70 },
      animated: true,
    })
  }

  useEffect(() => {
    if (!focusPlaceId) return
    const place = places.find(p => p.id === focusPlaceId)
    if (place) {
      mapRef.current?.animateToRegion({
        latitude: place.lat,
        longitude: place.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500)
    }
    onFocusHandled()
  }, [focusPlaceId])

  // 지도 탭에 들어올 때와 Day가 바뀔 때, 그 Day의 전체 경로가 한 화면에 들어오게 맞춘다.
  // 일정 탭에서 지도는 display:none이라 onMapReady 시점엔 places가 비어 있을 수 있고,
  // 숨은 동안에는 카메라 이동이 반영되지 않으므로 보이는 시점에 다시 맞춰야 한다.
  useEffect(() => {
    if (!active || focusPlaceId) return
    autoFitKeyRef.current = fitKey
    fitToAll()
  }, [active, fitKey])

  // 경로선은 비동기로 도착한다. 먼저 맞춘 범위가 경로를 자를 수 있으므로 도착 후 한 번 더
  // 맞추는데, 그 사이 사용자가 확대하거나 지도를 움직였다면(autoFitKey가 해제됨) 건드리지
  // 않는다. allRoutes는 장소를 고칠 때마다 새로 오기 때문에 이 가드가 없으면 카메라를 뺏는다.
  useEffect(() => {
    if (!active || focusPlaceId) return
    if (autoFitKeyRef.current !== fitKey) return
    fitToAll()
  }, [allRoutes])

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
    mapReadyRef.current = true
    if (places.length > 0) {
      fitToAll()
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
  // 사진을 못 불러온 장소. 깨진 아이콘 대신 자리표시로 바꾼다.
  const [photoFailed, setPhotoFailed] = useState<string[]>([])

  const clearPreview = useCallback(() => {
    const request = ++previewRequestRef.current
    setPreviewMarker(null)
    setPlaceDetail(null)
    setDetailLoading(false)
    return request
  }, [])

  useEffect(() => {
    clearPreview()
    return () => { previewRequestRef.current++ }
  }, [fitKey, clearPreview])

  useEffect(() => {
    if (selectedPlaceId) clearPreview()
  }, [selectedPlaceId, clearPreview])

  const fetchActivities = async () => {
    setActivitiesLoading(true)
    setActivities([])
    setPhotoFailed([])
    try {
      let latitude = currentRegionRef.current.latitude
      let longitude = currentRegionRef.current.longitude
      try {
        const camera = await mapRef.current?.getCamera()
        if (camera?.center) { latitude = camera.center.latitude; longitude = camera.center.longitude }
      } catch {}

      const location = latLngParam(latitude, longitude)
      if (location == null) return
      const res = await mapsFetch('/place/nearbysearch/json', {
        location, radius: 5000, type: 'tourist_attraction', language: 'ko',
      })
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

  const handleActivityPress = (item: ActivityItem) => {
    setShowActivities(false)
    void showPlacePreview(item.placeId)
  }

  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    const stars = item.rating ? `★ ${item.rating.toFixed(1)}` : null
    const price = item.priceLevel != null ? '₩'.repeat(item.priceLevel + 1) : null
    const klookUrl = klookSearchUrl(item.name)
    const failed = photoFailed.includes(item.placeId)
    return (
      <TouchableOpacity style={act.card} onPress={() => handleActivityPress(item)} activeOpacity={0.75}>
        <View style={act.cardRow}>
          {item.photoRef && !failed ? (
            <Image
              style={act.thumb}
              source={mapsImageSource(item.photoRef, 200)}
              resizeMode="cover"
              // 사진이 막히거나 깨져도 카드는 그대로 쓸 수 있어야 한다
              onError={() => setPhotoFailed(prev => prev.includes(item.placeId) ? prev : [...prev, item.placeId])}
            />
          ) : (
            <View style={act.thumbFallback}>
              <Icon name="pin" size={24} color={COLORS.textMuted} />
            </View>
          )}
          <View style={act.cardTexts}>
            <Text style={act.cardName} numberOfLines={2}>{item.name}</Text>
            <View style={act.addrRow}>
              <Icon name="pin" size={10} color={COLORS.textMuted} />
              <Text style={act.cardAddr} numberOfLines={2}>{item.address}</Text>
            </View>
            <View style={act.cardMeta}>
              {stars && <Text style={act.metaRating}>{stars}</Text>}
              {item.userRatingsTotal != null && (
                <Text style={act.metaCount}>({item.userRatingsTotal.toLocaleString()})</Text>
              )}
              {price && <Text style={act.metaPrice}>{price}</Text>}
            </View>
          </View>
        </View>
        {!!klookUrl && (
          <TouchableOpacity style={act.klookBtn} onPress={(e) => { e.stopPropagation(); Linking.openURL(klookUrl) }}>
            <Text style={act.klookBtnText}>클룩에서 예약하기</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  const fetchSuggestions = async (text: string) => {
    if (text.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    try {
      const { latitude, longitude } = currentRegionRef.current
      const location = latLngParam(latitude, longitude)
      if (location == null) return
      const res = await mapsFetch('/place/autocomplete/json', {
        input: text, location, radius: 20000, language: 'ko',
      })
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

  const fetchPlaceDetail = async (placeId: string): Promise<(PlaceDetail & SearchResult) | null> => {
    try {
      // types는 핀 색을 카테고리별로 고르기 위해 받는다 (Basic Data라 과금 변화 없음)
      const fields = 'name,geometry,formatted_address,types,rating,user_ratings_total,price_level,opening_hours,formatted_phone_number'
      const res = await mapsFetch('/place/details/json', {
        place_id: placeId, fields, language: 'ko',
      })
      const data = await res.json()
      const r = data?.result
      if (!r) return null

      const todayIdx = new Date().getDay()
      const weekdayTexts: string[] | undefined = r.opening_hours?.weekday_text
      const todayHours = weekdayTexts?.[todayIdx === 0 ? 6 : todayIdx - 1]?.replace(/^[^:]+:\s*/, '') ?? undefined

      return {
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
        types: r.types ?? [],
      }
    } catch { return null }
  }

  const fetchDetailByLatLng = async (lat: number, lng: number, name: string) => {
    try {
      // Nearby Search로 가장 가까운 place_id 찾기
      const location = latLngParam(lat, lng)
      if (location == null) return null
      const nearbyRes = await mapsFetch('/place/nearbysearch/json', {
        location, rankby: 'distance', keyword: name, language: 'ko',
      })
      const nearbyData = await nearbyRes.json()
      const placeId = nearbyData?.results?.[0]?.place_id
      return placeId ? await fetchPlaceDetail(placeId) : null
    } catch { return null }
  }

  const showPlacePreview = async (placeId: string) => {
    onMarkerPress(0)
    const request = clearPreview()
    setDetailLoading(true)
    const detail = await fetchPlaceDetail(placeId)
    if (request !== previewRequestRef.current) return
    setDetailLoading(false)
    if (!detail) return
    setPlaceDetail(detail)
    setPreviewMarker(detail)
    mapRef.current?.animateToRegion(
      { latitude: detail.lat, longitude: detail.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    )
  }

  const handleSuggestionSelect = (item: { placeId: string; description: string }) => {
    setShowSuggestions(false)
    setQuery(item.description)
    Keyboard.dismiss()
    void showPlacePreview(item.placeId)
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
      types: r.types ?? [],
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
      const location = latLngParam(latitude, longitude)
      if (location == null) { setErrorMsg('현재 지도 위치를 확인할 수 없어요'); return }
      const res = await mapsFetch('/place/textsearch/json', {
        query: query.trim(), location, radius: 20000, language: 'ko',
      })
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
      const res = await mapsFetch('/place/textsearch/json', { pagetoken: nextPageToken })
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
    clearPreview()
    setPreviewMarker(result)
    mapRef.current?.animateToRegion(
      { latitude: result.lat, longitude: result.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    )
  }

  const handlePoiClick = async (e: PoiClickEvent) => {
    if (showModal) return
    setShowSuggestions(false)
    // 지도 탭과 같게 — 첫 탭은 패널을 치우는 데만 쓴다
    if (showActivities) { setShowActivities(false); return }
    const { coordinate, name, placeId } = e.nativeEvent
    onMarkerPress(0)
    const request = clearPreview()
    const marker = { lat: coordinate.latitude, lng: coordinate.longitude, name, address: '' }
    setPreviewMarker(marker)
    setDetailLoading(true)
    const detail = placeId ? await fetchPlaceDetail(placeId) : await fetchDetailByLatLng(marker.lat, marker.lng, name)
    if (request !== previewRequestRef.current) return
    setDetailLoading(false)
    setPlaceDetail(detail)
    if (detail?.types) setPreviewMarker({ ...marker, types: detail.types })
  }

  const handleMapPress = async (e: MapPressEvent) => {
    if (showModal) return
    setShowSuggestions(false)
    if (markerPressedRef.current) { markerPressedRef.current = false; return }
    // 즐길거리가 열려 있으면 패널을 닫는 것으로 끝낸다. 패널이 지도를 72%만
    // 덮어서 왼쪽을 누르면 지도 탭이 들어오는데, 장소까지 집어버리면
    // 패널을 치우려던 손짓이 엉뚱한 미리보기를 띄운다.
    if (showActivities) { setShowActivities(false); return }
    onMarkerPress(0)
    const request = clearPreview()
    const { latitude, longitude } = e.nativeEvent.coordinate
    setPreviewMarker({ lat: latitude, lng: longitude, name: '선택한 장소', address: '' })
    try {
      const latlng = latLngParam(latitude, longitude)
      if (latlng == null) return
      const res = await mapsFetch('/geocode/json', { latlng, language: 'ko' })
      const data = await res.json()
      if (request !== previewRequestRef.current) return
      const result = data?.results?.[0]
      const name: string = result?.address_components?.[0]?.long_name ?? '선택한 장소'
      const address: string = result?.formatted_address ?? ''
      setPreviewMarker({ lat: latitude, lng: longitude, name, address })
    } catch {}
  }

  const previewRequest = previewRequestRef.current

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        onRegionChangeComplete={(region, details) => {
          currentRegionRef.current = region
          // 사용자가 직접 움직였으면 경로 도착 후 자동 맞추기로 화면을 뺏지 않는다.
          // isGesture는 플랫폼에 따라 안 올 수 있어 명시적으로 true일 때만 해제한다.
          if (details?.isGesture === true) autoFitKeyRef.current = null
        }}
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

        {/* 검색·추천으로 찍어본 장소. 일정 순서가 없으니 카테고리 핀으로 보여준다. */}
        {previewMarker && !selectedPlaceId && (
          <MapPin
            coordinate={{ latitude: previewMarker.lat, longitude: previewMarker.lng }}
            category={categoryOf(previewMarker.types)}
            selected
            zIndex={2}
          />
        )}

        {/* places는 Day별로 걸러져 들어오므로 index + 1이 그 날의 방문 순서다 */}
        {places.map((place, index) => {
          const isSelected = selectedPlaceId === place.id
          return (
            <MapPin
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              order={index + 1}
              selected={isSelected}
              zIndex={isSelected ? 3 : 1}
              onPress={() => {
                markerPressedRef.current = true
                setTimeout(() => { markerPressedRef.current = false }, 300)
                clearPreview()
                // 빈 지도를 누른 것과 달리 핀을 콕 집었으면 그 장소를 보려는
                // 것이므로, 패널만 닫고 끝내지 않고 선택까지 진행한다.
                setShowActivities(false)
                onMarkerPress(place.id)
              }}
            />
          )
        })}
      </MapView>

      {/* 검색창 */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBox, !!errorMsg && styles.searchBoxError]}>
          <Icon name="pin" size={15} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="장소 검색"
            placeholderTextColor={COLORS.textSub}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => { setShowSuggestions(false); handleSearch() }}
          />
          {searching
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
            : !!query && (
              <TouchableOpacity
                onPress={() => { setQuery(''); setErrorMsg(''); setSuggestions([]); setShowSuggestions(false) }}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
              >
                <CloseIcon size={15} color={COLORS.textSub} />
              </TouchableOpacity>
            )
          }
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching} accessibilityRole="button">
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
                <Icon name="pin" size={13} color={COLORS.textMuted} />
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
            actionLabel="삭제"
            destructive
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
          actionLabel={`+ Day ${dayNumber} 일정 추가`}
          onAction={() => {
            if (previewRequest !== previewRequestRef.current) return
            const name = placeDetail?.name || previewMarker.name
            const address = placeDetail?.address || previewMarker.address
            const lat = previewMarker.lat
            const lng = previewMarker.lng
            clearPreview()
            onAddPlace({ lat, lng, name, address })
          }}
          onClose={clearPreview}
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
                <CloseIcon size={16} />
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
                    <Icon name="pin" size={16} color={COLORS.primary} />
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
        <TouchableOpacity
          style={act.tab}
          onPress={handleToggleActivities}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="주변 즐길거리"
          accessibilityState={{ expanded: showActivities }}
        >
          <Text style={act.tabIcon}>{showActivities ? '›' : '‹'}</Text>
          <Text style={act.tabLabel}>{'즐\n길\n거\n리'}</Text>
        </TouchableOpacity>

        <View style={act.header}>
          <View>
            <View style={act.titleRow}>
              <Icon name="pin" size={14} color={COLORS.primary} />
              <Text style={act.title}>근처 즐길거리</Text>
            </View>
            <Text style={act.subtitle}>현재 지도 위치 기준 5km</Text>
          </View>
          <TouchableOpacity onPress={() => setShowActivities(false)} style={act.closeBtn}>
            <CloseIcon size={14} />
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
  actionLabel, destructive, onAction, onClose,
}: {
  name: string
  address: string
  accentColor: string
  detail: PlaceDetail | null
  detailLoading: boolean
  actionLabel: string
  destructive?: boolean
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
        <TouchableOpacity onPress={onClose} style={sheet.closeBtn} accessibilityRole="button" accessibilityLabel="장소 정보 닫기">
          <CloseIcon size={16} color={COLORS.textSub} />
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
            <View style={[sheet.chip, { backgroundColor: detail.openNow ? COLORS.openBg : COLORS.closedBg }]}>
              <Text style={[sheet.chipText, { color: detail.openNow ? COLORS.open : COLORS.closed }]}>
                {detail.openNow ? '영업 중' : '영업 종료'}
              </Text>
            </View>
          )}
          {!!detail.todayHours && (
            <View style={sheet.chip}>
              <Icon name="clock" size={11} color={COLORS.textSub} />
              <Text style={sheet.chipText}>{detail.todayHours}</Text>
            </View>
          )}
          {stars && (
            <View style={sheet.chip}>
              <Text style={sheet.chipText}>
                <Text style={{ color: COLORS.rating }}>{detail.rating?.toFixed(1)} </Text>
                <Text style={{ color: COLORS.rating, fontSize: 11 }}>{stars}</Text>
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
              <Text style={sheet.chipText}>{detail.phone}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[sheet.actionBtn, destructive && sheet.deleteBtn]} onPress={onAction} accessibilityRole="button">
        <Text style={[sheet.actionText, destructive && sheet.deleteText]}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

const sheet = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  headerTexts: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  address: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, flexShrink: 0,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  actionBtn: {
    minHeight: 48, paddingVertical: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    backgroundColor: COLORS.mint,
  },
  actionText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  deleteBtn: { backgroundColor: COLORS.primaryLight },
  deleteText: { color: COLORS.primaryInk },
})

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchWrapper: {
    position: 'absolute', top: 14, left: 14, right: 14,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 16,
    paddingHorizontal: 8, paddingVertical: 4,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  searchBoxError: { borderColor: COLORS.primary },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text, padding: 0 },
  clearBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  searchBtn: {
    backgroundColor: COLORS.primary,
    minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  searchBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  errorText: { marginTop: 6, marginLeft: 4, fontSize: 12, color: COLORS.primaryInk, fontWeight: '500' },
  suggestionsBox: {
    marginTop: 6, backgroundColor: COLORS.card, borderRadius: 16,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
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
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 32,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 12,
  },
  resultsTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  resultsDismiss: { padding: 4 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface, gap: 12,
  },
  resultItemLast: { borderBottomWidth: 0 },
  resultIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  resultTexts: { flex: 1, gap: 2 },
  resultName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  resultAddress: { fontSize: 11, color: COLORS.textSub },
  resultArrow: { fontSize: 20, color: COLORS.textMuted, fontWeight: '300' },
  loadingMore: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, gap: 8,
  },
  loadingMoreText: { fontSize: 12, color: COLORS.textSub },

  routeBanner: {
    position: 'absolute', top: 72, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  routeBannerText: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  routeBannerFailed: { backgroundColor: COLORS.primaryLight },
  routeBannerFailedText: { fontSize: 13, color: COLORS.primaryInk, fontWeight: '600' },

})
