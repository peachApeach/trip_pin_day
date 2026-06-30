import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { COLORS } from '../constants'
import type { Place, TravelMode, TravelSegment } from '../types'

interface ScheduledPlace extends Place {
  from: Date
  to: Date
  travelTo: { duration: number; distance: string } | null
}

interface Props {
  places: Place[]
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

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '미정'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function calcNights(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  if (diff <= 0) return ''
  return `${diff}박 ${diff + 1}일`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}

const TRAVEL_MODES: { key: TravelMode; icon: string; label: string }[] = [
  { key: 'DRIVING', icon: '🚗', label: '자동차' },
  { key: 'TRANSIT', icon: '🚇', label: '대중교통' },
  { key: 'WALKING', icon: '🚶', label: '도보' },
  { key: 'BICYCLING', icon: '🚴', label: '자전거' },
]

const CARD_COLORS = [COLORS.primary, COLORS.mint, '#FFB300', '#7C4DFF', '#43A047']

type PickerMode = 'time' | 'tripStart' | 'tripEnd' | null

export default function Timetable({
  places, startDate, onStartDateChange,
  travelMode, onTravelModeChange,
  travelSegments, segmentsLoading,
  tripStartDate, tripEndDate, onTripDatesChange,
}: Props) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)

  let currentTime = new Date(startDate)
  const schedule: ScheduledPlace[] = places.map((place, index) => {
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
      const newStart = date.toISOString()
      const newEnd = tripEndDate && date > new Date(tripEndDate) ? null : tripEndDate
      onTripDatesChange(newStart, newEnd)
    } else if (pickerMode === 'tripEnd') {
      onTripDatesChange(tripStartDate, date.toISOString())
    }
  }

  const pickerValue = () => {
    if (pickerMode === 'time') return startDate
    if (pickerMode === 'tripStart') return tripStartDate ? new Date(tripStartDate) : new Date()
    if (pickerMode === 'tripEnd') return tripEndDate ? new Date(tripEndDate) : (tripStartDate ? new Date(tripStartDate) : new Date())
    return new Date()
  }

  const nights = calcNights(tripStartDate, tripEndDate)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* 여행 날짜 */}
        <View style={styles.tripDateRow}>
          <Text style={styles.sectionLabel}>여행 날짜</Text>
          <View style={styles.tripDateBtns}>
            <TouchableOpacity
              style={[styles.tripDateBtn, tripStartDate && styles.tripDateBtnFilled]}
              onPress={() => setPickerMode('tripStart')}
            >
              <Text style={styles.tripDateBtnLabel}>출발</Text>
              <Text style={[styles.tripDateBtnValue, tripStartDate && styles.tripDateBtnValueFilled]}>
                {formatDate(tripStartDate)}
              </Text>
            </TouchableOpacity>
            <Text style={styles.dateSep}>→</Text>
            <TouchableOpacity
              style={[styles.tripDateBtn, tripEndDate && styles.tripDateBtnFilled]}
              onPress={() => setPickerMode('tripEnd')}
            >
              <Text style={styles.tripDateBtnLabel}>귀국</Text>
              <Text style={[styles.tripDateBtnValue, tripEndDate && styles.tripDateBtnValueFilled]}>
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

        {/* 출발 시간 + 장소 수 */}
        <View style={styles.headerRow}>
          <View style={styles.startBlock}>
            <Text style={styles.sectionLabel}>출발 시간</Text>
            <TouchableOpacity style={styles.timePicker} onPress={() => setPickerMode('time')}>
              <Text style={styles.timePickerText}>{formatTime(startDate)}</Text>
              <Text style={styles.timePickerIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
          {places.length > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>총 장소</Text>
              <Text style={styles.summaryValue}>{places.length}곳</Text>
            </View>
          )}
        </View>

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

        {/* 이동 수단 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.modeRow}>
            {TRAVEL_MODES.map((mode) => (
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

        {segmentsLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>이동 시간 계산 중...</Text>
          </View>
        )}
      </View>

      {places.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🕐</Text>
          <Text style={styles.emptyTitle}>아직 일정이 없어요</Text>
          <Text style={styles.emptyDesc}>장소 탭에서 장소를 추가하면{'\n'}자동으로 일정이 만들어져요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {schedule.map((item, index) => {
            const dotColor = CARD_COLORS[index % CARD_COLORS.length]
            const travelIcon = TRAVEL_MODES.find((m) => m.key === travelMode)?.icon ?? '🚗'
            return (
              <View key={item.id}>
                <View style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timeText}>{formatTime(item.from)}</Text>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                    <View style={[styles.timelineLine, item.travelTo != null && { backgroundColor: dotColor + '40' }]} />
                  </View>
                  <View style={[styles.placeCard, { borderLeftColor: dotColor }]}>
                    <View style={styles.placeCardTop}>
                      <View style={[styles.indexBadge, { backgroundColor: dotColor + '20' }]}>
                        <Text style={[styles.indexText, { color: dotColor }]}>{index + 1}</Text>
                      </View>
                      <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    {!!item.address && (
                      <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
                    )}
                    <View style={styles.placeFooter}>
                      <Text style={styles.placeTime}>{formatTime(item.from)} ~ {formatTime(item.to)}</Text>
                      <View style={[styles.durationTag, { backgroundColor: dotColor + '18' }]}>
                        <Text style={[styles.durationTagText, { color: dotColor }]}>{formatDuration(item.duration)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {item.travelTo != null && (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <Text style={styles.travelTimeText}>{formatTime(item.to)}</Text>
                      <View style={styles.travelDot} />
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.travelCard}>
                      <Text style={styles.travelCardIcon}>{travelIcon}</Text>
                      <Text style={styles.travelCardDuration}>이동 {formatDuration(item.travelTo.duration)}</Text>
                      <Text style={styles.travelCardDistance}>{item.travelTo.distance}</Text>
                    </View>
                  </View>
                )}
              </View>
            )
          })}

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
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: COLORS.textSub,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  tripDateRow: { gap: 4 },
  tripDateBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripDateBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
  },
  tripDateBtnFilled: { borderColor: COLORS.mint, backgroundColor: COLORS.mintLight },
  tripDateBtnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginBottom: 2 },
  tripDateBtnValue: { fontSize: 13, fontWeight: '600', color: '#bbb' },
  tripDateBtnValueFilled: { color: COLORS.mint },
  dateSep: { fontSize: 16, color: COLORS.textSub },
  nightsBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  nightsText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  pickerDone: {
    alignSelf: 'flex-end', backgroundColor: COLORS.mint,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
  },
  pickerDoneText: { color: 'white', fontSize: 13, fontWeight: '700' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startBlock: { gap: 4 },
  timePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  timePickerText: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  timePickerIcon: { fontSize: 12 },
  summaryBlock: {
    alignItems: 'center', backgroundColor: COLORS.mintLight,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
  },
  summaryLabel: { fontSize: 10, color: COLORS.mint, fontWeight: '600' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.mint },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FAFAFA',
  },
  modeBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  modeIcon: { fontSize: 14 },
  modeLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  modeLabelActive: { color: COLORS.primary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadingText: { fontSize: 12, color: COLORS.textSub },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16, paddingBottom: 40 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 56, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  travelTimeText: { fontSize: 11, color: COLORS.textSub, marginBottom: 4 },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  travelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0D0D0' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#EBEBEB', minHeight: 20 },
  placeCard: {
    flex: 1, backgroundColor: 'white', borderRadius: 16,
    padding: 14, marginBottom: 8, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 6,
  },
  placeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  indexText: { fontSize: 11, fontWeight: '800' },
  placeName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  placeAddress: { fontSize: 11, color: COLORS.textSub },
  placeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeTime: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },
  durationTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  durationTagText: { fontSize: 11, fontWeight: '700' },
  travelCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FAFAFA', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#EBEBEB', borderStyle: 'dashed',
  },
  travelCardIcon: { fontSize: 14 },
  travelCardDuration: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  travelCardDistance: { fontSize: 11, color: '#BDBDBD', marginLeft: 'auto' },
  endCard: {
    flex: 1, backgroundColor: '#E8F5E9', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#C8E6C9', gap: 2,
  },
  endCardText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  endCardSub: { fontSize: 11, color: '#66BB6A' },
})
