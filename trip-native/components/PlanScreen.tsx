import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Linking, PanResponder,
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
  onUpdateBudget: (id: number, budget: number | undefined) => void
  onUpdateDayIndex: (id: number, dayIndex: number) => void
  onReorder: (reordered: Place[]) => void
  onSegmentModeChange: (segIdx: number, mode: TravelMode) => void
  onSegmentDurationChange: (segIdx: number, duration: number | null) => void
  onSegmentPress: (from: Place, to: Place, mode: TravelMode) => void
  prevDayLastPlace: Place | null
  onShowMap: () => void
  onFocusPlace: (id: number) => void
  startDate: Date
  onStartDateChange: (date: Date) => void
  travelMode: TravelMode
  travelSegments: (TravelSegment | null)[]
  segmentsLoading: boolean
  segmentModes: (TravelMode | null)[]
  segmentDurations: (number | null)[]
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
  { key: 'OTHER', icon: '✏️', label: '기타' },
]

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}
function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}



// 제휴 링크 — 실제 파트너스 가입 후 af_id/utm 파라미터 교체
function getKlookUrl(placeName: string) {
  const q = encodeURIComponent(placeName)
  return `https://www.klook.com/ko/search/?query=${q}&af_id=PARTNER_ID`
}
function getMrtUrl(placeName: string) {
  const q = encodeURIComponent(placeName)
  return `https://www.myrealtrip.com/offers?q=${q}&utm_source=gurmi&utm_medium=app`
}

export default function PlanScreen({
  places, selectedPlaceId, onSelect, onRemove, onUpdateDuration, onUpdateDayIndex,
  onReorder, onSegmentModeChange, onSegmentDurationChange, onSegmentPress,
  prevDayLastPlace, onShowMap, onFocusPlace,
  startDate, onStartDateChange, travelMode,
  travelSegments, segmentsLoading, segmentModes, segmentDurations,
  onUpdateBudget,
}: Props) {
  const [pickerMode, setPickerMode] = useState<boolean>(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [dragOrder, setDragOrder] = useState<number[] | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)

  const dragOrderRef = useRef<number[] | null>(null)
  dragOrderRef.current = dragOrder
  const startPageY = useRef(0)
  const startItemTop = useRef(0)
  const ITEM_HEIGHT = 72 // 드래그 모드에서 각 카드 높이

  // 타임라인 계산 (prevDayLastPlace 있으면 travelSegments[0]이 전날→오늘 구간)
  const segOffset = prevDayLastPlace ? 1 : 0
  const firstSeg = prevDayLastPlace ? travelSegments[0] : null
  let currentTime = new Date(startDate)
  if (firstSeg) currentTime = addMinutes(currentTime, firstSeg.duration)
  const schedule = places.map((place, index) => {
    const from = new Date(currentTime)
    currentTime = addMinutes(currentTime, place.duration)
    const to = new Date(currentTime)
    const seg = travelSegments[index + segOffset]
    let travelTo: TravelSegment | null = null
    if (seg && index < places.length - 1) {
      travelTo = seg
      currentTime = addMinutes(currentTime, seg.duration)
    }
    return { ...place, from, to, travelTo }
  })
  const endTime = new Date(currentTime)

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPickerMode(false)
    if (date) onStartDateChange(date)
  }

  const travelIcon = TRAVEL_MODES.find(m => m.key === travelMode)?.icon ?? '🚗'

  // dragPansRef는 early return 전에 선언해야 hooks 규칙 위반 안 됨
  const dragPansRef = useRef<ReturnType<typeof PanResponder.create>[]>([])

  function makeDragPan(placeIdx: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const order = places.map((_, i) => i)
        setDragOrder(order)
        const pos = placeIdx
        startPageY.current = e.nativeEvent.pageY
        startItemTop.current = pos * ITEM_HEIGHT
        setDraggingIdx(placeIdx)
        setDragOffsetY(0)
      },
      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - startPageY.current
        setDragOffsetY(dy)
        const curOrder = dragOrderRef.current ?? places.map((_, i) => i)
        const y = Math.max(0, Math.min(startItemTop.current + dy, (places.length - 1) * ITEM_HEIGHT))
        const newPos = Math.min(Math.round(y / ITEM_HEIGHT), places.length - 1)
        const oldPos = curOrder.indexOf(placeIdx)
        if (newPos !== oldPos) {
          const next = [...curOrder]
          next.splice(oldPos, 1)
          next.splice(newPos, 0, placeIdx)
          setDragOrder(next)
        }
      },
      onPanResponderRelease: () => {
        const finalOrder = dragOrderRef.current ?? places.map((_, i) => i)
        onReorder(finalOrder.map(i => places[i]))
        setDraggingIdx(null)
        setDragOrder(null)
        setDragOffsetY(0)
      },
    })
  }

  if (dragPansRef.current.length !== places.length) {
    dragPansRef.current = places.map((_, i) => makeDragPan(i))
  }

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

  const isDragging = draggingIdx !== null

  return (
    <View style={styles.container}>
      {/* 헤더 — 출발시간 + 로딩 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>출발 시간</Text>
          <TouchableOpacity style={styles.timePicker} onPress={() => setPickerMode(true)}>
            <Text style={styles.timePickerText}>{formatTime(startDate)}</Text>
            <Text style={styles.timePickerIcon}>✏️</Text>
          </TouchableOpacity>
          {segmentsLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>계산 중...</Text>
            </View>
          )}
        </View>
        {pickerMode && (
          <DateTimePicker
            value={startDate}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handlePickerChange}
          />
        )}
        {Platform.OS === 'ios' && pickerMode && (
          <TouchableOpacity style={styles.pickerDone} onPress={() => setPickerMode(false)}>
            <Text style={styles.pickerDoneText}>확인</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 드래그 순서 변경 모드 */}
      {isDragging && (
        <View style={[styles.dragList, { height: places.length * ITEM_HEIGHT }]}>
          {(dragOrder ?? places.map((_, i) => i)).map((placeIdx, pos) => {
            const place = places[placeIdx]
            const color = PLACE_COLORS[placeIdx % PLACE_COLORS.length]
            const isThisDragging = draggingIdx === placeIdx
            const top = isThisDragging
              ? Math.max(0, Math.min(startItemTop.current + dragOffsetY, (places.length - 1) * ITEM_HEIGHT))
              : pos * ITEM_HEIGHT
            return (
              <View
                key={place.id}
                style={[
                  styles.dragItem,
                  { top },
                  isThisDragging && styles.dragItemActive,
                ]}
              >
                <View style={[styles.dragBadge, { backgroundColor: color.bg }]}>
                  <Text style={[styles.dragBadgeText, { color: color.dot }]}>{pos + 1}</Text>
                </View>
                <Text style={styles.dragName} numberOfLines={1}>{place.name}</Text>
                <View style={styles.dragHandle} {...dragPansRef.current[placeIdx].panHandlers}>
                  <Text style={styles.dragHandleIcon}>☰</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* 타임라인 + 장소 카드 */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} scrollEnabled={!isDragging}>
        {/* 전날 마지막 장소 + 이동 구간 */}
        {prevDayLastPlace && (
          <>
            <View style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <Text style={styles.timeText}>{formatTime(startDate)}</Text>
                <View style={[styles.timelineDot, { backgroundColor: '#9E9E9E' }]} />
                <View style={styles.timelineLine} />
              </View>
              <View style={[styles.placeCard, { borderLeftColor: '#9E9E9E', opacity: 0.65 }]}>
                <View style={styles.placeCardTop}>
                  <View style={[styles.indexBadge, { backgroundColor: '#F5F5F5' }]}>
                    <Text style={[styles.indexText, { color: '#9E9E9E' }]}>전</Text>
                  </View>
                  <Text style={[styles.nameText, { color: '#9E9E9E', flex: 1 }]} numberOfLines={1}>{prevDayLastPlace.name}</Text>
                  <Text style={{ fontSize: 10, color: '#BDBDBD' }}>전날 도착지</Text>
                </View>
              </View>
            </View>
            {/* 전날 → 오늘 이동 구간 */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <Text style={styles.travelTimeText}>{formatTime(startDate)}</Text>
                <View style={styles.travelDot} />
                <View style={styles.timelineLine} />
              </View>
              <TouchableOpacity
                style={styles.travelCard}
                onPress={() => firstSeg && places[0] && onSegmentPress(prevDayLastPlace!, places[0], firstSeg.mode)}
                activeOpacity={firstSeg ? 0.7 : 1}
              >
                <View style={styles.segModeRow}>
                  {TRAVEL_MODES.map(m => {
                    const isActive = (segmentModes[0] ?? travelMode) === m.key
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[styles.segModeBtn, isActive && styles.segModeBtnActive]}
                        onPress={() => onSegmentModeChange(-1, m.key)}
                      >
                        <Text style={styles.segModeIcon}>{m.icon}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {(segmentModes[0] ?? travelMode) === 'OTHER' && (
                  <View style={styles.customDurRow}>
                    <Text style={styles.customDurLabel}>소요 시간 (분)</Text>
                    <TextInput
                      style={styles.customDurInput}
                      keyboardType="number-pad"
                      placeholder="예) 45"
                      placeholderTextColor="#ccc"
                      value={segmentDurations[0] != null ? String(segmentDurations[0]) : ''}
                      onChangeText={v => onSegmentDurationChange(-1, v ? parseInt(v) : null)}
                    />
                  </View>
                )}
                {firstSeg ? (
                  <View style={styles.segInfo}>
                    <Text style={styles.travelDuration}>이동 {formatDuration(firstSeg.duration)}</Text>
                    <Text style={styles.travelDistance}>{firstSeg.distance}</Text>
                    <Text style={styles.routeHint}>지도에서 보기 →</Text>
                  </View>
                ) : (
                  <View style={styles.segInfo}>
                    <Text style={styles.segInfoEmpty}>
                      {(segmentModes[0] ?? travelMode) === 'OTHER' ? '소요 시간을 입력해주세요' : '이동수단을 선택하면 계산돼요'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
                    <View {...dragPansRef.current[index].panHandlers} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={styles.handleIcon}>☰</Text>
                    </View>
                    <View style={[styles.indexBadge, { backgroundColor: color.bg }]}>
                      <Text style={[styles.indexText, { color: color.dot }]}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity style={styles.nameBtn} onPress={() => { onSelect(item.id); onFocusPlace(item.id); onShowMap() }}>
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

                  {/* 체류시간 + 예산 + 투어 버튼 (펼쳐졌을 때) */}
                  {isExpanded && (
                    <>
                      <View style={styles.budgetRow}>
                        <Text style={styles.budgetLabel}>💰 예상 금액</Text>
                        <View style={styles.budgetInputWrap}>
                          <TextInput
                            style={styles.budgetInput}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor="#ccc"
                            value={item.budget != null ? String(item.budget) : ''}
                            onChangeText={v => onUpdateBudget(item.id, v ? parseInt(v.replace(/[^0-9]/g, '')) : undefined)}
                          />
                          <Text style={styles.budgetUnit}>원</Text>
                        </View>
                      </View>
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
                      <View style={styles.tourRow}>
                        <Text style={styles.tourLabel}>이 장소 근처 투어</Text>
                        <View style={styles.tourBtns}>
                          <TouchableOpacity
                            style={styles.tourBtn}
                            onPress={() => Linking.openURL(getKlookUrl(item.name))}
                          >
                            <Text style={styles.tourBtnText}>🎫 클룩</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.tourBtn, styles.tourBtnMrt]}
                            onPress={() => Linking.openURL(getMrtUrl(item.name))}
                          >
                            <Text style={[styles.tourBtnText, styles.tourBtnMrtText]}>✈️ 마이리얼트립</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* 이동 구간 */}
              {index < places.length - 1 && (
                <View style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.travelTimeText}>{formatTime(item.to)}</Text>
                    <View style={styles.travelDot} />
                    <View style={styles.timelineLine} />
                  </View>
                  <TouchableOpacity
                    style={styles.travelCard}
                    onPress={() => item.travelTo && onSegmentPress(places[index], places[index + 1], item.travelTo.mode)}
                    activeOpacity={item.travelTo ? 0.7 : 1}
                  >
                    {/* 이동수단 선택 버튼 */}
                    <View style={styles.segModeRow}>
                      {TRAVEL_MODES.map(m => {
                        const isActive = (segmentModes[segOffset + index] ?? travelMode) === m.key
                        return (
                          <TouchableOpacity
                            key={m.key}
                            style={[styles.segModeBtn, isActive && styles.segModeBtnActive]}
                            onPress={() => onSegmentModeChange(index, m.key)}
                          >
                            <Text style={styles.segModeIcon}>{m.icon}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                    {/* OTHER 모드: 직접 분 입력 */}
                    {(segmentModes[segOffset + index] ?? travelMode) === 'OTHER' && (
                      <View style={styles.customDurRow}>
                        <Text style={styles.customDurLabel}>소요 시간 (분)</Text>
                        <TextInput
                          style={styles.customDurInput}
                          keyboardType="number-pad"
                          placeholder="예) 45"
                          placeholderTextColor="#ccc"
                          value={segmentDurations[segOffset + index] != null ? String(segmentDurations[segOffset + index]) : ''}
                          onChangeText={v => onSegmentDurationChange(index, v ? parseInt(v) : null)}
                        />
                      </View>
                    )}
                    {/* 계산된 이동시간/거리 */}
                    {item.travelTo ? (
                      <View style={styles.segInfo}>
                        <Text style={styles.travelDuration}>이동 {formatDuration(item.travelTo.duration)}</Text>
                        <Text style={styles.travelDistance}>{item.travelTo.distance}</Text>
                        <Text style={styles.routeHint}>지도에서 보기 →</Text>
                      </View>
                    ) : (
                      <View style={styles.segInfo}>
                        <Text style={styles.segInfoEmpty}>
                          {(segmentModes[segOffset + index] ?? travelMode) === 'OTHER' ? '소요 시간을 입력해주세요' : '이동수단을 선택하면 계산돼요'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        })}

        {/* 예산 합계 */}
        {(() => {
          const budgetedPlaces = places.filter(p => p.budget != null && p.budget > 0)
          if (budgetedPlaces.length === 0) return null
          const total = budgetedPlaces.reduce((s, p) => s + (p.budget ?? 0), 0)
          return (
            <View style={styles.budgetSummary}>
              <Text style={styles.budgetSummaryLabel}>💰 이번 일정 예산</Text>
              <Text style={styles.budgetSummaryAmount}>{total.toLocaleString()}원</Text>
            </View>
          )
        })()}

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
  container: { flex: 1, backgroundColor: COLORS.bg, position: 'relative' },
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
  handleIcon: { fontSize: 16, color: '#C0C0C0', paddingHorizontal: 4 },

  dragList: {
    position: 'absolute', top: 70, left: 0, right: 0,
    zIndex: 100, backgroundColor: COLORS.bg, paddingHorizontal: 16,
  },
  dragItem: {
    position: 'absolute', left: 16, right: 16,
    height: 64,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  dragItemActive: {
    shadowOpacity: 0.2, elevation: 12,
    transform: [{ scale: 1.03 }],
    zIndex: 999,
  },
  dragBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dragBadgeText: { fontSize: 12, fontWeight: '800' },
  dragName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  dragHandle: { padding: 10 },
  dragHandleIcon: { fontSize: 18, color: '#BDBDBD' },
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

  tourRow: { gap: 6, paddingTop: 4 },
  tourLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  tourBtns: { flexDirection: 'row', gap: 8 },
  tourBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#FF6B35', alignItems: 'center',
  },
  tourBtnMrt: { backgroundColor: '#00B4D8' },
  tourBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },
  tourBtnMrtText: { color: 'white' },

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
    flex: 1, gap: 8,
    backgroundColor: '#FAFAFA', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#EBEBEB', borderStyle: 'dashed',
  },
  segModeRow: { flexDirection: 'row', gap: 6 },
  segModeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0E0E0',
    justifyContent: 'center', alignItems: 'center',
  },
  segModeBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  segModeIcon: { fontSize: 16 },
  customDurRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customDurLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },
  customDurInput: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    fontSize: 14, fontWeight: '700', color: COLORS.text, textAlign: 'center',
  },
  segInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segInfoEmpty: { fontSize: 11, color: '#BDBDBD' },
  travelIcon: { fontSize: 14 },
  travelDuration: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  travelDistance: { fontSize: 11, color: '#BDBDBD' },
  routeHint: { fontSize: 10, color: COLORS.primary, marginLeft: 'auto', fontWeight: '600' },

  budgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 4,
  },
  budgetLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  budgetInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  budgetInput: {
    fontSize: 15, fontWeight: '700', color: COLORS.text,
    minWidth: 60, textAlign: 'right', padding: 0,
  },
  budgetUnit: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },

  budgetSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 0, marginBottom: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FFE082',
  },
  budgetSummaryLabel: { fontSize: 13, fontWeight: '600', color: '#795548' },
  budgetSummaryAmount: { fontSize: 18, fontWeight: '800', color: '#E65100' },

  endCard: {
    flex: 1, backgroundColor: '#E8F5E9', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#C8E6C9', gap: 2,
  },
  endCardText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  endCardSub: { fontSize: 11, color: '#66BB6A' },
})
