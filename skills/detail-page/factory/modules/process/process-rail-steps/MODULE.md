# process-rail-steps

타입: `process` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-motion-v1`

## 1. 왜 이 방식인가

순서화된 단계를 가로 검토 rail로 정리해 각 단계의 설명 폭을 통제한다.

프로파일 해부 앵커: `process-title` · `ordered-steps` · `next-action`. process 스팬의 희소성을 구조 근거로 과장하지 않고 SECTION-SCHEMA의 순서화된 단계 계약만으로 작성한다. 기본값은 `rail` · `contrast-bleed`이며, 슬롯과 semantic 토큰으로만 일반화한다.

## 컬렉션 아이템 구조

- `processSteps`의 항목은 `{ "title": string, "body": string }`이다. 렌더러는 입력 순서를 바꾸지 않고 번호를 붙인다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 full-bleed 계열이므로 COMPOSITION-GRAMMAR의 full-bleed 연속 금지와 전체 비율 상한에 특히 민감하다.
- (b) 토큰: 표면·텍스트·선, 행동색, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 원본의 값은 복사하지 않는다.
- (c) 다른 모듈: 없음(독립). 조성 시 타입·기본 레이아웃의 중복은 COMPOSITION-GRAMMAR로 점검한다.

## 3. 변경 파급

- 슬롯을 바꾸면 → 필수 슬롯 `headline`, `processSteps`와 `module.json`, template 앵커, SECTION-SCHEMA를 함께 검토해야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/process/process-rail-steps` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 해당 CSS의 grid/표면 관계와 조성의 인접 다양성·이음새 규칙을 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark·제목 계층·semantic 토큰 소비를 함께 검토해야 한다. SECTION-SCHEMA의 슬롯/축 표를 바꾸는 경우는 이 모듈 밖의 스키마 개정 사안이다.

## 4. 코치 코멘트

- raw 색·원시 간격 단위를 "더 정확한 재현"처럼 넣지 말 것. 이 모듈은 source style 값을 복사하지 않고 semantic 토큰만 소비한다.
- 컬렉션 슬롯은 반복 항목이 아니라 컨테이너 하나에만 `data-slot`을 둔다. 항목마다 같은 슬롯 앵커를 추가하지 말 것.
- `motion: none`은 정적 관찰에서 동작을 주장하지 않기 위한 기본값이다. 모션을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.
- 이 모듈은 코퍼스 출처가 없는 schema-authored 결과다. `recordId: schema`를 실제 사이트·캡처 출처처럼 바꾸거나 해석하지 말 것.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/process--process-rail-steps/

## 6. 출처

- provenance: `schema-authored`
- variantProvenance: `schema-authored`
- recordId: `schema` (코퍼스 레코드가 아님)
- sectionSpan: `v3/SECTION-SCHEMA.md#process`
- 범위: comparison/process/cta의 희박한 스팬을 코퍼스 근거로 과장하지 않고, SECTION-SCHEMA의 타입·슬롯·변형축 계약만으로 구성했다. 픽셀·카피·브랜드 요소나 존재하지 않는 코퍼스 출처를 주장하지 않는다.
