# feature-matrix-grid

타입: feature · 규격: SECTION-SCHEMA 1.0.0 · 게이트: section-baseline-v1

## 1. 왜 이 방식인가

도입부를 두 칼럼으로 짧게 나눈 뒤, 정보 밀도가 다른 카드 matrix에서 기능 항목을 병렬로 읽게 한다. rail은 항목을 시간 순서처럼 보이게 하므로, 항목 간 선택 기준을 강제하지 않는 이 구조에서는 배제했다. standard grid와 surface-contained 기본값은 페이지의 기본 표면 안에서 비교 가능한 카드 단위를 유지한다. 카탈로그에서는 정보 밀도형 기능 matrix 변형을 맡는다.

확인한 타일에는 서로 다른 크기의 카드와 각 카드 안의 작은 시각 면이 한 grid로 놓인다. 이 모듈은 그 카드 관계와 위계만 일반화했고, 원본의 문구·브랜드·실측값은 옮기지 않았다.

### 컬렉션 아이템 구조

- featureItems의 아이템은 { title: string, description: string }이다. title은 기능 이름, description은 기능을 비교 가능한 단위로 설명하는 문장이다.
- 렌더러는 data-slot="featureItems"가 붙은 목록 안에 아이템당 li 하나를 만든다. 기본 더미의 작은 시각 면은 구조 표시용이며 아이템 데이터가 아니다.
- 아이템 수는 2개부터 8개까지다. lead 카드의 넓이는 기본 예시의 위계일 뿐, 데이터에 없는 수치나 상태를 암시하지 않는다.

## 2. 의존

- (a) 규격: schemaVersion 1.0.0. COMPOSITION-GRAMMAR의 같은 (type, layoutArchetype) 조합 한 번 규칙과 인접 섹션 layoutArchetype 차이 규칙에 민감하다.
- (b) 토큰: 표면·텍스트·선, primary 저강조색, accent 저강조색, display/body 글꼴, 여백·활자·반경·그림자 범주를 소비한다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- featureItems 아이템 필드를 바꾸면 → 컬렉션 아이템 구조와 matrix 반복 렌더러를 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-matrix-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- layoutArchetype 또는 backgroundBleed 기본값을 바꾸면 → 카드 matrix와 표면 관계를 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-matrix-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark, 제목 계층, semantic 토큰 소비를 함께 검토한다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-matrix-grid, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토. SECTION-SCHEMA의 슬롯이나 축을 바꾸는 일은 이 모듈 밖의 스키마 개정이다.

## 4. 코치 코멘트

- data-slot="featureItems"는 matrix 목록 컨테이너 하나에만 둔다. 반복 li마다 같은 앵커를 넣으면 컬렉션 계약과 맞지 않는다.
- lead 카드를 다른 모든 카드보다 크게 만들더라도, 아이템 데이터에 없는 우선순위나 성과 수치를 추가하지 않는다.
- 이 모듈은 bento-capability-grid와 같은 feature·grid 조합이다. 한 조성에서 둘을 같이 쓰면 grammar-lint의 반복 상한을 넘는다.
- motion은 none이다. 동작을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/feature--feature-matrix-grid/

## 6. 출처

- provenance: `mined`
- recordId: supabase
- span order: 12 · confidence: med
- sectionSpan: captures/stage2/supabase/tile_00.png#feature
- 범위: 확인된 타일의 카드 matrix·작은 시각 면·섹션 역할만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
