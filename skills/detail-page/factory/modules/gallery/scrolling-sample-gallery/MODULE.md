# scrolling-sample-gallery

타입: `gallery` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

제목 아래에 가로 rail을 두어, 한 번에 모두 보이지 않는 항목을 같은 크기의 연속된 검토면으로 다룬다. `grid`는 모든 항목을 같은 화면에 고정하므로, 다음 항목으로 이어지는 탐색 관계를 표현하는 이 변형에서는 배제했다. `contrast-bleed`는 rail의 범위를 주변 contained 섹션과 분리한다. 카탈로그에서는 순차 열람용 gallery 변형을 맡는다.

확인된 타일에는 같은 높이의 시각 카드가 가로로 이어지고 다음 항목으로 이동하는 제어가 보인다. 이 모듈은 그 이동 관계만 일반화하며, 원본의 제어 모양·문구·자산은 가져오지 않는다.

## 컬렉션 아이템 구조

- `galleryItems`의 아이템은 `{ "label": string, "mediaAlt": string, "caption": string }`이다. 세 필드는 모두 필요하며, `mediaAlt`는 전달하는 시각 자료의 실제 대체 설명이다.
- 렌더러는 `data-slot="galleryItems"`가 붙은 목록 안에 아이템당 `li` 하나를 생성한다. rail은 항목 순서를 보존하지만, 그 순서가 중요도나 추천을 뜻하지는 않는다.
- 가로 이동을 제공하는 조립 환경은 키보드와 보조 기술로 각 항목에 도달할 수 있게 해야 한다. 이 템플릿은 중립 placeholder만 제공한다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값 `contrast-bleed`는 full-bleed이므로 앞뒤에 full-bleed를 연속해 둘 수 없고, 전체 비율 상한의 영향을 받는다. 같은 페이지에서 `gallery`·`rail` 조합은 한 번만 허용된다.
- (b) 토큰: 반전 표면·텍스트·선, primary의 밝은 역할, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 이동 감각은 레이아웃으로만 만들며 모션 토큰은 소비하지 않는다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- `galleryItems` 아이템 필드를 바꾸면 → 이 문서의 컬렉션 계약과 rail 렌더러를 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/gallery/scrolling-sample-gallery` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → grid 자동 흐름, overflow, 반전 표면 관계를 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 카드 폭 또는 이동 방식을 바꾸면 → 좁은 폭에서의 항목 도달성, 마지막 항목 노출, `mediaAlt` 전달을 함께 점검해야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.

## 4. 코치 코멘트

- `scroll-snap`은 자동 재생이나 동작 주장이 아니다. `motion: none`을 바꾸지 않는 한 시간 기반 전환을 추가하지 않는다.
- 컬렉션 앵커는 rail 컨테이너에만 둔다. 반복 카드 내부에 같은 슬롯 앵커를 넣으면 주입 단위를 잃는다.
- 카드 테두리와 폭은 semantic 토큰으로만 정한다. 원시 색상이나 길이 리터럴을 추가하면 토큰 계약을 벗어난다.
- `headline`은 `h2`다. 페이지 첫 제목으로 조성할 때의 제목 계층은 별도 확인이 필요하다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/gallery--scrolling-sample-gallery/

## 6. 출처

- provenance: `mined`
- recordId: `raycast`
- span order: `6` · type: `gallery` · confidence: `high`
- sectionSpan: `captures/app-ui/raycast/tile_02.png#gallery`
- segment citation: `v3/segments/raycast.json` · `data.json#/headings/3` · `bodytext.txt:L325`
- 범위: gallery의 가로 연속 열람 관계와 확인된 타일의 동등 카드 관계만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
