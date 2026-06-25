import { useRef } from 'react'
import { StyleSheet, View, Text } from 'react-native'
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

  const handlePress = async (e: MapPressEvent) => {
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
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={INITIAL_REGION}
      onPress={handlePress}
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
  )
}

const styles = StyleSheet.create({
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
})
