import { useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { COLORS, G20_CURRENCIES } from '../constants'
import type { Trip, BudgetItem } from '../types'

interface Props {
  trips: Trip[]
  onSelect: (trip: Trip) => void
  onAdd: (title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: BudgetItem[]) => void
  onEdit: (id: number, title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: BudgetItem[]) => void
  onDelete: (id: number) => void
}

const CARD_COLORS = [COLORS.primary, COLORS.mint, '#FFB300', '#7C4DFF', '#43A047']
const TRIP_EMOJIS = ['✈️', '🗺️', '🏖️', '🏔️', '🌏', '🚂', '🚗', '⛵']

function formatDate(iso: string | null): string {
  if (!iso) return '미정'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function calcNights(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  if (diff === 0) return '당일치기'
  if (diff < 0) return ''
  return `${diff}박 ${diff + 1}일`
}

type PickerTarget = 'start' | 'end' | null

export default function TripListScreen({ trips, onSelect, onAdd, onEdit, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [tripStart, setTripStart] = useState<Date | null>(null)
  const [tripEnd, setTripEnd] = useState<Date | null>(null)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [currencyPickerIndex, setCurrencyPickerIndex] = useState<number | null>(null)

  const openEdit = (trip: Trip) => {
    setEditingId(trip.id)
    setTitle(trip.title)
    setTripStart(trip.tripStartDate ? new Date(trip.tripStartDate) : null)
    setTripEnd(trip.tripEndDate ? new Date(trip.tripEndDate) : null)
    setBudgets(trip.budgets ? [...trip.budgets] : [])
    setAdding(false)
  }

  const handleAdd = () => {
    const trimmed = title.trim()
    if (!trimmed || !tripStart || !tripEnd) return
    const validBudgets = budgets.filter(b => b.amount > 0)
    if (editingId !== null) {
      onEdit(editingId, trimmed, tripStart.toISOString(), tripEnd.toISOString(), validBudgets)
    } else {
      onAdd(trimmed, tripStart.toISOString(), tripEnd.toISOString(), validBudgets)
    }
    setTitle('')
    setTripStart(null)
    setTripEnd(null)
    setBudgets([])
    setAdding(false)
    setEditingId(null)
  }

  const handleCancel = () => {
    setAdding(false)
    setEditingId(null)
    setTitle('')
    setTripStart(null)
    setTripEnd(null)
    setPickerTarget(null)
    setBudgets([])
  }

  const addBudgetRow = () => {
    const usedCodes = new Set(budgets.map(b => b.currency))
    const next = G20_CURRENCIES.find(c => !usedCodes.has(c.code))
    if (!next) return
    setBudgets(prev => [...prev, { currency: next.code, amount: 0 }])
  }

  const updateBudgetAmount = (index: number, value: string) => {
    const num = parseFloat(value.replace(/[^0-9.]/g, '')) || 0
    setBudgets(prev => prev.map((b, i) => i === index ? { ...b, amount: num } : b))
  }

  const updateBudgetCurrency = (index: number, code: string) => {
    setBudgets(prev => prev.map((b, i) => i === index ? { ...b, currency: code } : b))
    setCurrencyPickerIndex(null)
  }

  const removeBudgetRow = (index: number) => {
    setBudgets(prev => prev.filter((_, i) => i !== index))
  }

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null)
    if (!date) return
    if (pickerTarget === 'start') {
      setTripStart(date)
      if (tripEnd && date > tripEnd) setTripEnd(null)
    } else if (pickerTarget === 'end') {
      setTripEnd(date)
    }
  }

  const minEndDate = tripStart ?? new Date()

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>내 여행 목록</Text>
          <Text style={styles.headerTitle}>☁️ 구르미</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addBtnText}>+ 여행 추가</Text>
        </TouchableOpacity>
      </View>

      {(adding || editingId !== null) && (
        <View style={styles.addCard}>
          <Text style={styles.addCardLabel}>{editingId !== null ? '여행 이름' : '새 여행 이름'}</Text>
          <TextInput
            style={styles.addCardInput}
            placeholder="예: 제주도 여행"
            placeholderTextColor="#bbb"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
          />

          <Text style={[styles.addCardLabel, { marginTop: 4 }]}>여행 날짜</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateBtn, tripStart && styles.dateBtnFilled]}
              onPress={() => setPickerTarget('start')}
            >
              <Text style={styles.dateBtnLabel}>출발</Text>
              <Text style={[styles.dateBtnValue, tripStart && styles.dateBtnValueFilled]}>
                {tripStart ? formatDate(tripStart.toISOString()) : '날짜 선택'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.dateSep}>→</Text>

            <TouchableOpacity
              style={[styles.dateBtn, tripEnd && styles.dateBtnFilled]}
              onPress={() => setPickerTarget('end')}
            >
              <Text style={styles.dateBtnLabel}>귀국</Text>
              <Text style={[styles.dateBtnValue, tripEnd && styles.dateBtnValueFilled]}>
                {tripEnd ? formatDate(tripEnd.toISOString()) : '날짜 선택'}
              </Text>
            </TouchableOpacity>

            {tripStart && tripEnd && (
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsText}>{calcNights(tripStart.toISOString(), tripEnd.toISOString())}</Text>
              </View>
            )}
          </View>

          {pickerTarget !== null && (
            <DateTimePicker
              value={pickerTarget === 'end' ? (tripEnd ?? minEndDate) : (tripStart ?? new Date())}
              mode="date"
              minimumDate={pickerTarget === 'end' ? minEndDate : undefined}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handlePickerChange}
            />
          )}
          {Platform.OS === 'ios' && pickerTarget !== null && (
            <TouchableOpacity style={styles.pickerDone} onPress={() => setPickerTarget(null)}>
              <Text style={styles.pickerDoneText}>확인</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.addCardLabel, { marginTop: 4 }]}>총 예산</Text>
          {budgets.map((b, i) => {
            const currInfo = G20_CURRENCIES.find(c => c.code === b.currency)
            return (
              <View key={i} style={styles.budgetRow}>
                <TouchableOpacity style={styles.currencyBtn} onPress={() => setCurrencyPickerIndex(i)}>
                  <Text style={styles.currencySymbol}>{currInfo?.symbol ?? b.currency}</Text>
                  <Text style={styles.currencyCode}>{b.currency}</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="금액"
                  placeholderTextColor="#bbb"
                  keyboardType="numeric"
                  value={b.amount > 0 ? String(b.amount) : ''}
                  onChangeText={(v) => updateBudgetAmount(i, v)}
                />
                <TouchableOpacity onPress={() => removeBudgetRow(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.budgetRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            )
          })}
          {budgets.length < G20_CURRENCIES.length && (
            <TouchableOpacity style={styles.budgetAddBtn} onPress={addBudgetRow}>
              <Text style={styles.budgetAddBtnText}>+ 통화 추가</Text>
            </TouchableOpacity>
          )}

          <Modal visible={currencyPickerIndex !== null} transparent animationType="fade" onRequestClose={() => setCurrencyPickerIndex(null)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCurrencyPickerIndex(null)}>
              <View style={styles.currencyList}>
                <Text style={styles.currencyListTitle}>통화 선택</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {G20_CURRENCIES.filter(c => c.code === budgets[currencyPickerIndex!]?.currency || !budgets.some(b => b.currency === c.code)).map(c => (
                    <TouchableOpacity
                      key={c.code}
                      style={[styles.currencyItem, budgets[currencyPickerIndex!]?.currency === c.code && styles.currencyItemActive]}
                      onPress={() => currencyPickerIndex !== null && updateBudgetCurrency(currencyPickerIndex, c.code)}
                    >
                      <Text style={styles.currencyItemSymbol}>{c.symbol}</Text>
                      <Text style={styles.currencyItemCode}>{c.code}</Text>
                      <Text style={styles.currencyItemLabel}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.addCardButtons}>
            <TouchableOpacity style={styles.addCardCancel} onPress={handleCancel}>
              <Text style={styles.addCardCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addCardConfirm, (!title.trim() || !tripStart || !tripEnd) && styles.addCardConfirmDisabled]}
              onPress={handleAdd}
              disabled={!title.trim() || !tripStart || !tripEnd}
            >
              <Text style={styles.addCardConfirmText}>{editingId !== null ? '저장' : '만들기'}</Text>
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
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const color = CARD_COLORS[index % CARD_COLORS.length]
            const emoji = TRIP_EMOJIS[index % TRIP_EMOJIS.length]
            const nights = calcNights(item.tripStartDate, item.tripEndDate)
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelect(item)} activeOpacity={0.8}>
                <View style={[styles.cardAccent, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIconWrap, { backgroundColor: color + '20' }]}>
                      <Text style={styles.cardIcon}>{emoji}</Text>
                    </View>
                    <View style={styles.cardTexts}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cardMeta}>
                        {`${formatDate(item.tripStartDate)} ~ ${formatDate(item.tripEndDate)}${nights ? `  ${nights}` : ''}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cardEdit}
                      onPress={() => openEdit(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.cardEditText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cardDelete}
                      onPress={() => onDelete(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.cardDeleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardBottomRow}>
                    {item.tripStartDate && item.places.length > 0 && (
                      <Text style={[styles.cardMetaBottom, { color }]}>장소 {item.places.length}곳</Text>
                    )}
                    {item.budgets && item.budgets.length > 0 && (
                      <Text style={styles.cardBudget} numberOfLines={1}>
                        {item.budgets.map(b => {
                          const sym = G20_CURRENCIES.find(c => c.code === b.currency)?.symbol ?? b.currency
                          return `${sym}${b.amount.toLocaleString()}`
                        }).join(' · ')}
                      </Text>
                    )}
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
  },
  headerSub: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', letterSpacing: 0.5 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  addCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'white', borderRadius: 20, padding: 16, gap: 10,
    borderWidth: 1.5, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  addCardLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  addCardInput: {
    fontSize: 15, fontWeight: '600', color: COLORS.text,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primaryLight, paddingVertical: 6,
  },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
  },
  dateBtnFilled: { borderColor: COLORS.mint, backgroundColor: COLORS.mintLight },
  dateBtnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginBottom: 2 },
  dateBtnValue: { fontSize: 13, fontWeight: '600', color: '#bbb' },
  dateBtnValueFilled: { color: COLORS.mint },
  dateSep: { fontSize: 16, color: COLORS.textSub },
  nightsBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 10,
  },
  nightsText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  pickerDone: {
    alignSelf: 'flex-end', backgroundColor: COLORS.mint,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
  },
  pickerDoneText: { color: 'white', fontSize: 13, fontWeight: '700' },

  addCardButtons: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  addCardCancel: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  addCardCancelText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  addCardConfirm: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.primary },
  addCardConfirmDisabled: { backgroundColor: '#F0C0CC' },
  addCardConfirmText: { fontSize: 13, color: 'white', fontWeight: '700' },

  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 16, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cardIcon: { fontSize: 22 },
  cardTexts: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 56 },
  cardMetaBottom: { fontSize: 11, fontWeight: '600' },
  cardBudget: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  cardEdit: { padding: 4 },
  cardEditText: { fontSize: 16 },
  cardDelete: { padding: 4 },
  cardDeleteText: { fontSize: 18 },

  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  currencySymbol: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  currencyCode: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  budgetInput: {
    flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primaryLight, paddingVertical: 6,
  },
  budgetRemove: { fontSize: 14, color: COLORS.textSub, paddingHorizontal: 4 },
  budgetAddBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderStyle: 'dashed',
  },
  budgetAddBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  currencyList: {
    backgroundColor: 'white', borderRadius: 20, padding: 16,
    width: 280, maxHeight: 400,
  },
  currencyListTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  currencyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
  },
  currencyItemActive: { backgroundColor: COLORS.primaryLight },
  currencyItemSymbol: { fontSize: 16, width: 24, textAlign: 'center', fontWeight: '700', color: COLORS.primary },
  currencyItemCode: { fontSize: 13, fontWeight: '700', color: COLORS.text, width: 40 },
  currencyItemLabel: { fontSize: 12, color: COLORS.textSub, flex: 1 },

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
