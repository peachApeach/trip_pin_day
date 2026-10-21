/**
 * mapsApi는 constants의 MAPS_PROXY_URL을 모듈 로드 시점에 읽으므로,
 * 프록시 on/off를 테스트하려면 jest.resetModules + doMock으로
 * constants를 갈아끼운 뒤 다시 import해야 한다.
 */
function loadWith(proxyUrl: string, token: string) {
  jest.resetModules()
  jest.doMock('../constants', () => ({
    GOOGLE_MAPS_API_KEY: 'TEST_API_KEY',
    MAPS_PROXY_URL: proxyUrl,
    MAPS_PROXY_TOKEN: token,
  }))
  return require('../utils/mapsApi') as typeof import('../utils/mapsApi')
}

describe('mapsUrl — 프록시 미설정(직접 호출)', () => {
  const { mapsUrl, mapsHeaders, isProxied } = loadWith('', '')

  test('Google 주소로 나가고 key가 붙는다', () => {
    const url = mapsUrl('/timezone/json', { location: '37.5,127.0', timestamp: 100 })
    expect(url).toContain('https://maps.googleapis.com/maps/api/timezone/json')
    expect(url).toContain('key=TEST_API_KEY')
  })

  test('isProxied는 false, 토큰 헤더 없음', () => {
    expect(isProxied()).toBe(false)
    expect(mapsHeaders()).toEqual({})
  })
})

describe('mapsUrl — 프록시 설정', () => {
  const { mapsUrl, mapsHeaders, isProxied } = loadWith('https://proxy.example.com', 'SECRET')

  test('프록시 주소로 나가고 key는 붙지 않는다', () => {
    const url = mapsUrl('/timezone/json', { location: '37.5,127.0', timestamp: 100 })
    expect(url).toContain('https://proxy.example.com/timezone/json')
    expect(url).not.toContain('maps.googleapis.com')
    // 키가 클라이언트 URL에 절대 들어가면 안 된다 — 프록시의 존재 이유
    expect(url).not.toContain('key=')
    expect(url).not.toContain('TEST_API_KEY')
  })

  test('후행 슬래시를 중복시키지 않는다', () => {
    const { mapsUrl: u } = loadWith('https://proxy.example.com/', 'SECRET')
    expect(u('/geocode/json', { latlng: '1,2' })).toContain('https://proxy.example.com/geocode/json')
  })

  test('앱 토큰을 헤더로 보낸다', () => {
    expect(isProxied()).toBe(true)
    expect(mapsHeaders()).toEqual({ 'x-app-token': 'SECRET' })
  })
})

describe('mapsUrl — 파라미터 인코딩', () => {
  const { mapsUrl } = loadWith('https://proxy.example.com', '')

  test('특수문자를 인코딩하고 원래 값으로 복원된다', () => {
    const url = mapsUrl('/place/textsearch/json', { query: '서울 맛집 & 카페' })
    // 공백은 form-urlencoded 방식('+')으로, &는 %26으로 인코딩된다
    expect(url).not.toContain(' ')
    expect(url).toContain('%26')
    expect(new URL(url).searchParams.get('query')).toBe('서울 맛집 & 카페')
  })

  test('쿼리 파라미터 주입 시도가 분리되지 않는다', () => {
    // &가 인코딩돼서 별도 파라미터가 되지 않아야 한다
    const url = mapsUrl('/place/textsearch/json', { query: 'x&key=EVIL' })
    expect(url).toContain('key%3DEVIL')
    expect(new URL(url).searchParams.get('key')).toBeNull()
    expect(new URL(url).searchParams.get('query')).toBe('x&key=EVIL')
  })

  test('빈 값은 생략한다', () => {
    const url = mapsUrl('/directions/json', { origin: '1,2', destination: '3,4', mode: '' })
    expect(url).not.toContain('mode=')
  })
})
