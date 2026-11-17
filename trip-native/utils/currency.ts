// 여행지에서 쓰는 통화 목록. 앞쪽은 한국인 여행 빈도가 높은 순,
// 그 뒤는 지역별로 묶었다. keywords는 검색용 별칭(국가명·영문·심볼 등)이다.
export const CURRENCIES = [
  { code: 'KRW', symbol: '₩', label: '한국 원', keywords: 'korea korean won 대한민국 원화' },
  { code: 'JPY', symbol: '¥', label: '일본 엔', keywords: 'tokyo osaka kyoto fukuoka sapporo okinawa japan japanese yen 엔화 도쿄 오사카' },
  { code: 'USD', symbol: '$', label: '미국 달러', keywords: 'hawaii guam saipan newyork usa america dollar 달러 미국 하와이 괌' },
  { code: 'EUR', symbol: '€', label: '유로', keywords: 'france germany italy spain paris rome barcelona europe euro 유럽 프랑스 독일 이탈리아 스페인' },
  { code: 'CNY', symbol: '¥', label: '중국 위안', keywords: 'shanghai beijing china chinese yuan rmb 위안화 상하이 베이징' },
  { code: 'TWD', symbol: 'NT$', label: '대만 달러', keywords: 'taipei taiwan taiwanese dollar 타이완 대만 타이베이' },
  { code: 'HKD', symbol: 'HK$', label: '홍콩 달러', keywords: 'hongkong hong kong dollar 홍콩' },
  { code: 'THB', symbol: '฿', label: '태국 바트', keywords: 'bangkok phuket chiangmai chiang mai thailand thai baht 타이 방콕 푸켓 치앙마이' },
  { code: 'VND', symbol: '₫', label: '베트남 동', keywords: 'danang da nang hanoi hochiminh ho chi minh nhatrang vietnam vietnamese dong 다낭 하노이 호치민 나트랑' },
  { code: 'PHP', symbol: '₱', label: '필리핀 페소', keywords: 'cebu boracay manila philippines peso 세부 보라카이 마닐라' },
  { code: 'SGD', symbol: 'S$', label: '싱가포르 달러', keywords: 'singapore dollar 싱가폴' },
  { code: 'MYR', symbol: 'RM', label: '말레이시아 링깃', keywords: 'kualalumpur kuala lumpur kotakinabalu malaysia ringgit 쿠알라룸푸르 코타키나발루' },
  { code: 'IDR', symbol: 'Rp', label: '인도네시아 루피아', keywords: 'bali jakarta indonesia rupiah 발리 자카르타' },
  { code: 'MOP', symbol: 'MOP$', label: '마카오 파타카', keywords: 'macau macao pataca 마카오' },
  { code: 'LAK', symbol: '₭', label: '라오스 킵', keywords: 'vientiane luangprabang laos kip 라오스 비엔티안 루앙프라방' },
  { code: 'KHR', symbol: '៛', label: '캄보디아 리엘', keywords: 'siemreap siem reap angkor cambodia riel 캄보디아 씨엠립 앙코르' },
  { code: 'MMK', symbol: 'K', label: '미얀마 짯', keywords: 'yangon myanmar burma kyat 미얀마 양곤' },
  { code: 'MNT', symbol: '₮', label: '몽골 투그릭', keywords: 'ulaanbaatar mongolia tugrik 몽골 울란바토르' },
  { code: 'INR', symbol: '₹', label: '인도 루피', keywords: 'delhi mumbai india rupee 인도 델리' },
  { code: 'NPR', symbol: 'Rs', label: '네팔 루피', keywords: 'kathmandu nepal rupee 네팔 카트만두' },
  { code: 'LKR', symbol: 'Rs', label: '스리랑카 루피', keywords: 'srilanka sri lanka rupee 스리랑카' },
  { code: 'MVR', symbol: 'Rf', label: '몰디브 루피아', keywords: 'maldives rufiyaa 몰디브' },
  { code: 'GBP', symbol: '£', label: '영국 파운드', keywords: 'london uk britain british pound 영국 런던' },
  { code: 'CHF', symbol: 'Fr', label: '스위스 프랑', keywords: 'zurich interlaken geneva switzerland swiss franc 스위스 취리히 인터라켄' },
  { code: 'CZK', symbol: 'Kč', label: '체코 코루나', keywords: 'prague praha czech koruna 체코 프라하' },
  { code: 'HUF', symbol: 'Ft', label: '헝가리 포린트', keywords: 'budapest hungary forint 헝가리 부다페스트' },
  { code: 'PLN', symbol: 'zł', label: '폴란드 즈워티', keywords: 'warsaw krakow poland zloty 폴란드 바르샤바 크라쿠프' },
  { code: 'SEK', symbol: 'kr', label: '스웨덴 크로나', keywords: 'stockholm sweden krona 스웨덴 스톡홀름' },
  { code: 'NOK', symbol: 'kr', label: '노르웨이 크로네', keywords: 'oslo bergen norway krone 노르웨이 오슬로 베르겐' },
  { code: 'DKK', symbol: 'kr', label: '덴마크 크로네', keywords: 'copenhagen denmark krone 덴마크 코펜하겐' },
  { code: 'ISK', symbol: 'kr', label: '아이슬란드 크로나', keywords: 'reykjavik iceland krona 아이슬란드 레이캬비크' },
  { code: 'RON', symbol: 'lei', label: '루마니아 레우', keywords: 'romania leu 루마니아 부쿠레슈티' },
  { code: 'BGN', symbol: 'лв', label: '불가리아 레프', keywords: 'bulgaria lev 불가리아 소피아' },
  { code: 'HRK', symbol: 'kn', label: '크로아티아 쿠나', keywords: 'dubrovnik zagreb croatia kuna 크로아티아 두브로브니크' },
  { code: 'RSD', symbol: 'дин', label: '세르비아 디나르', keywords: 'serbia dinar 세르비아 베오그라드' },
  { code: 'TRY', symbol: '₺', label: '튀르키예 리라', keywords: 'istanbul cappadocia turkey turkish lira 터키 이스탄불 카파도키아' },
  { code: 'RUB', symbol: '₽', label: '러시아 루블', keywords: 'moscow vladivostok russia ruble 러시아 모스크바 블라디보스토크' },
  { code: 'UAH', symbol: '₴', label: '우크라이나 흐리브냐', keywords: 'ukraine hryvnia 우크라이나 키예프' },
  { code: 'GEL', symbol: '₾', label: '조지아 라리', keywords: 'tbilisi georgia lari 조지아 트빌리시' },
  { code: 'AUD', symbol: 'A$', label: '호주 달러', keywords: 'sydney melbourne australia dollar 호주 시드니 멜버른' },
  { code: 'NZD', symbol: 'NZ$', label: '뉴질랜드 달러', keywords: 'queenstown auckland newzealand new zealand dollar 뉴질랜드 퀸스타운' },
  { code: 'FJD', symbol: 'FJ$', label: '피지 달러', keywords: 'fiji dollar 피지' },
  { code: 'CAD', symbol: 'C$', label: '캐나다 달러', keywords: 'vancouver toronto canada dollar 캐나다 밴쿠버 토론토' },
  { code: 'MXN', symbol: 'MX$', label: '멕시코 페소', keywords: 'cancun mexico peso 멕시코 칸쿤' },
  { code: 'BRL', symbol: 'R$', label: '브라질 헤알', keywords: 'rio saopaulo brazil real 브라질 리우' },
  { code: 'ARS', symbol: 'AR$', label: '아르헨티나 페소', keywords: 'argentina peso 아르헨티나 부에노스아이레스' },
  { code: 'CLP', symbol: 'CL$', label: '칠레 페소', keywords: 'chile peso 칠레 산티아고' },
  { code: 'PEN', symbol: 'S/', label: '페루 솔', keywords: 'cusco machupicchu peru sol 페루 쿠스코 마추픽추' },
  { code: 'COP', symbol: 'CO$', label: '콜롬비아 페소', keywords: 'colombia peso 콜롬비아 보고타' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE 디르함', keywords: 'dubai abudhabi abu dhabi uae emirates dirham 두바이 아부다비' },
  { code: 'SAR', symbol: '﷼', label: '사우디 리얄', keywords: 'saudi arabia riyal 사우디 리야드' },
  { code: 'QAR', symbol: 'ر.ق', label: '카타르 리얄', keywords: 'doha qatar riyal 카타르 도하' },
  { code: 'ILS', symbol: '₪', label: '이스라엘 셰켈', keywords: 'jerusalem telaviv israel shekel 이스라엘 예루살렘' },
  { code: 'JOD', symbol: 'د.ا', label: '요르단 디나르', keywords: 'petra amman jordan dinar 요르단 페트라' },
  { code: 'EGP', symbol: 'E£', label: '이집트 파운드', keywords: 'cairo luxor egypt pound 이집트 카이로 룩소르' },
  { code: 'MAD', symbol: 'DH', label: '모로코 디르함', keywords: 'marrakech casablanca morocco dirham 모로코 마라케시' },
  { code: 'ZAR', symbol: 'R', label: '남아공 란드', keywords: 'capetown cape town southafrica south africa rand 남아프리카 케이프타운' },
  { code: 'KES', symbol: 'KSh', label: '케냐 실링', keywords: 'nairobi kenya shilling 케냐 나이로비' },
  { code: 'TZS', symbol: 'TSh', label: '탄자니아 실링', keywords: 'zanzibar tanzania shilling 탄자니아 잔지바르' },
  { code: 'ETB', symbol: 'Br', label: '에티오피아 비르', keywords: 'ethiopia birr 에티오피아' },
  { code: 'UZS', symbol: "so'm", label: '우즈베키스탄 숨', keywords: 'tashkent samarkand uzbekistan sum 우즈베키스탄 타슈켄트 사마르칸트' },
  { code: 'KZT', symbol: '₸', label: '카자흐스탄 텡게', keywords: 'almaty kazakhstan tenge 카자흐스탄 알마티' },
  { code: 'AZN', symbol: '₼', label: '아제르바이잔 마나트', keywords: 'baku azerbaijan manat 아제르바이잔 바쿠' },
  { code: 'PKR', symbol: 'Rs', label: '파키스탄 루피', keywords: 'pakistan rupee 파키스탄' },
  { code: 'BDT', symbol: '৳', label: '방글라데시 타카', keywords: 'bangladesh taka 방글라데시' },
  { code: 'BND', symbol: 'B$', label: '브루나이 달러', keywords: 'brunei dollar 브루나이' },
] as const

export type Currency = (typeof CURRENCIES)[number]

/**
 * 통화 목록을 검색어로 좁힌다.
 * 코드·한글 이름·별칭(국가명/영문/도시)을 모두 보고,
 * 공백으로 나눈 모든 토큰이 하나라도 걸리는 항목만 남긴다.
 * ("태국 바트", "thai baht", "방콕" 모두 THB를 찾는다)
 *
 * 정렬: 코드 접두 일치 → 이름 접두 일치 → 나머지. 원래 순서는 유지한다.
 */
export function filterCurrencies(list: readonly Currency[], query: string): Currency[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [...list]

  const matched = list.filter(c => {
    const haystack = `${c.code} ${c.label} ${c.keywords} ${c.symbol}`.toLowerCase()
    return tokens.every(t => haystack.includes(t))
  })

  const head = tokens[0]
  const rank = (c: Currency) => {
    if (c.code.toLowerCase().startsWith(head)) return 0
    if (c.label.toLowerCase().startsWith(head)) return 1
    return 2
  }
  // 같은 순위끼리는 원래 순서를 지키도록 인덱스를 보조 키로 쓴다.
  return matched
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.c)
}
