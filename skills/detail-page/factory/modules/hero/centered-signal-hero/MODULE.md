# centered-signal-hero

타입: `hero` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-media-v1`

## 1. 왜 이 방식인가

핵심 주장·보조 설명·주 행동을 중앙의 하나의 읽기 축에 놓고, 미디어를 그 아래의 독립 검토면으로 분리한다. 좌우 분할은 좁은 폭에서 주장과 행동을 갈라 읽게 하므로 이 변형에서는 배제했다. 카탈로그에서 중앙 신호형 hero 역할을 맡는다.

출처 타일에서 확인한 범위: 중앙에 큰 주장과 보조 설명·행동이 모이고, 배경의 시각 신호가 이를 보조하는 opening 구조를 관찰했다. 기본값은 `centered` · `surface-contained`이며, 원본의 카피·브랜드·픽셀 값을 옮기지 않고 슬롯과 semantic 토큰으로 일반화했다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 contained 계열이므로 full-bleed 사이의 완충 섹션으로 조성할 수 있다.
- (b) 토큰: 표면·텍스트·선, 행동색, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 출처 스타일 인벤토리는 밝기 역할과 타이포·여백·반경·그림자 관찰의 존재만 semantic 역할로 매핑했고, 원본 값은 복사하지 않았다.
- (c) 다른 모듈: 없음(독립). 조성 시 같은 `hero`·`centered` 조합은 한 번만 둘 수 있다.

## 3. 변경 파급

- 슬롯을 바꾸면 → `media`는 hero의 필수 슬롯이므로 삭제할 수 없다 — 슬롯을 바꾸려면 `module.json`, template 앵커, SECTION-SCHEMA를 함께 검토하고 `section-validate` + 해당 조성의 `grammar-lint` + 시각 검토를 다시 실행한다.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 해당 CSS의 grid/표면 관계와 조성의 인접 다양성·이음새 규칙을 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/hero/centered-signal-hero` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → template의 landmark·제목 계층·semantic 토큰 소비를 함께 검토해야 한다. 재검증: `section-validate.js` + 조성의 `grammar-lint.js` + 호스트 토큰셋을 주입한 시각 검토. SECTION-SCHEMA의 슬롯/축 표를 바꾸는 경우는 이 모듈 밖의 스키마 개정 사안이다.

## 4. 코치 코멘트

- raw 색·원시 간격 단위를 "더 정확한 재현"처럼 넣지 말 것. 이 모듈은 source style 값을 복사하지 않고 semantic 토큰만 소비하도록 채굴됐다.
- 미디어는 현재 중립 placeholder다. 실제 자산을 넣을 때 `mediaAlt` 값을 함께 전달해야 하며, 자산 없이 템플릿을 공개하면 placeholder가 그대로 보인다.
- `mediaAlt`는 role=img placeholder의 접근 가능한 이름과 `data-slot-aria-label`에 함께 연결된다. 실제 렌더러는 이 marker를 따라 주입값으로 aria-label을 갱신해야 한다.
- `motion: none`은 정적 캡처에서 관찰하지 못한 동작을 주장하지 않기 위한 기본값이다. 모션을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.
- headline은 `h1`이다. 한 페이지에서 hero를 둘 이상 두면 제목 계층을 사람이 별도로 점검해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/hero--centered-signal-hero/

## 6. 출처

- recordId: `clerk`
- span order: `2`
- sectionSpan: `captures/stage2/clerk/tile_00.png#hero`
- 보조 구조 관찰: 없음 — 이 변형은 주 출처의 명시된 구조 관찰만으로 생성했다.
- 범위: 구조 관찰과 style inventory의 semantic 역할 매핑만. 픽셀·카피·브랜드 요소 복제 아님.
