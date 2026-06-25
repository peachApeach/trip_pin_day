import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ListRenderItemInfo,
} from 'react-native'
import { COLORS } from '../constants'
import type { Place } from '../types'

interface PlaceItemProps {
  place: Place
  index: number
  isSelected: boolean
  onSelect: (id: number) => void
  onRemove: (id: number) => void
  onUpdateName: (id: number, name: string) => void
  onUpdateDuration: (id: number, duration: number) => void
}

interface PlaceListProps {
  places: Place[]
  selectedPlaceId: number | null
  onSelect: (id: number) => void
  onRemove: (id: number) => void
  onUpdateName: (id: number, name: string) => void
  onUpdateDuration: (id: number, duration: number) => void
  onShowMap: () => void
}

const DURATION_OPTIONS = [
  { label: '30분', value: 30 },
  { label: '1시간', value: 60 },
  { label: '1.5시간', value: 90 },
  { label: '2시간', value: 120 },
  { label: '3시간', value: 180 },
  { label: '4시간', value: 240 },
] as const

const CARD_COLORS = [
  { bg: '#FFE8EE', dot: COLORS.primary },
  { bg: '#E0F7F5', dot: COLORS.mint },
  { bg: '#FFF8E1', dot: '#FFB300' },
  { bg: '#EDE7F6', dot: '#7C4DFF' },
  { bg: '#E8F5E9', dot: '#43A047' },
]

function PlaceItem({ place, index, isSelected, onSelect, onRemove, onUpdateName, onUpdateDuration }: PlaceItemProps) {
  const color = CARD_COLORS[index % CARD_COLORS.length]

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={() => onSelect(place.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.colorBar, { backgroundColor: color.dot }]} />
      <View style={styles.itemInner}>
        <View style={styles.itemTop}>
          <View style={[styles.orderBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.orderText, { color: color.dot }]}>{index + 1}</Text>
          </View>
          <TextInput
            style={styles.nameInput}
            value={place.name}
            onChangeText={(text) => onUpdateName(place.id, text)}
            placeholder="장소 이름"
            placeholderTextColor="#ccc"
          />
          <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(place.id)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {!!place.address && (
          <Text style={styles.address} numberOfLines={1}>📌 {place.address}</Text>
        )}

        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>체류 시간</Text>
          <View style={styles.durationButtons}>
            {DURATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.durationBtn,
                  place.duration === opt.value && { backgroundColor: color.dot, borderColor: color.dot },
                ]}
                onPress={() => onUpdateDuration(place.id, opt.value)}
              >
                <Text style={[
                  styles.durationBtnText,
                  place.duration === opt.value && styles.durationBtnTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function PlaceList({
  places, selectedPlaceId, onSelect, onRemove,
  onUpdateName, onUpdateDuration, onShowMap,
}: PlaceListProps) {
  if (places.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>아직 장소가 없어요</Text>
        <Text style={styles.emptyDesc}>지도를 탭해서 가고 싶은 곳을 추가해보세요</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onShowMap}>
          <Text style={styles.emptyBtnText}>지도 보러 가기</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <FlatList
      data={places}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }: ListRenderItemInfo<Place>) => (
        <PlaceItem
          place={item}
          index={index}
          isSelected={selectedPlaceId === item.id}
          onSelect={onSelect}
          onRemove={onRemove}
          onUpdateName={onUpdateName}
          onUpdateDuration={onUpdateDuration}
        />
      )}
    />
  )
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  item: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  itemSelected: { shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  colorBar: { width: 5 },
  itemInner: { flex: 1, padding: 14, gap: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderBadge: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  orderText: { fontSize: 12, fontWeight: '800' },
  nameInput: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text, padding: 0 },
  removeBtn: { padding: 4 },
  removeText: { fontSize: 13, color: '#D0D0D0' },
  address: { fontSize: 11, color: COLORS.textSub },
  durationRow: { gap: 6 },
  durationLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  durationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  durationBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#EBEBEB', backgroundColor: '#FAFAFA',
  },
  durationBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  durationBtnTextActive: { color: 'white' },
})
