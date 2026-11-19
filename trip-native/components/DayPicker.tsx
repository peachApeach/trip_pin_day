import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../constants'

interface Props {
  title: string
  subtitle?: string
  dayLabels: string[]
  selectedDay: number
  onSelect: (dayIndex: number) => void
  onClose: () => void
}

export default function DayPicker({ title, subtitle, dayLabels, selectedDay, onSelect, onClose }: Props) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <ScrollView>
            {dayLabels.map((label, dayIndex) => {
              const selected = dayIndex === selectedDay
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[styles.day, selected && styles.daySelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(dayIndex)}
                >
                  <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>{label}</Text>
                  {selected && <Text style={styles.dayLabelSelected} accessible={false}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeLabel}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '86%', maxWidth: 360, maxHeight: '75%', padding: 16, borderRadius: 20, backgroundColor: COLORS.card },
  header: { gap: 4, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSub },
  day: {
    minHeight: 48, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  daySelected: { backgroundColor: COLORS.primaryLight },
  dayLabel: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  dayLabelSelected: { color: COLORS.primaryInk, fontWeight: '800' },
  close: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 12 },
  closeLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primaryInk },
})
