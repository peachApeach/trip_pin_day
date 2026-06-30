import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { COLORS, PLACE_COLORS } from '../constants'
import type { Place, TravelMode, TravelSegment } from '../types'

interface Props {
  places: Place[]
  selectedPlaceId: number | null
  onSelect: (id: number) => void
  onRemove: (id: number) => void
  onUpdateDuration: (id: number, duration: number) => void
  onShowMap: () => void
  startDate: Date
  onStartDateChange: (date: Date) => void
  travelMode: TravelMode
  onTravelModeChange: (mode: TravelMode) => void
  travelSegments: (TravelSegment | null)[]
  segmentsLoading: boolean
  tripStartDate: string | null
  tripEndDate: string | null
  onTripDatesChange: (start: string | null, end: string | null) => void
}

const DURATION_OPTIONS = [
  { label: '30분', value: 30 },
  { label: '1시간', value: 60 },
  { label: '1.5시간', value: 90 },
  { label: '2시간', value: 120 },
  { label: '3시간', value: 180 },
  { label: '4시간', value: 240 },
] as const

const CARD_COLORS = PLACE_COLORS

const TRAVEL_MODES: { key: TravelMode; icon: string; label: string }[] = [
  { key: 'DRIVING', icon: '🚗', label: '자동차' },
  { key: 'TRANSIT', icon: '🚇', label: '대중교통' },
  { key: 'WALKING', icon: '🚶', label: '도보' },
  { key: 'BICYCLING', icon: '🚴', label: '자전거' },
]

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}
function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function formatDate(iso: string | null) {
  if (!iso) return '미정'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function calcNights(start: string | null, end: string | null) {
  if (!start || !end) return ''
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return diff > 0 ? `${diff}박 ${diff + 1}일` : ''
}
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}

type PickerMode = 'time' | 'tripStart' | 'tripEnd' | null

export default function PlanScreen({
  places, selectedPlaceId, onSelect, onRemove, onUpdateDuration, onShowMap,
  startDate, onStartDateChange, travelMode, onTravelModeChange,
  travelSegments, segmentsLoading,
  tripStartDate, tripEndDate, onTripDatesChange,
}: Props) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // 타임라인 계산
  let currentTime = new Date(startDate)
  const schedule = places.map((place, index) => {
    const from = new Date(currentTime)
    currentTime = addMinutes(currentTime, place.duration)
    const to = new Date(currentTime)
    const seg = travelSegments[index]
    let travelTo: { duration: number; distance: string } | null = null
    if (seg && index < places.length - 1) {
      travelTo = { duration: seg.duration, distance: seg.distance }
      currentTime = addMinutes(currentTime, seg.duration)
    }
    return { ...place, from, to, travelTo }
  })
  const endTime = new Date(currentTime)

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null)
    if (!date) return
    if (pickerMode === 'time') {
      onStartDateChange(date)
    } else if (pickerMode === 'tripStart') {
      const newEnd = tripEndDate && date > new Date(tripEndDate) ? null : tripEndDate
      onTripDatesChange(date.toISOString(), newEnd)
    } else if (pickerMode === 'tripEnd') {
      onTripDatesChange(tripStartDate, date.toISOString())
    }
  }

  const pickerValue = () => {
    if (pickerMode === 'time') return startDate
    if (pickerMode === 'tripStart') return tripStartDate ? new Date(tripStartDate) : new Date()
    return tripEndDate ? new Date(tripEndDate) : (tripStartDate ? new Date(tripStartDate) : new Date())
  }

  const nights = calcNights(tripStartDate, tripEndDate)
  const travelIcon = TRAVEL_MODES.find(m => m.key === travelMode)?.icon ?? '🚗'

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
    <View style={styles.container}>
      {/* 헤더 설정 영역 */}
      <View style={styles.header}>
        {/* 여행 날짜 */}
        <View style={styles.headerSection}>
          <Text style={styles.sectionLabel}>여행 날짜</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateBtn, tripStartDate && styles.dateBtnFilled]}
              onPress={() => setPickerMode('tripStart')}
            >
              <Text style={styles.dateBtnLabel}>출발</Text>
              <Text style={[styles.dateBtnValue, tripStartDate && styles.dateBtnValueFilled]}>
                {formatDate(tripStartDate)}
              </Text>
            </TouchableOpacity>
            <Text style={styles.dateSep}>→</Text>
            <TouchableOpacity
              style={[styles.dateBtn, tripEndDate && styles.dateBtnFilled]}
              onPress={() => setPickerMode('tripEnd')}
            >
              <Text style={styles.dateBtnLabel}>귀국</Text>
              <Text style={[styles.dateBtnValue, tripEndDate && styles.dateBtnValueFilled]}>
                {formatDate(tripEndDate)}
              </Text>
            </TouchableOpacity>
            {!!nights && (
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsText}>{nights}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 출발시간 + 이동수단 */}
        <View style={styles.headerRow}>
          <View style={styles.headerSection}>
            <Text style={styles.sectionLabel}>출발 시간</Text>
            <TouchableOpacity style={styles.timePicker} onPress={() => setPickerMode('time')}>
              <Text style={styles.timePickerText}>{formatTime(startDate)}</Text>
              <Text style={styles.timePickerIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
            <View style={styles.modeRow}>
              {TRAVEL_MODES.map(mode => (
                <TouchableOpacity
                  key={mode.key}
                  style={[styles.modeBtn, travelMode === mode.key && styles.modeBtnActive]}
                  onPress={() => onTravelModeChange(mode.key)}
                >
                  <Text style={styles.modeIcon}>{mode.icon}</Text>
                  <Text style={[styles.modeLabel, travelMode === mode.key && styles.modeLabelActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {segmentsLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>이동 시간 계산 중...</Text>
          </View>
        )}

        {/* DateTimePicker */}
        {pickerMode !== null && (
          <DateTimePicker
            value={pickerValue()}
            mode={pickerMode === 'time' ? 'time' : 'date'}
            is24Hour
            minimumDate={pickerMode === 'tripEnd' && tripStartDate ? new Date(tripStartDate) : undefined}
            display={Platform.OS === 'ios' ? (pickerMode === 'time' ? 'spinner' : 'inline') : 'default'}
            onChange={handlePickerChange}
          />
        )}
        {Platform.OS === 'ios' && pickerMode !== null && (
          <TouchableOpacity style={styles.pickerDone} onPress={() => setPickerMode(null)}>
            <Text style={styles.pickerDoneText}>확인</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 타임라인 + 장소 카드 */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {schedule.map((item, index) => {
          const color = CARD_COLORS[index % CARD_COLORS.length]
          const isExpanded = expandedId === item.id
          return (
            <View key={item.id}>
              {/* 장소 행 */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <Text style={styles.timeText}>{formatTime(item.from)}</Text>
                  <View style={[styles.timelineDot, { backgroundColor: color.dot }]} />
                  <View style={[styles.timelineLine, { backgroundColor: color.dot + '30' }]} />
                </View>

                <TouchableOpacity
                  style={[styles.placeCard, { borderLeftColor: color.dot }, isExpanded && styles.placeCardExpanded]}
                  onPress={() => { setExpandedId(isExpanded ? null : item.id); onSelect(item.id) }}
                  activeOpacity={0.85}
                >
                  <View style={styles.placeCardTop}>
                    <View style={[styles.indexBadge, { backgroundColor: color.bg }]}>
                      <Text style={[styles.indexText, { color: color.dot }]}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity style={styles.nameBtn} onPress={() => { onSelect(item.id); onShowMap() }}>
                      <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.durationChip, { color: color.dot }]}>
                      {formatDuration(item.duration)}
                    </Text>
                    <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {!!item.address && (
                    <Text style={styles.address} numberOfLines={1}>📌 {item.address}</Text>
                  )}

                  <View style={styles.placeFooter}>
                    <Text style={styles.placeTime}>{formatTime(item.from)} ~ {formatTime(item.to)}</Text>
                  </View>

                  {/* 체류시간 선택 (펼쳐졌을 때) */}
                  {isExpanded && (
                    <View style={styles.durationRow}>
                      <Text style={styles.durationLabel}>체류 시간</Text>
                      <View style={styles.durationButtons}>
                        {DURATION_OPTIONS.map(opt => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.durationBtn,
                              item.duration === opt.value && { backgroundColor: color.dot, borderColor: color.dot },
                            ]}
                            onPress={() => onUpdateDuration(item.id, opt.value)}
                          >
                            <Text style={[
                              styles.durationBtnText,
                              item.duration === opt.value && styles.durationBtnTextActive,
                            ]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* 이동 구간 */}
              {item.travelTo && (
                <View style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.travelTimeText}>{formatTime(item.to)}</Text>
                    <View style={styles.travelDot} />
                    <View style={styles.timelineLine} />
                  </View>
                  <View style={styles.travelCard}>
                    <Text style={styles.travelIcon}>{travelIcon}</Text>
                    <Text style={styles.travelDuration}>이동 {formatDuration(item.travelTo.duration)}</Text>
                    <Text style={styles.travelDistance}>{item.travelTo.distance}</Text>
                  </View>
                </View>
              )}
            </View>
          )
        })}

        {/* 종료 */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineLeft}>
            <Text style={styles.timeText}>{formatTime(endTime)}</Text>
            <View style={[styles.timelineDot, { backgroundColor: '#43A047' }]} />
          </View>
          <View style={styles.endCard}>
            <Text style={styles.endCardText}>🏁  여행 종료</Text>
            <Text style={styles.endCardSub}>{formatTime(startDate)} ~ {formatTime(endTime)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 12, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },

  header: {
    backgroundColor: 'white', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  headerSection: { gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  dateBtnFilled: { borderColor: COLORS.mint, backgroundColor: COLORS.mintLight },
  dateBtnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginBottom: 2 },
  dateBtnValue: { fontSize: 13, fontWeight: '600', color: '#bbb' },
  dateBtnValueFilled: { color: COLORS.mint },
  dateSep: { fontSize: 16, color: COLORS.textSub },
  nightsBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  nightsText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  timePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
  },
  timePickerText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  timePickerIcon: { fontSize: 11 },
  modeScroll: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FAFAFA',
  },
  modeBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  modeIcon: { fontSize: 13 },
  modeLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  modeLabelActive: { color: COLORS.primary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  pickerDone: { alignSelf: 'flex-end', backgroundColor: COLORS.mint, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10 },
  pickerDoneText: { color: 'white', fontSize: 13, fontWeight: '700' },

  list: { padding: 16, paddingBottom: 40 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 52, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  travelTimeText: { fontSize: 11, color: COLORS.textSub, marginBottom: 4 },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  travelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0D0D0' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#EBEBEB', minHeight: 20 },

  placeCard: {
    flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 8,
    borderLeftWidth: 4, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  placeCardExpanded: { shadowOpacity: 0.12, elevation: 5 },
  placeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  indexText: { fontSize: 11, fontWeight: '800' },
  nameBtn: { flex: 1 },
  nameText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  durationChip: { fontSize: 11, fontWeight: '700' },
  removeText: { fontSize: 13, color: '#D0D0D0' },
  address: { fontSize: 11, color: COLORS.textSub },
  placeFooter: { flexDirection: 'row', alignItems: 'center' },
  placeTime: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },

  durationRow: { gap: 6, paddingTop: 4 },
  durationLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  durationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  durationBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#EBEBEB', backgroundColor: '#FAFAFA',
  },
  durationBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  durationBtnTextActive: { color: 'white' },

  travelCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FAFAFA', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#EBEBEB', borderStyle: 'dashed',
  },
  travelIcon: { fontSize: 14 },
  travelDuration: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  travelDistance: { fontSize: 11, color: '#BDBDBD', marginLeft: 'auto' },

  endCard: {
    flex: 1, backgroundColor: '#E8F5E9', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#C8E6C9', gap: 2,
  },
  endCardText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  endCardSub: { fontSize: 11, color: '#66BB6A' },
})
