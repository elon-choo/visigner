# integration-rail

타입: feature · 규격: SECTION-SCHEMA 1.0.0 · 게이트: section-baseline-v1

## 1. 왜 이 방식인가

중앙의 도입부 뒤에 수평 rail로 관련 항목을 놓고, 그 아래에 하나의 보조 표면을 둔다. grid는 모든 항목을 한 화면에 고정하려 하므로 작은 폭에서 선택지가 과도하게 줄어든다. rail은 항목을 같은 형식으로 유지하면서 필요한 만큼 가로로 이어 읽게 한다. airy와 contrast-bleed 기본값은 도입과 항목 묶음을 한 개의 어두운 면으로 분리한다. 카탈로그에서는 가로 선택지 묶음 변형을 맡는다.

확인한 타일에는 중앙 도입부, 가로로 이어진 작은 항목 표지, 큰 보조 표면이 차례로 보인다. 이 모듈은 그 읽기 순서와 영역 관계만 일반화했고, 원본의 문구·브랜드·실측값은 옮기지 않았다.

### 컬렉션 아이템 구조

- featureItems의 아이템은 { title: string, description: string }이다. title은 짧은 항목 이름, description은 항목의 중립 설명이다.
- 렌더러는 data-slot="featureItems"가 붙은 목록 안에 아이템당 li 하나를 가로 순서로 만든다.
- 아이템 수는 2개부터 8개까지다. rail의 표시 순서는 렌더 순서일 뿐, 더 앞의 항목이 더 중요한 것을 뜻하지 않는다.

## 2. 의존

- (a) 규격: schemaVersion 1.0.0. contrast-bleed는 COMPOSITION-GRAMMAR의 full-bleed 연속 금지와 전체 비율 상한에 특히 민감하다. rail은 같은 (type, layoutArchetype) 조합으로 한 조성에 한 번만 둘 수 있다.
- (b) 토큰: 반전 표면·텍스트·선, primary 저강조색, accent 표지색, display/body 글꼴, 여백·활자·반경·그림자 범주를 소비한다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- featureItems 아이템 필드를 바꾸면 → 컬렉션 아이템 구조와 rail 반복 렌더러를 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/integration-rail, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- backgroundBleed 또는 layoutArchetype 기본값을 바꾸면 → 반전 표면 CSS와 rail의 overflow 규칙을 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/integration-rail, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark, 제목 계층, semantic 토큰 소비를 함께 검토한다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/integration-rail, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토. SECTION-SCHEMA의 슬롯이나 축을 바꾸는 일은 이 모듈 밖의 스키마 개정이다.

## 4. 코치 코멘트

- data-slot="featureItems"는 rail 컨테이너 하나에만 둔다. 반복 li마다 같은 앵커를 넣으면 컬렉션 계약과 맞지 않는다.
- rail의 가로 overflow는 의도된 읽기 경로다. 항목을 강제로 한 줄에 맞추기 위해 최소 폭을 제거하면 작은 화면에서 항목 내용이 무너진다.
- contrast-bleed 뒤에는 다른 full-bleed를 바로 둘 수 없다. 조성에서 다음 섹션의 backgroundBleed를 함께 확인한다.
- motion은 none이다. 동작을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/feature--integration-rail/

## 6. 출처

- provenance: `mined`
- recordId: resend
- span order: 12 · confidence: med
- sectionSpan: captures/stage2/resend/tile_01.png#feature
- 범위: 확인된 타일의 도입부·가로 항목·보조 표면의 배치와 역할만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
