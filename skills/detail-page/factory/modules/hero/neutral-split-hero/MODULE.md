# neutral-split-hero

타입: `hero` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-media-v1`

## 1. 왜 이 방식인가

hero 타입의 필수 파트(맥락·핵심 주장·보조 설명·주 CTA·미디어)를 2컬럼 `split`로 풀었다: 좌측에 카피 스택(eyebrow → headline → body → CTA), 우측에 미디어 figure. 첫 화면에서 주장과 시각 근거를 동시에 노출하되, DOM 순서는 카피가 먼저라 읽기 순서(스크린리더 포함)는 항상 주장 → 미디어다. `centered`(카피만 중앙)는 미디어를 스크롤 아래로 밀어 hero의 "미디어 영역" 필수 파트가 약해지므로 배제했다.

기본 축을 `surface-contained · standard · none · typographic`으로 잡은 이유: 이 모듈은 카탈로그의 **hero 기준형**이다. 가장 제약 없는 조합을 기본값으로 두어, 이후 hero 변형 모듈들이 이 모듈 대비 "무엇이 다른가"로 정의되게 한다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. 조성 시 hero는 관례상 첫 섹션이며 headline이 `h1`이다 — 페이지당 h1은 1개라는 전제가 이 모듈에 박혀 있다(§4 참조).
- (b) 토큰: 표면·텍스트·선 범주 전반, 행동색은 `--color-accent`/`--color-on-accent`(주 CTA)만, 글꼴 3성부 중 display+body, 여백·활자·radius·shadow 스케일. 특이 소비: 미디어 테두리 두께로 `--space-4`를 쓴다(§4의 raw px 금지 우회 관례).
- (c) 다른 모듈: 없음(독립). 미디어 자산은 `media` 슬롯으로 주입될 뿐 모듈이 자산을 소유하지 않는다.

## 3. 변경 파급

- 슬롯을 추가/삭제하면 → `module.json.slots`와 `template.html`의 `data-slot` 앵커를 **양방향으로** 함께 고쳐야 한다(검증기가 양방향 정합을 검사). `media`는 hero 타입의 최소 필수 슬롯이라 삭제 불가 — 삭제하려면 타입 재분류(SECTION-SCHEMA 표 개정) 사안이다. 재검증: `node v3/scripts/section-validate.js v3/modules/hero/neutral-split-hero`.
- `layoutArchetype` 기본값을 바꾸면 → CSS의 `grid-template-columns` 2컬럼 정의를 함께 바꿔야 한다(축 값과 CSS는 자동 동기화되지 않음). 이 모듈을 참조하는 조성의 인접 다양성도 변하므로 해당 fixture에 `grammar-lint` 재실행.
- `motion`을 `none` 이외로 바꾸면 → `prefers-reduced-motion` 처리 추가 + `gateProfile`을 `section-motion-v1` 계열로 재검토해야 한다(현재는 `section-media-v1`).
- 슬롯 길이 범위(headline 8–72자 등)는 SECTION-SCHEMA 공용 슬롯 표가 원천 — 이 모듈에서 단독 변경 금지, 스키마 개정으로만.

## 4. 코치 코멘트

- 테두리·보더 두께에 `--space-4`를 쓴 것은 raw `px` 금지 계약 때문이다. "여백 토큰 오용"으로 보고 `4px`나 `1px`로 고치면 검증기가 막는다.
- `mediaAlt`는 placeholder div의 `data-slot`으로 앵커되어 있고 지금은 `aria-label`이 정적이다. 실제 렌더러가 `media` 자산을 주입할 때 alt 텍스트 배선을 이 슬롯 값으로 교체해야 한다 — 렌더러 계약은 미정(S4 사안), 현재는 앵커만 보장된다.
- headline이 `h1`이므로 이 모듈을 페이지 중간에 배치하거나 한 페이지에 두 번 쓰면 제목 계층이 깨진다. `grammar-lint`는 제목 계층을 검사하지 않는다 — **기계 게이트 미커버 지점**이므로 조성 시 사람이 확인해야 한다.
- 반응형 미정: 2컬럼 grid는 좁은 뷰포트 붕괴 처리(미디어쿼리)가 없다. v1 범위 밖으로 의도된 공백이며, 변형 제작 시 여기부터 확인할 것. 미검증 — 실기기/뷰포트 렌더 확인 전까지 데스크톱 기준으로만 취급.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/hero--neutral-split-hero/

## 6. 출처

- recordId: `supabase`
- sectionSpan: `captures/stage2/supabase/tile_00.png#hero`
- 범위: "좌 카피 스택 + 우 미디어의 2분할 hero"라는 구조 관찰만. 픽셀·카피·브랜드 요소 복제 아님.
