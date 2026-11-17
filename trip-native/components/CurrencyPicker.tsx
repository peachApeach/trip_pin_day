import React, { useEffect, useMemo, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../constants'
import { CURRENCIES, filterCurrencies } from '../utils/currency'

type Props = {
  visible: boolean
  /** 현재 선택된 통화 코드 (목록에서 강조) */
  selected?: string
  /** 숨길 통화 코드 (이미 다른 행에서 쓰는 통화 등) */
  exclude?: string[]
  onSelect: (code: string) => void
  onClose: () => void
}

/** 통화 선택 모달. 일정 화면과 여행 추가 화면이 함께 쓴다. */
export default function CurrencyPicker({ visible, selected, exclude, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  // 모달을 닫을 때 검색어를 비워, 다시 열면 전체 목록부터 보이게 한다.
  useEffect(() => {
    if (!visible) setQuery('')
  }, [visible])

  const list = useMemo(() => {
    const base = exclude?.length
      ? CURRENCIES.filter(c => c.code === selected || !exclude.includes(c.code))
      : CURRENCIES
    return filterCurrencies(base, query)
  }, [query, selected, exclude?.join(',')])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        {/* 안쪽을 눌러도 닫히지 않도록 터치를 삼킨다 */}
        <TouchableOpacity style={styles.currencyList} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.currencyListTitle}>통화 선택</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="통화·국가 검색 (예: 태국, THB, bangkok)"
            placeholderTextColor={COLORS.textSub}
            autoCorrect={false}
            autoCapitalize="characters"
            clearButtonMode="while-editing"
          />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {list.length === 0 ? (
              <Text style={styles.empty}>검색 결과가 없어요</Text>
            ) : (
              list.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.currencyItem, selected === c.code && styles.currencyItemActive]}
                  onPress={() => onSelect(c.code)}
                >
                  <Text style={styles.currencyItemSymbol}>{c.symbol}</Text>
                  <Text style={styles.currencyItemCode}>{c.code}</Text>
                  <Text style={styles.currencyItemLabel} numberOfLines={1}>{c.label}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  currencyList: {
    width: 300, maxHeight: 480, backgroundColor: COLORS.card,
    borderRadius: 20, padding: 16,
  },
  currencyListTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  searchInput: {
    backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: COLORS.text, marginBottom: 10,
  },
  empty: { fontSize: 12, color: COLORS.textSub, textAlign: 'center', paddingVertical: 24 },
  currencyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
  },
  currencyItemActive: { backgroundColor: COLORS.primaryLight },
  currencyItemSymbol: { fontSize: 16, width: 32, textAlign: 'center', fontWeight: '700', color: COLORS.primary },
  currencyItemCode: { fontSize: 13, fontWeight: '700', color: COLORS.text, width: 40 },
  currencyItemLabel: { fontSize: 12, color: COLORS.textSub, flex: 1 },
})
