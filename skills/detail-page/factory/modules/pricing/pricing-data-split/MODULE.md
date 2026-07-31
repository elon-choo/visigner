# pricing-data-split

타입: `pricing` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-motion-v1`

## 1. 왜 이 방식인가

플랜 제목과 조건 집합을 나란히 두어 비교 전의 기준 읽기를 분명히 한다. split은 계약 축 조합이지 다른 소스의 관찰을 뜻하지 않는다.

프로파일 해부 앵커: `pricing-title` · `plan-set` · `terms-or-conditions`. pricing 구조와 styles inventory를 함께 가진 적격 소스는 posthog 하나뿐이다. 그 실제 구조 앵커를 유지하고 남은 변형 축만 계약 안에서 조합한다. 기본값은 `split` · `contrast-bleed`이며, 슬롯과 semantic 토큰으로만 일반화한다.

## 컬렉션 아이템 구조

- `pricePlans`의 항목은 `{ "name": string, "price": string, "details": string, "ctaLabel": string, "ctaHref": string }`이다. 조건은 details에 명시하고 가격을 추정하지 않는다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 full-bleed 계열이므로 COMPOSITION-GRAMMAR의 full-bleed 연속 금지와 전체 비율 상한에 특히 민감하다.
- (b) 토큰: 표면·텍스트·선, 행동색, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 원본의 값은 복사하지 않는다.
- (c) 다른 모듈: 없음(독립). 조성 시 타입·기본 레이아웃의 중복은 COMPOSITION-GRAMMAR로 점검한다.

## 3. 변경 파급

- 슬롯을 바꾸면 → 필수 슬롯 `headline`, `pricePlans`와 `module.json`, template 앵커, SECTION-SCHEMA를 함께 검토해야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/pricing/pricing-data-split` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 해당 CSS의 grid/표면 관계와 조성의 인접 다양성·이음새 규칙을 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark·제목 계층·semantic 토큰 소비를 함께 검토해야 한다. SECTION-SCHEMA의 슬롯/축 표를 바꾸는 경우는 이 모듈 밖의 스키마 개정 사안이다.

## 4. 코치 코멘트

- raw 색·원시 간격 단위를 "더 정확한 재현"처럼 넣지 말 것. 이 모듈은 source style 값을 복사하지 않고 semantic 토큰만 소비한다.
- 컬렉션 슬롯은 반복 항목이 아니라 컨테이너 하나에만 `data-slot`을 둔다. 항목마다 같은 슬롯 앵커를 추가하지 말 것.
- `motion: none`은 정적 관찰에서 동작을 주장하지 않기 위한 기본값이다. 모션을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.
- 이 모듈은 실재 앵커의 구조만 채굴했고 축 조합은 계약 기반이다. 축 조합을 다른 코퍼스 레코드에서 관찰한 것처럼 적지 말 것.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/pricing--pricing-data-split/

## 6. 출처

- provenance: `mined`
- recordId: `posthog`
- span order: `9`
- sectionSpan: `captures/stage2/posthog/tile_00.png#pricing`
- variantProvenance: `structure-mined; axis-composed`
- 축-순열 폴백: 적격한 서로 다른 소스 레코드는 `posthog` 1개로 목표 `4`개에 못 미친다. 이 실재 앵커의 구조 관찰은 유지하고, `layoutArchetype`·`density`·`backgroundBleed`·`motion`·`artDirection` 조합만 계약 안에서 구성했다. 기존/인접 변형과는 최소 `2`축 차이를 검사했다.
- 보조 구조 관찰: 없음 — 이 변형은 주 출처의 명시된 구조 관찰만으로 생성했다.
- 범위: 구조 관찰과 style inventory의 semantic 역할 매핑만. 픽셀·카피·브랜드 요소 복제 아님.
