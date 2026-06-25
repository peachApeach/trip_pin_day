import { useRef, useState, useCallback } from 'react'
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Keyboard,
} from 'react-native'
import MapView, { Marker, Callout, MapPressEvent, Region } from 'react-native-maps'
import { GOOGLE_MAPS_API_KEY, COLORS } from '../constants'
import type { Place } from '../types'

interface Props {
  places: Place[]
  selectedPlaceId: number | null
  onMapPress: (info: { lat: number; lng: number; name: string; address: string }) => void
  onMarkerPress: (id: number) => void
}

interface Prediction {
  place_id: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export default function MapScreen({ places, selectedPlaceId, onMapPress, onMarkerPress }: Props) {
  const mapRef = useRef<MapView>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [searching, setSearching] = useState(false)

  const fetchPredictions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) {
      setPredictions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        setPredictions(data.predictions ?? [])
      } catch {
        setPredictions([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [])

  const handleSelectPlace = async (prediction: Prediction) => {
    Keyboard.dismiss()
    setQuery(prediction.structured_formatting.main_text)
    setPredictions([])

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,name,formatted_address&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data.result
      const lat: number = result.geometry.location.lat
      const lng: number = result.geometry.location.lng
      const name: string = result.name ?? prediction.structured_formatting.main_text
      const address: string = result.formatted_address ?? prediction.structured_formatting.secondary_text

      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500)

      onMapPress({ lat, lng, name, address })
      setQuery('')
    } catch {
      setPredictions([])
    }
  }

  const handleMapPress = async (e: MapPressEvent) => {
    if (predictions.length > 0) {
      setPredictions([])
      return
    }
    const { latitude, longitude } = e.nativeEvent.coordinate
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data?.results?.[0]
      const name: string = result?.address_components?.[0]?.long_name ?? '선택한 장소'
      const address: string = result?.formatted_address ?? ''
      onMapPress({ lat: latitude, lng: longitude, name, address })
    } catch {
      onMapPress({ lat: latitude, lng: longitude, name: '선택한 장소', address: '' })
    }
  }

  const clearSearch = () => {
    setQuery('')
    setPredictions([])
    Keyboard.dismiss()
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
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
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="장소 검색"
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={(text) => {
              setQuery(text)
              fetchPredictions(text)
            }}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />}
          {!!query && !searching && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {predictions.length > 0 && (
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            style={styles.predictionList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.predictionItem, index === predictions.length - 1 && styles.predictionItemLast]}
                onPress={() => handleSelectPlace(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.predictionIcon}>📍</Text>
                <View style={styles.predictionTexts}>
                  <Text style={styles.predictionMain} numberOfLines={1}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={styles.predictionSub} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    backgroundColor: COLORS.mint,
    transform: [{ scale: 1.25 }],
    shadowColor: COLORS.mint,
  },
  markerText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  callout: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  calloutText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchWrapper: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  clearText: {
    fontSize: 13,
    color: '#ccc',
  },
  predictionList: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginTop: 6,
    maxHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 10,
  },
  predictionItemLast: {
    borderBottomWidth: 0,
  },
  predictionIcon: {
    fontSize: 14,
  },
  predictionTexts: {
    flex: 1,
    gap: 2,
  },
  predictionMain: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  predictionSub: {
    fontSize: 11,
    color: COLORS.textSub,
  },
})
