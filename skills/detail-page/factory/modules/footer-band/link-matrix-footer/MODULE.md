# link-matrix-footer

타입: `footer-band` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

연락·운영 경로를 한 쪽에 묶고, 여러 탐색 묶음을 동등한 link matrix로 둔다. 단일 stack은 탐색 묶음 사이의 구분을 약하게 하므로 배제했다. 카탈로그에서 넓은 말단 탐색을 담당하는 footer-band 역할을 맡는다.

출처 타일에서 확인한 범위: 말단에 연락 경로, 복수 탐색 묶음, 법적 문구가 함께 있는 matrix 구조를 관찰했다. 기본값은 `grid` · `contrast-bleed`이며, 원본의 카피·브랜드·픽셀 값을 옮기지 않고 슬롯과 semantic 토큰으로 일반화했다.

## 컬렉션 아이템 구조

- `navItems`의 아이템은 `{ "groupLabel": string, "links": [{ "label": string, "href": string }] }` 형태다. `groupLabel`은 짧은 탐색 묶음 이름이고, `links`는 한 개 이상의 중립 탐색 경로다.
- 렌더러는 `data-slot="navItems"`가 붙은 목록 안에 아이템 하나당 `li` 하나를 반복 생성한다. groupLabel과 links가 없으면 해당 아이템을 렌더하지 않는다.
- 연락 행동은 컬렉션이 아니라 선택 `contactLabel` 슬롯으로만 주입한다. 목적지는 조립 환경의 링크 정책이 정하며 이 모듈은 별도 URL 슬롯을 만들지 않는다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 기본값이 full-bleed이므로 COMPOSITION-GRAMMAR의 full-bleed 연속 금지와 전체 비율 상한에 특히 민감하다.
- (b) 토큰: 표면·텍스트·선, 행동색, display/body 글꼴, 여백·활자·반경·그림자 semantic 범주를 소비한다. 출처 스타일 인벤토리는 밝기 역할과 타이포·여백·반경·그림자 관찰의 존재만 semantic 역할로 매핑했고, 원본 값은 복사하지 않았다.
- (c) 다른 모듈: 없음(독립). 조성 시 같은 `footer-band`·`grid` 조합은 한 번만 둘 수 있다.

## 3. 변경 파급

- 슬롯을 바꾸면 → `navItems` 또는 `legalText`는 footer-band의 필수 슬롯이므로 삭제할 수 없다 — 슬롯을 바꾸려면 `module.json`, template 앵커, SECTION-SCHEMA를 함께 검토하고 `section-validate` + 해당 조성의 `grammar-lint` + 시각 검토를 다시 실행한다.
- `layoutArchetype` 또는 `backgroundBleed` 기본값을 바꾸면 → 해당 CSS의 grid/표면 관계와 조성의 인접 다양성·이음새 규칙을 함께 바꿔야 한다. 재검증: `node v3/scripts/section-validate.js v3/modules/footer-band/link-matrix-footer` + `node v3/scripts/grammar-lint.js <composition.json>` + 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → template의 landmark·제목 계층·semantic 토큰 소비를 함께 검토해야 한다. 재검증: `section-validate.js` + 조성의 `grammar-lint.js` + 호스트 토큰셋을 주입한 시각 검토. SECTION-SCHEMA의 슬롯/축 표를 바꾸는 경우는 이 모듈 밖의 스키마 개정 사안이다.

## 4. 코치 코멘트

- raw 색·원시 간격 단위를 "더 정확한 재현"처럼 넣지 말 것. 이 모듈은 source style 값을 복사하지 않고 semantic 토큰만 소비하도록 채굴됐다.
- navItems는 묶음 컨테이너 하나에 앵커되어 있다. 반복 항목마다 `data-slot`을 추가하면 슬롯 계약의 단일 컨테이너 규칙을 흐릴 수 있으므로 추가하지 말 것.
- `contactLabel`에는 목적지 슬롯이 없다. 현재 mailto 주소는 의도적으로 무효인 중립 placeholder이므로, 실제 공개 전에는 조립 환경에서 승인된 연락 경로로 교체해야 한다.
- `motion: none`은 정적 캡처에서 관찰하지 못한 동작을 주장하지 않기 위한 기본값이다. 모션을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.
- legalText는 마지막 법적 행이다. 탐색 링크를 법적 문구에 섞으면 navigation과 legalText의 역할 구분이 사라진다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/footer-band--link-matrix-footer/

## 6. 출처

- recordId: `railway`
- span order: `14`
- sectionSpan: `captures/stage2/railway/tile_07.png#footer-band`
- 보조 구조 관찰: recordId: `arc` · span order: `4` · sectionSpan: `captures/stage2/arc/tile_03.png#footer-band`
- 범위: 구조 관찰과 style inventory의 semantic 역할 매핑만. 픽셀·카피·브랜드 요소 복제 아님.
