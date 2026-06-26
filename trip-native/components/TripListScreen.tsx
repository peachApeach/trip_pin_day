import { useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { COLORS } from '../constants'
import type { Trip } from '../types'

interface Props {
  trips: Trip[]
  onSelect: (trip: Trip) => void
  onAdd: (title: string) => void
  onDelete: (id: number) => void
}

const CARD_COLORS = [
  COLORS.primary,
  COLORS.mint,
  '#FFB300',
  '#7C4DFF',
  '#43A047',
]

const TRIP_EMOJIS = ['✈️', '🗺️', '🏖️', '🏔️', '🌏', '🚂', '🚗', '⛵']

export default function TripListScreen({ trips, onSelect, onAdd, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const handleAdd = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
    setAdding(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>내 여행 목록</Text>
          <Text style={styles.headerTitle}>📍 핀데이</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addBtnText}>+ 여행 추가</Text>
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={styles.addCard}>
          <Text style={styles.addCardLabel}>새 여행 이름</Text>
          <TextInput
            style={styles.addCardInput}
            placeholder="예: 제주도 2박 3일"
            placeholderTextColor="#bbb"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <View style={styles.addCardButtons}>
            <TouchableOpacity
              style={styles.addCardCancel}
              onPress={() => { setAdding(false); setTitle('') }}
            >
              <Text style={styles.addCardCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addCardConfirm, !title.trim() && styles.addCardConfirmDisabled]}
              onPress={handleAdd}
              disabled={!title.trim()}
            >
              <Text style={styles.addCardConfirmText}>만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {trips.length === 0 && !adding ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>여행 계획이 없어요</Text>
          <Text style={styles.emptyDesc}>위의 버튼을 눌러 첫 여행을 만들어보세요!</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setAdding(true)}>
            <Text style={styles.emptyBtnText}>+ 여행 추가하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const color = CARD_COLORS[index % CARD_COLORS.length]
            const emoji = TRIP_EMOJIS[index % TRIP_EMOJIS.length]
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelect(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.cardAccent, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIconWrap, { backgroundColor: color + '20' }]}>
                      <Text style={styles.cardIcon}>{emoji}</Text>
                    </View>
                    <View style={styles.cardTexts}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cardMeta}>
                        {item.places.length > 0
                          ? `장소 ${item.places.length}곳`
                          : '장소 없음'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cardDelete}
                      onPress={() => onDelete(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.cardDeleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    backgroundColor: COLORS.bg,
  },
  headerSub: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', letterSpacing: 0.5 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  addCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'white', borderRadius: 20,
    padding: 16, gap: 12,
    borderWidth: 1.5, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  addCardLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  addCardInput: {
    fontSize: 15, fontWeight: '600', color: COLORS.text,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primaryLight,
    paddingVertical: 6,
  },
  addCardButtons: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  addCardCancel: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  addCardCancelText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  addCardConfirm: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  addCardConfirmDisabled: { backgroundColor: '#F0C0CC' },
  addCardConfirmText: { fontSize: 13, color: 'white', fontWeight: '700' },

  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  cardIcon: { fontSize: 22 },
  cardTexts: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  cardDelete: { padding: 4 },
  cardDeleteText: { fontSize: 18 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: COLORS.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20,
  },
  emptyBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
})
