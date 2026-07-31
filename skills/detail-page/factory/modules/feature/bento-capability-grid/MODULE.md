# bento-capability-grid

타입: feature · 규격: SECTION-SCHEMA 1.0.0 · 게이트: section-baseline-v1

## 1. 왜 이 방식인가

제목과 설명을 먼저 읽은 뒤, 크기가 다른 카드 묶음에서 각 기능 항목을 병렬로 살피게 한다. rail은 앞 항목부터 순서가 있는 것처럼 읽히므로, 여러 항목의 우선순위를 정하지 않는 이 구조에서는 배제했다. compact grid와 card-contained 기본값은 한 면 안에서 카드의 경계를 유지한다. 카탈로그에서는 밀도 높은 기능 묶음 변형을 맡는다.

확인한 타일에는 도입부 아래에 크기가 다른 다수의 기능 카드가 놓인다. 이 모듈은 그 배치와 위계만 일반화했고, 원본의 문구·브랜드·실측값은 옮기지 않았다.

### 컬렉션 아이템 구조

- featureItems의 아이템은 { title: string, description: string }이다. title은 항목 이름, description은 항목을 독립적으로 이해하게 하는 짧은 설명이다.
- 렌더러는 data-slot="featureItems"가 붙은 목록 안에 아이템당 li 하나를 만든다. 기본 더미의 시각 면은 구조 표시용이며 아이템 데이터가 아니다.
- 아이템 수는 2개부터 8개까지다. 첫 아이템을 넓게 보이게 하는 것은 기본 렌더 예시이며, 실제 항목 순서를 우선순위로 해석하지 않는다.

## 2. 의존

- (a) 규격: schemaVersion 1.0.0. COMPOSITION-GRAMMAR의 같은 (type, layoutArchetype) 조합 한 번 규칙과 인접 섹션 layoutArchetype 차이 규칙에 민감하다.
- (b) 토큰: 표면·텍스트·선, primary 저강조색, display/body 글꼴, 여백·활자·반경·그림자 범주를 소비한다. 카드 테두리도 semantic 여백 토큰으로 표현한다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- featureItems 아이템 필드를 바꾸면 → 컬렉션 아이템 구조와 목록 렌더러를 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/bento-capability-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- layoutArchetype 또는 density 기본값을 바꾸면 → 카드 grid와 넓은 카드 규칙을 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/bento-capability-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark, 제목 계층, semantic 토큰 소비를 함께 검토한다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/bento-capability-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토. SECTION-SCHEMA의 슬롯이나 축을 바꾸는 일은 이 모듈 밖의 스키마 개정이다.

## 4. 코치 코멘트

- data-slot="featureItems"는 반복 항목이 아니라 목록 컨테이너 하나에만 둔다. 각 li에 같은 앵커를 추가하면 컬렉션 계약과 맞지 않는다.
- 넓은 첫 카드가 기본 더미에 있어도, 주입 순서에 기능 우선순위를 넣지 않는다. 순서 의미가 필요하면 이 모듈을 변형하지 말고 다른 구조를 사용한다.
- 더 정확한 재현을 위해 원시 색이나 원시 길이를 넣지 않는다. SECTION-SCHEMA의 semantic 토큰 계약은 우회할 수 없다.
- motion은 none이다. 동작을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/feature--bento-capability-grid/

## 6. 출처

- provenance: `mined`
- recordId: clerk
- span order: 18 · confidence: med
- sectionSpan: captures/stage2/clerk/tile_01.png#feature
- 범위: 확인된 타일의 카드 배치·위계·섹션 역할만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
