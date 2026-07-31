# pricing-plan-grid

타입: `pricing` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

플랜을 동등한 grid 단위로 두고 조건을 각 플랜의 가까운 맥락으로 남긴다. rail은 플랜에 시간적 우선순위를 부여하므로 배제했다.

프로파일 해부 앵커: `pricing-title` · `plan-set` · `terms-or-conditions`. 허용 세그먼트의 high-confidence pricing 분류를 구조 근거로 사용하고, 가격·카피·브랜드 요소는 일반화하지 않았다. 기본값은 `grid` · `card-contained`이며, 슬롯과 semantic 토큰으로만 일반화한다.

## 컬렉션 아이템 구조

- `pricePlans`의 항목은 `{ "name": string, "price": string, "details": string, "ctaLabel": string, "ctaHref": string }`이다. 조건은 details에 명시하고 가격을 추정하지 않는다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 contained 계열이므로 full-bleed 사이의 완충 섹션으로 조성할 수 있다.
- (b) 토큰: 표면·텍스트·선, 행동색, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 원본의 값은 복사하지 않는다.
- (c) 다른 모듈: 없음(독립). 조성 시 타입·기본 레이아웃의 중복은 COMPOSITION-GRAMMAR로 점검한다.

## 3. 변경 파급

- 슬롯을 바꾸면 → 필수 슬롯 `headline`, `pricePlans`와 `module.json`, template 앵커, SECTION-SCHEMA를 함께 검토해야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/pricing/pricing-plan-grid` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 해당 CSS의 grid/표면 관계와 조성의 인접 다양성·이음새 규칙을 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark·제목 계층·semantic 토큰 소비를 함께 검토해야 한다. SECTION-SCHEMA의 슬롯/축 표를 바꾸는 경우는 이 모듈 밖의 스키마 개정 사안이다.

## 4. 코치 코멘트

- raw 색·원시 간격 단위를 "더 정확한 재현"처럼 넣지 말 것. 이 모듈은 source style 값을 복사하지 않고 semantic 토큰만 소비한다.
- 컬렉션 슬롯은 반복 항목이 아니라 컨테이너 하나에만 `data-slot`을 둔다. 항목마다 같은 슬롯 앵커를 추가하지 말 것.
- `motion: none`은 정적 관찰에서 동작을 주장하지 않기 위한 기본값이다. 모션을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.
- 기록된 confidence와 recordId는 실제 세그먼트 관찰값이다. 더 높은 confidence나 다른 source를 임의로 기입하지 말 것.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/pricing--pricing-plan-grid/

## 6. 출처

- provenance: `mined`
- recordId: `posthog`
- span order: `9`
- sectionSpan: `captures/stage2/posthog/tile_00.png#pricing`
- variantProvenance: `structure-mined`
- 보조 구조 관찰: 없음 — 이 변형은 주 출처의 명시된 구조 관찰만으로 생성했다.
- 범위: 구조 관찰과 style inventory의 semantic 역할 매핑만. 픽셀·카피·브랜드 요소 복제 아님.
