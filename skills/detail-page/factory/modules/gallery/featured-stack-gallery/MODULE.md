# featured-stack-gallery

타입: `gallery` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

첫 항목을 넓은 검토면으로 두고 뒤의 관련 항목을 세로로 이어, 한 항목을 먼저 살핀 뒤 같은 묶음을 계속 읽는 순서를 만든다. `grid`는 모든 항목을 같은 위계로 만들기 때문에 이 강조형 변형에서는 배제했다. `media-bleed`는 시각 자료가 섹션의 주된 면이라는 조성 신호이며, 실제 자산의 색이나 재질을 뜻하지 않는다. 카탈로그에서는 선행 검토가 필요한 gallery 변형을 맡는다.

이 스팬은 관련 항목의 gallery 범위를 확정한다. 수직 오프셋에는 하위 레이아웃 주석이 없으므로, 첫 항목을 강조하는 stack은 검증 가능한 source claim이 아니라 이 모듈의 명시적 일반화다.

## 컬렉션 아이템 구조

- `galleryItems`의 아이템은 `{ "label": string, "mediaAlt": string, "caption": string, "emphasis": "featured" | "standard" }`이다. `label`, `mediaAlt`, `caption`은 필요하고, `emphasis`가 없으면 `standard`로 해석한다.
- 렌더러는 `data-slot="galleryItems"`가 붙은 목록 안에 아이템당 `li` 하나를 생성한다. `featured`는 최대 한 개여야 하며, 있으면 첫 번째로 놓는다.
- `mediaAlt`는 실제 시각 요소의 접근 가능한 이름에 전달한다. 시각 자료를 제공하지 못하면 내용과 일치하는 대체 설명을 남긴다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값 `media-bleed`는 full-bleed이므로 앞뒤 full-bleed 연속 금지와 전체 비율 상한의 영향을 받는다. 같은 페이지에서 `gallery`·`stack` 조합은 한 번만 허용된다.
- (b) 토큰: 표면·텍스트·선, primary의 밝은 표면 역할, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. `emphasis`는 색을 새로 정의하지 않고 공간과 시각 면의 크기만 바꾼다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- `galleryItems`의 `emphasis` 규칙을 바꾸면 → 이 문서의 컬렉션 계약, 첫 항목 배치, 최대 한 개 제약을 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/gallery/featured-stack-gallery` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 세로 읽기 순서, 첫 시각 면 크기, full-bleed 이음새를 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 강조 면의 크기나 placeholder를 바꾸면 → 실제 자산이 없을 때의 `mediaAlt` 전달과 다음 항목의 시각 위계를 함께 점검해야 한다. SECTION-SCHEMA 슬롯 표 변경은 이 모듈 밖의 스키마 개정 사안이다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.

## 4. 코치 코멘트

- `featured`는 최대 한 개다. 여러 항목을 모두 강조하면 이 모듈의 선행 검토 순서가 사라지므로, 다른 gallery 변형을 사용한다.
- source span은 gallery 타입만 확정한다. 이 변형의 강조 위계를 원본이 그대로 사용했다고 서술하거나 렌더하지 않는다.
- 컬렉션 앵커는 목록 컨테이너 하나에만 둔다. 각 placeholder의 접근 가능한 이름은 반복 렌더러가 `mediaAlt`로 갱신해야 한다.
- 배경·경계·시각 면은 semantic 토큰으로만 소비한다. 원시 색상이나 길이 리터럴을 더하면 토큰 계약을 벗어난다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/gallery--featured-stack-gallery/

## 6. 출처

- provenance: `mined`
- recordId: `kr-detail-29cm-hata-3989017`
- span order: `19` · type: `gallery` · confidence: `high`
- sectionSpan: `captures/kr-detail-29cm-3989017/tile_08.png#gallery`
- segment citation: `v3/segments/kr-detail-29cm-hata-3989017.json` · `data.json#/headings/16` · `bodytext.txt:L334`
- 범위: 관련 항목을 gallery로 묶는 구조 관찰만 가져왔다. 강조형 stack은 명시된 일반화이며, 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
