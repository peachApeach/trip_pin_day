import { useRef, useState } from 'react'
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard,
} from 'react-native'
import MapView, { Marker, Callout, MapPressEvent } from 'react-native-maps'
import { GOOGLE_MAPS_API_KEY, COLORS } from '../constants'
import type { Place } from '../types'

interface Props {
  places: Place[]
  selectedPlaceId: number | null
  onMapPress: (info: { lat: number; lng: number; name: string; address: string }) => void
  onMarkerPress: (id: number) => void
}

const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export default function MapScreen({ places, selectedPlaceId, onMapPress, onMarkerPress }: Props) {
  const mapRef = useRef<MapView>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    Keyboard.dismiss()
    setSearching(true)
    setNotFound(false)

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data.results?.[0]

      if (!result) {
        setNotFound(true)
        return
      }

      const lat: number = result.geometry.location.lat
      const lng: number = result.geometry.location.lng
      const name: string = result.address_components?.[0]?.long_name ?? query
      const address: string = result.formatted_address ?? ''

      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600)

      setQuery('')
    } catch {
      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  const handleMapPress = async (e: MapPressEvent) => {
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
        <View style={[styles.searchBox, notFound && styles.searchBoxError]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="장소 검색 후 엔터"
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={(text) => { setQuery(text); setNotFound(false) }}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searching
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
            : !!query && (
              <TouchableOpacity onPress={() => { setQuery(''); setNotFound(false) }} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )
          }
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            <Text style={styles.searchBtnText}>이동</Text>
          </TouchableOpacity>
        </View>
        {notFound && <Text style={styles.notFoundText}>검색 결과가 없어요</Text>}
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBoxError: {
    borderColor: '#FF6B8A',
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
    marginRight: 4,
  },
  clearText: {
    fontSize: 13,
    color: '#ccc',
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  searchBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  notFoundText: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
})
