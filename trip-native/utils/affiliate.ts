/**
 * 클룩 제휴 링크.
 *
 * 왜 /search/ 가 아니라 /experiences/search/ 인가:
 *   예전에는 `https://www.klook.com/ko/search/?query=<장소명>` 을 썼는데,
 *   이 경로는 클룩이 공개한 정식 URL 목록(klook.com/llms.txt, llms-full.txt)에
 *   아예 없고 robots.txt 에서도 `Disallow` 로 막혀 있는 경로다.
 *   클룩 프론트엔드 라우터(cdn.klook.com/s/dist_web/experience/dist_web/app-*.js)가
 *   정의하는 "상품 검색" 경로는 둘뿐이다:
 *     /experiences/search/   name: ExperienceSearch   (투어·액티비티 전반)
 *     /attractions/search/   name: AttractionsSearch  (입장권 한정)
 *   기존 경로는 플랫폼 통합 검색이라 장소명을 넣으면 도시·지역 카드로
 *   흘러가서 "지역 페이지"가 떴다. 상품 목록을 원하면 버티컬 검색이어야 한다.
 *
 * 쿼리 파라미터 이름이 query 인 것도 같은 번들에서 확인했다
 * (검색 페이지의 filterData.query, suggest API 의 `query:` 파라미터).
 *
 * 입장권만 보려면 /attractions/search/ 를 쓰면 되지만, 즐길거리 패널과
 * 일정 상세는 관광지뿐 아니라 식당·숙소에서도 열리므로 더 넓은 쪽을 쓴다.
 */
const SEARCH_PATH = '/ko/experiences/search/'

/**
 * 장소명으로 클룩 상품을 검색하는 URL. 이름이 비어 있으면 null —
 * 빈 검색은 랜딩 페이지로 떨어져서 버튼을 누른 의미가 없다.
 *
 * 제휴 파라미터는 아직 붙이지 않는다. 예전 코드는 `af_id=PARTNER_ID`
 * 라는 자리표시자를 그대로 링크에 실어 보냈는데, 가입 전에는 의미가 없고
 * 클룩이 실제로 읽는 파라미터 이름도 확인할 수 없었다(제휴 설정을
 * /v1/affinternalsrv/aid2uid 로 서버에서 풀기 때문에 번들에 안 드러난다).
 * 파트너스 가입하면 대시보드가 주는 추적 파라미터를 여기에 추가하면 된다.
 */
export function klookSearchUrl(placeName: string): string | null {
  const name = placeName.trim()
  if (name === '') return null
  return `https://www.klook.com${SEARCH_PATH}?query=${encodeURIComponent(name)}`
}
