import { CURRENCIES, filterCurrencies } from '../utils/currency'

describe('CURRENCIES 목록', () => {
  it('통화 코드가 중복되지 않는다', () => {
    const codes = CURRENCIES.map(c => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('모든 항목이 code/symbol/label/keywords를 채우고 있다', () => {
    CURRENCIES.forEach(c => {
      expect(c.code).toMatch(/^[A-Z]{3}$/)
      expect(c.symbol.length).toBeGreaterThan(0)
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.keywords.length).toBeGreaterThan(0)
    })
  })

  it('한국인 여행 빈도가 높은 통화가 포함되어 있다', () => {
    const codes = CURRENCIES.map(c => c.code)
    // 기존 G20 목록에서 빠져 있던 것들
    expect(codes).toEqual(expect.arrayContaining([
      'THB', 'VND', 'TWD', 'HKD', 'SGD', 'PHP', 'MYR', 'CHF', 'MOP', 'AED',
    ]))
  })
})

describe('filterCurrencies', () => {
  it('빈 검색어는 전체를 돌려준다', () => {
    expect(filterCurrencies(CURRENCIES, '')).toHaveLength(CURRENCIES.length)
    expect(filterCurrencies(CURRENCIES, '   ')).toHaveLength(CURRENCIES.length)
  })

  it('통화 코드로 찾는다 (대소문자 무시)', () => {
    expect(filterCurrencies(CURRENCIES, 'thb')[0].code).toBe('THB')
    expect(filterCurrencies(CURRENCIES, 'THB')[0].code).toBe('THB')
  })

  it('한글 이름으로 찾는다', () => {
    expect(filterCurrencies(CURRENCIES, '태국')[0].code).toBe('THB')
    expect(filterCurrencies(CURRENCIES, '바트')[0].code).toBe('THB')
  })

  it('영문 국가명으로 찾는다', () => {
    expect(filterCurrencies(CURRENCIES, 'vietnam')[0].code).toBe('VND')
    expect(filterCurrencies(CURRENCIES, 'swiss')[0].code).toBe('CHF')
  })

  it('도시명 별칭으로도 찾는다', () => {
    expect(filterCurrencies(CURRENCIES, '다낭')[0].code).toBe('VND')
    expect(filterCurrencies(CURRENCIES, '두바이')[0].code).toBe('AED')
    expect(filterCurrencies(CURRENCIES, 'bangkok').map(c => c.code)).toContain('THB')
  })

  it('공백으로 나눈 토큰을 모두 만족해야 한다 (AND 조건)', () => {
    expect(filterCurrencies(CURRENCIES, 'hong kong').map(c => c.code)).toEqual(['HKD'])
    // 서로 다른 통화의 키워드를 섞으면 결과가 없다
    expect(filterCurrencies(CURRENCIES, '태국 베트남')).toHaveLength(0)
  })

  it('코드 접두 일치를 이름 일치보다 먼저 보여준다', () => {
    // 'kr'은 KRW 코드와 여러 krona/krone 심볼에 걸린다
    expect(filterCurrencies(CURRENCIES, 'kr')[0].code).toBe('KRW')
  })

  it('같은 순위끼리는 원래 목록 순서를 지킨다', () => {
    const result = filterCurrencies(CURRENCIES, '달러').map(c => c.code)
    const original = CURRENCIES.filter(c => result.includes(c.code)).map(c => c.code)
    expect(result).toEqual(original)
  })

  it('없는 검색어는 빈 배열을 돌려준다', () => {
    expect(filterCurrencies(CURRENCIES, 'zzzzz')).toHaveLength(0)
  })

  it('넘겨준 목록만 대상으로 한다 (제외 필터와 조합 가능)', () => {
    const subset = CURRENCIES.filter(c => c.code !== 'THB')
    expect(filterCurrencies(subset, 'thb')).toHaveLength(0)
  })

  it('원본 배열을 변형하지 않는다', () => {
    const before = CURRENCIES.map(c => c.code)
    filterCurrencies(CURRENCIES, 'kr')
    expect(CURRENCIES.map(c => c.code)).toEqual(before)
  })
})
