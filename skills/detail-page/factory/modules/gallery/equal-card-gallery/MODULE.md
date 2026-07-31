# equal-card-gallery

타입: `gallery` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

제목 다음에 같은 위계의 카드 묶음을 놓아, 항목 사이에 순서나 우선순위를 만들지 않고 비교할 수 있게 했다. `rail`은 첫 항목에서 다음 항목으로 진행 방향을 만들기 때문에 이 동등 비교 변형에서는 배제했다. `card-contained`는 카드의 경계를 분명히 하되, 전체 섹션을 강한 배경 전환으로 만들지 않는다. 카탈로그에서는 동등 항목 비교용 gallery 변형을 맡는다.

확인된 타일에는 여러 개의 동등한 카드 면이 한 화면에 병렬로 보인다. 스팬은 gallery로 분류된 범위만 확정하며, 원본의 문구·자산·색 역할은 이 모듈에 옮기지 않았다.

## 컬렉션 아이템 구조

- `galleryItems`의 아이템은 `{ "label": string, "mediaAlt": string, "caption": string }`이다. 세 필드는 모두 필요하며, `mediaAlt`는 전달하는 시각 자료의 실제 대체 설명이다.
- 렌더러는 `data-slot="galleryItems"`가 붙은 목록 안에 아이템당 `li` 하나를 생성한다. `label`은 항목의 짧은 식별, `caption`은 짧은 보조 설명으로 렌더하고, `mediaAlt`는 시각 요소의 접근 가능한 이름에 넣는다.
- 중립 더미는 구조 확인용이다. 실제 시각 자료가 없으면 그 사실을 설명하는 대체 설명을 유지하고, 다른 출처의 자산으로 대신 채우지 않는다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 `card-contained`이므로 full-bleed 섹션 사이의 완충으로 조성할 수 있다. 같은 페이지에서 `gallery`·`grid` 조합은 한 번만 허용하는 COMPOSITION-GRAMMAR 규칙의 영향을 받는다.
- (b) 토큰: 표면·텍스트·선, primary의 옅은 표면 역할, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 원본 값은 소비하지 않는다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- `galleryItems` 아이템 필드를 바꾸면 → 이 문서의 컬렉션 계약과 목록 렌더러를 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/gallery/equal-card-gallery` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 카드 grid와 표면 관계를 함께 바꿔야 한다. 축 값과 CSS는 자동 동기화되지 않는다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 시각 placeholder 또는 카드 경계를 바꾸면 → `mediaAlt` 전달 위치와 semantic 토큰 소비를 함께 점검해야 한다. SECTION-SCHEMA 슬롯 표 변경은 이 모듈 밖의 스키마 개정 사안이다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.

## 4. 코치 코멘트

- 컬렉션 앵커는 반복 항목이 아니라 목록 컨테이너에만 둔다. 항목마다 같은 `data-slot`을 추가하면 컬렉션 주입 범위가 불명확해진다.
- 대체 설명은 `label`이나 `caption`으로 대체하지 않는다. 실제 시각 요소의 접근 가능한 이름에 `mediaAlt`를 전달해야 한다.
- 카드 테두리는 원시 길이 값 대신 `--space-4`를 쓴다. 이 계약을 임의의 길이 리터럴로 바꾸면 토큰 검증을 통과하지 못한다.
- `headline`은 `h2`다. 이 모듈을 페이지 첫 제목으로 쓰면 제목 계층은 조성 단계에서 별도로 확인해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/gallery--equal-card-gallery/

## 6. 출처

- provenance: `mined`
- recordId: `supabase`
- span order: `13` · type: `gallery` · confidence: `high`
- sectionSpan: `captures/stage2/supabase/tile_00.png#gallery`
- segment citation: `v3/segments/supabase.json` · `data.json#/headings/10` · `bodytext.txt:L89`
- 범위: gallery의 동등 항목 묶음이라는 구조 관찰과 확인된 타일의 병렬 관계만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
