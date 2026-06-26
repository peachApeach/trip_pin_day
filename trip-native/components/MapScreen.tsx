import { useRef, useState } from 'react'
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, FlatList,
} from 'react-native'
import MapView, { Marker, Callout, MapPressEvent, PoiClickEvent, Region } from 'react-native-maps'
import { GOOGLE_MAPS_API_KEY, COLORS } from '../constants'
import type { Place } from '../types'

interface Props {
  places: Place[]
  selectedPlaceId: number | null
  onMapPress: (info: { lat: number; lng: number; name: string; address: string }) => void
  onMarkerPress: (id: number) => void
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

export default function MapScreen({ places, selectedPlaceId, onMapPress, onMarkerPress }: Props) {
  const mapRef = useRef<MapView>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previewMarker, setPreviewMarker] = useState<SearchResult | null>(null)

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
    setSearching(true)
    setErrorMsg('')
    setResults([])
    setNextPageToken(null)

    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query.trim())}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
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
    setPreviewMarker(result)
    mapRef.current?.animateToRegion(
      { latitude: result.lat, longitude: result.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    )
  }

  const handlePoiClick = (e: PoiClickEvent) => {
    if (showModal) return
    const { coordinate, name } = e.nativeEvent
    setPreviewMarker({ lat: coordinate.latitude, lng: coordinate.longitude, name, address: '' })
  }

  const handleMapPress = async (e: MapPressEvent) => {
    if (showModal) return
    const { latitude, longitude } = e.nativeEvent.coordinate
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data?.results?.[0]
      const name: string = result?.address_components?.[0]?.long_name ?? '선택한 장소'
      const address: string = result?.formatted_address ?? ''
      setPreviewMarker({ lat: latitude, lng: longitude, name, address })
    } catch {
      setPreviewMarker({ lat: latitude, lng: longitude, name: '선택한 장소', address: '' })
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        showsUserLocation
        showsMyLocationButton
      >
        {previewMarker && (
          <Marker
            coordinate={{ latitude: previewMarker.lat, longitude: previewMarker.lng }}
            pinColor={COLORS.mint}
          />
        )}

        {places.map((place, index) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            onPress={() => onMarkerPress(place.id)}
          >
            <View style={[styles.marker, selectedPlaceId === place.id && styles.markerSelected]}>
              <Text style={styles.markerText}>{index + 1}</Text>
            </View>
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutText}>{place.name}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
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
            onChangeText={(text) => { setQuery(text); setErrorMsg('') }}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searching
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
            : !!query && (
              <TouchableOpacity onPress={() => { setQuery(''); setErrorMsg('') }} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )
          }
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>
        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>

      {/* preview 장소 정보 카드 */}
      {previewMarker && (
        <View style={styles.previewCard}>
          <View style={styles.previewCardInner}>
            <View style={styles.previewCardDot} />
            <View style={styles.previewCardTexts}>
              <Text style={styles.previewCardName} numberOfLines={1}>{previewMarker.name}</Text>
              {!!previewMarker.address && (
                <Text style={styles.previewCardAddr} numberOfLines={1}>{previewMarker.address}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.previewCardAddBtn}
              onPress={() => {
                onMapPress({ lat: previewMarker.lat, lng: previewMarker.lng, name: previewMarker.name, address: previewMarker.address })
                setPreviewMarker(null)
              }}
            >
              <Text style={styles.previewCardAddText}>+ 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPreviewMarker(null)} style={styles.previewCardClose}>
              <Text style={styles.previewCardCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  marker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'white',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },
  markerSelected: {
    backgroundColor: COLORS.mint,
    transform: [{ scale: 1.25 }],
    shadowColor: COLORS.mint,
  },
  markerText: { color: 'white', fontSize: 13, fontWeight: '800' },
  callout: { paddingHorizontal: 10, paddingVertical: 4 },
  calloutText: { fontSize: 13, fontWeight: '600', color: COLORS.text },

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

  previewCard: {
    position: 'absolute',
    bottom: 68, left: 14, right: 14,
  },
  previewCardInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.mint,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    gap: 10,
  },
  previewCardDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.mint, flexShrink: 0,
  },
  previewCardTexts: { flex: 1 },
  previewCardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  previewCardAddr: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  previewCardAddBtn: {
    backgroundColor: COLORS.mint,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  previewCardAddText: { color: 'white', fontSize: 12, fontWeight: '700' },
  previewCardClose: { padding: 4 },
  previewCardCloseText: { fontSize: 13, color: '#ccc' },
})
