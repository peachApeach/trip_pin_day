import { klookSearchUrl } from '../utils/affiliate'

describe('klookSearchUrl — 상품 검색 경로', () => {
  test('통합 검색(/search/)이 아니라 버티컬 검색으로 보낸다', () => {
    const url = klookSearchUrl('마리나 베이 샌즈')!
    expect(url).toContain('/ko/experiences/search/')
    // 예전 경로는 지역 페이지로 흘러갔다
    expect(url).not.toMatch(/klook\.com\/ko\/search\//)
  })

  test('장소명은 query 파라미터로 인코딩된다', () => {
    expect(klookSearchUrl('마리나 베이 샌즈')).toBe(
      'https://www.klook.com/ko/experiences/search/?query=%EB%A7%88%EB%A6%AC%EB%82%98%20%EB%B2%A0%EC%9D%B4%20%EC%83%8C%EC%A6%88',
    )
  })

  test('자리표시자 제휴 ID를 더 이상 붙이지 않는다', () => {
    expect(klookSearchUrl('Gardens by the Bay')).not.toContain('PARTNER_ID')
    expect(klookSearchUrl('Gardens by the Bay')).not.toContain('af_id')
  })
})

describe('klookSearchUrl — 쿼리 주입 차단', () => {
  test('& 와 = 는 인코딩돼서 파라미터가 늘어나지 않는다', () => {
    const url = klookSearchUrl('a&aid=evil&x=1')!
    expect(url).toContain('query=a%26aid%3Devil%26x%3D1')
    // '?' 뒤에 파라미터가 하나뿐이어야 한다
    expect(url.split('?')[1].split('&')).toHaveLength(1)
  })

  test('#으로 경로를 끊지 못한다', () => {
    expect(klookSearchUrl('a#/evil')).toContain('query=a%23%2Fevil')
  })
})

describe('klookSearchUrl — 빈 이름', () => {
  test('빈 문자열과 공백만 있으면 null', () => {
    expect(klookSearchUrl('')).toBeNull()
    expect(klookSearchUrl('   ')).toBeNull()
  })

  test('앞뒤 공백은 떼고 검색한다', () => {
    expect(klookSearchUrl('  Sentosa  ')).toBe(
      'https://www.klook.com/ko/experiences/search/?query=Sentosa',
    )
  })
})
