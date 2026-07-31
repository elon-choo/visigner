# uniform-tile-gallery

타입: `gallery` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

같은 비중의 타일을 한 줄에 반복해, 각 샘플의 시각 면과 짧은 캡션을 동일한 읽기 단위로 둔다. `rail`은 진행 방향을 만들고 일부 항목을 화면 밖으로 보내므로, 동시에 훑는 이 변형에서는 배제했다. `density: airy`는 제목과 타일 묶음 사이에 별도의 읽기 호흡을 둔다. 카탈로그에서는 균등 타일 열람용 gallery 변형을 맡는다.

확인된 타일에는 짧은 항목 설명과 동등한 크기의 시각 면이 반복되는 관계가 보인다. 스팬의 분류와 타일의 관계만 사용했으며, 원본의 자산·문구·색 역할은 일반화하지 않았다.

## 컬렉션 아이템 구조

- `galleryItems`의 아이템은 `{ "label": string, "mediaAlt": string, "caption": string }`이다. 세 필드는 모두 필요하며, `mediaAlt`는 전달하는 시각 자료의 실제 대체 설명이다.
- 렌더러는 `data-slot="galleryItems"`가 붙은 목록 안에 아이템당 `li` 하나를 생성한다. `label`은 항목 식별에, `caption`은 보조 문장에, `mediaAlt`는 시각 요소의 접근 가능한 이름에 사용한다.
- 아이템 수가 한 줄의 예시보다 많아져도 항목 우선순위를 CSS 순서로 바꾸지 않는다. 강조가 필요하면 별도 gallery 변형을 사용한다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. `surface-contained` 기본값은 full-bleed 사이의 완충으로 쓸 수 있다. 같은 페이지에서 `gallery`·`grid` 조합은 한 번만 허용된다.
- (b) 토큰: 표면·텍스트·선, primary의 옅은 표면 역할, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 항목별 색 배분은 collection 데이터로 우회하지 않는다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- `galleryItems` 아이템 필드를 바꾸면 → 이 문서의 컬렉션 계약과 목록 렌더러를 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/gallery/uniform-tile-gallery` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- `layoutArchetype` 또는 `density` 기본값을 바꾸면 → 타일 열의 균등 위계와 제목 사이 읽기 간격을 함께 바꿔야 한다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.
- 시각 면의 비율이나 경계를 바꾸면 → 좁은 폭의 타일 배치와 `mediaAlt` 전달을 함께 점검해야 한다. SECTION-SCHEMA 슬롯 표 변경은 이 모듈 밖의 스키마 개정 사안이다. 재검증: `section-validate.js` + `grammar-lint.js` + 시각 검토.

## 4. 코치 코멘트

- 균등 타일은 항목 순위를 표현하지 않는다. 첫 항목만 크게 하려면 이 모듈을 수정하지 말고 강조형 변형을 선택한다.
- `galleryItems`는 목록 컨테이너 하나에만 앵커링한다. 아이템 내부에 새 슬롯을 만들면 SECTION-SCHEMA와 함께 계약을 개정해야 한다.
- 시각 placeholder의 접근 가능한 이름에는 `mediaAlt`를 전달해야 한다. 캡션만 읽히는 상태는 대체 설명 전달이 아니다.
- 경계와 그림자는 semantic 토큰을 소비한다. 원시 색상이나 길이 리터럴로 바꾸면 모듈의 토큰 계약을 벗어난다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/gallery--uniform-tile-gallery/

## 6. 출처

- provenance: `mined`
- recordId: `ecommerce-teenage-engineering-ep-133`
- span order: `10` · type: `gallery` · confidence: `high`
- sectionSpan: `captures/ecommerce-teenage-engineering-ep-133/tile_00.png#gallery`
- segment citation: `v3/segments/ecommerce-teenage-engineering-ep-133.json` · `data.json#/headings/8` · `bodytext.txt:L95`
- 범위: gallery의 균등 항목 묶음과 확인된 타일의 반복 관계만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
