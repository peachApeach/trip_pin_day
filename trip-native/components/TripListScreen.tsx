import { useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Modal, Alert,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { COLORS, PLACE_COLORS } from '../constants'
import { CURRENCIES } from '../utils/currency'
import CurrencyPicker from './CurrencyPicker'
import Icon, { CloseIcon } from './Icon'
import type { Trip, BudgetItem } from '../types'

interface Props {
  trips: Trip[]
  onSelect: (trip: Trip) => void
  onAdd: (title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: BudgetItem[]) => void
  onEdit: (id: number, title: string, tripStartDate: string | null, tripEndDate: string | null, budgets: BudgetItem[]) => void
  onDelete: (id: number) => void
  /** 알림 예약/취소가 진행 중인 여행 id 목록 */
  notifyBusyIds: number[]
  /** 여행 id별 예약된 알림 수 */
  notifyCounts: Record<number, number>
  onToggleNotify: (tripId: number, enabled: boolean) => void
}

const CARD_COLORS = PLACE_COLORS.map(c => c.dot)

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

export default function TripListScreen({
  trips, onSelect, onAdd, onEdit, onDelete,
  notifyBusyIds, notifyCounts, onToggleNotify,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [tripStart, setTripStart] = useState<Date | null>(null)
  const [tripEnd, setTripEnd] = useState<Date | null>(null)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [currencyPickerIndex, setCurrencyPickerIndex] = useState<number | null>(null)
  // ⋮ 를 누른 여행. 수정·삭제를 카드 밖으로 빼서 카드가 깔끔해진다.
  const [menuId, setMenuId] = useState<number | null>(null)
  const menuTrip = trips.find(t => t.id === menuId) ?? null

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
    const next = CURRENCIES.find(c => !usedCodes.has(c.code))
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
        <Text style={styles.headerTitle}>내 여행</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Icon name="plus" size={13} color={COLORS.text} />
          <Text style={styles.addBtnText}>여행 추가</Text>
        </TouchableOpacity>
      </View>

      {(adding || editingId !== null) && (
        <View style={styles.addCard}>
          <Text style={styles.addCardLabel}>{editingId !== null ? '여행 이름' : '새 여행 이름'}</Text>
          <TextInput
            style={styles.addCardInput}
            placeholder="예: 제주도 여행"
            placeholderTextColor={COLORS.textSub}
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
            const currInfo = CURRENCIES.find(c => c.code === b.currency)
            return (
              <View key={i} style={styles.budgetRow}>
                <TouchableOpacity style={styles.currencyBtn} onPress={() => setCurrencyPickerIndex(i)}>
                  <Text style={styles.currencySymbol}>{currInfo?.symbol ?? b.currency}</Text>
                  <Text style={styles.currencyCode}>{b.currency}</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="금액"
                  placeholderTextColor={COLORS.textSub}
                  keyboardType="numeric"
                  value={b.amount > 0 ? String(b.amount) : ''}
                  onChangeText={(v) => updateBudgetAmount(i, v)}
                />
                <TouchableOpacity onPress={() => removeBudgetRow(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CloseIcon size={12} />
                </TouchableOpacity>
              </View>
            )
          })}
          {budgets.length < CURRENCIES.length && (
            <TouchableOpacity style={styles.budgetAddBtn} onPress={addBudgetRow}>
              <Text style={styles.budgetAddBtnText}>+ 통화 추가</Text>
            </TouchableOpacity>
          )}

          <CurrencyPicker
            visible={currencyPickerIndex !== null}
            selected={currencyPickerIndex !== null ? budgets[currencyPickerIndex]?.currency : undefined}
            exclude={budgets.map(b => b.currency)}
            onSelect={code => currencyPickerIndex !== null && updateBudgetCurrency(currencyPickerIndex, code)}
            onClose={() => setCurrencyPickerIndex(null)}
          />

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
          <Icon name="map" size={56} color={COLORS.primaryLight} />
          <Text style={styles.emptyTitle}>여행 계획이 없어요</Text>
          <Text style={styles.emptyDesc}>위의 버튼을 눌러 첫 여행을 만들어보세요!</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setAdding(true)}>
            <Icon name="plus" size={13} color={COLORS.text} />
            <Text style={styles.emptyBtnText}>여행 추가하기</Text>
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
            const nights = calcNights(item.tripStartDate, item.tripEndDate)
            const notifyOn = item.notifyEnabled ?? false
            const notifyBusy = notifyBusyIds.includes(item.id)
            const notifyCount = notifyCounts[item.id] ?? 0
            const days = nights ? nights.split(' ').pop() : null
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelect(item)} activeOpacity={0.8}>
                {/* 썸네일 자리 — 사진이 없으므로 여행 색 + 아이콘으로 채운다 */}
                <View style={[styles.cardThumb, { backgroundColor: color + '1F' }]}>
                  <Icon name="pin" size={26} color={color} />
                </View>

                <View style={styles.cardTexts}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardDates} numberOfLines={1}>
                    {`${formatDate(item.tripStartDate)} - ${formatDate(item.tripEndDate)}`}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Icon name="pin" size={12} color={COLORS.textSub} />
                    <Text style={styles.cardMetaText}>{item.places.length}곳</Text>
                    {days && (
                      <>
                        <Icon name="calendar" size={12} color={COLORS.textSub} style={styles.metaGap} />
                        <Text style={styles.cardMetaText}>{days}</Text>
                      </>
                    )}
                    {notifyOn && notifyCount > 0 && (
                      <>
                        <Icon name="notification" size={12} color={COLORS.primary} style={styles.metaGap} />
                        <Text style={[styles.cardMetaText, { color: COLORS.primaryInk }]}>{notifyCount}</Text>
                      </>
                    )}
                  </View>
                  {item.budgets && item.budgets.length > 0 && (
                    <Text style={styles.cardBudget} numberOfLines={1}>
                      {item.budgets.map(b => {
                        const sym = CURRENCIES.find(c => c.code === b.currency)?.symbol ?? b.currency
                        return `${sym}${b.amount.toLocaleString()}`
                      }).join(' · ')}
                    </Text>
                  )}
                </View>

                <View style={styles.cardActions}>
                  {notifyBusy ? (
                    <View style={styles.cardNotify}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.cardNotify, notifyOn && styles.cardNotifyOn]}
                      onPress={() => onToggleNotify(item.id, !notifyOn)}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: notifyOn }}
                      accessibilityLabel={`${item.title} 일정 알림 ${notifyOn ? '끄기' : '켜기'}`}
                    >
                      <Icon
                        name="notification"
                        size={16}
                        color={notifyOn ? COLORS.primaryInk : COLORS.textSub}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.cardMore}
                    onPress={() => setMenuId(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} 더보기`}
                  >
                    <Icon name="more" size={16} color={COLORS.textSub} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* ⋮ 메뉴 — 수정·삭제 */}
      <Modal visible={menuTrip !== null} transparent animationType="fade" onRequestClose={() => setMenuId(null)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuId(null)}>
          <TouchableOpacity style={styles.menuSheet} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.menuTitle} numberOfLines={1}>{menuTrip?.title}</Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { if (menuTrip) openEdit(menuTrip); setMenuId(null) }}
            >
              <Icon name="edit" size={18} color={COLORS.text} />
              <Text style={styles.menuRowText}>여행 정보 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                const target = menuTrip
                setMenuId(null)
                if (!target) return
                // 되돌릴 수 없는 삭제라 한 번 더 묻는다
                Alert.alert('여행을 삭제할까요?', `"${target.title}"의 일정과 알림이 모두 지워져요.`, [
                  { text: '취소', style: 'cancel' },
                  { text: '삭제', style: 'destructive', onPress: () => onDelete(target.id) },
                ])
              }}
            >
              <Icon name="more" size={18} color={COLORS.primary} />
              <Text style={[styles.menuRowText, { color: COLORS.primaryInk }]}>여행 삭제</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 48, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24,
  },
  addBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },

  addCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16, gap: 10,
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
  dateBtnValue: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  dateBtnValueFilled: { color: COLORS.mintDark },
  dateSep: { fontSize: 16, color: COLORS.textSub },
  nightsBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 10,
  },
  nightsText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryInk },
  pickerDone: {
    alignSelf: 'flex-end', backgroundColor: COLORS.mint,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
  },
  pickerDoneText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },

  addCardButtons: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  addCardCancel: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  addCardCancelText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  addCardConfirm: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.primary },
  addCardConfirmDisabled: { backgroundColor: COLORS.border },
  addCardConfirmText: { fontSize: 13, color: COLORS.text, fontWeight: '700' },

  list: { padding: 16, gap: 12 },
  // 시안: 썸네일 + 글 + 액션을 한 줄로. 왼쪽 색 띠는 썸네일이 역할을 대신한다.
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 20, padding: 12,
    shadowColor: COLORS.text, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardThumb: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTexts: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardDates: { fontSize: 12, color: COLORS.textSub },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  cardMetaText: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  // 아이콘 묶음 사이를 띄운다 (장소 N곳 · 기간 · 알림)
  metaGap: { marginLeft: 7 },
  cardBudget: { fontSize: 11, fontWeight: '600', color: COLORS.mintDark, marginTop: 1 },
  cardActions: { alignItems: 'center' },
  cardNotify: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  cardNotifyOn: { backgroundColor: COLORS.primaryLight },
  cardMore: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },

  menuBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 18, paddingBottom: 34, paddingHorizontal: 20, gap: 4,
  },
  menuTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSub,
    marginBottom: 8, paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  menuRowText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  currencySymbol: { fontSize: 13, fontWeight: '700', color: COLORS.primaryInk },
  currencyCode: { fontSize: 11, fontWeight: '700', color: COLORS.primaryInk },
  budgetInput: {
    flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primaryLight, paddingVertical: 6,
  },
  budgetAddBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderStyle: 'dashed',
  },
  budgetAddBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, backgroundColor: COLORS.primary,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 20,
  },
  emptyBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
})
