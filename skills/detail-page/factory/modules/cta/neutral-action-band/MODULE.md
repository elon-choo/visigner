# neutral-action-band

타입: `cta` · 규격: SECTION-SCHEMA `1.0.0` · 게이트: `section-baseline-v1`

## 1. 왜 이 방식인가

cta 타입의 필수 파트(행동 제목·짧은 설명·주 CTA)를 단일 칼럼 밴드로 풀고, `contrast-bleed`를 기본값으로 잡아 페이지에서 유일한 명도 반전 구간을 만든다 — 스크롤 말미에 "여기서 끝나고, 남은 행동은 이것 하나"라는 종결 신호를 배경 전환 자체로 준다. 행동 위계는 채움(primary: accent 배경) vs 테두리(secondary: 외곽선만)의 2단으로 고정해, 보조 경로가 있어도 주 행동이 흐려지지 않는다.

`density: airy`는 이 모듈이 콘텐츠가 아니라 결단의 공간이라는 선언이다 — 요소 수를 늘리는 변형(폼 삽입 등)은 이 모듈의 변형이 아니라 다른 cta 모듈이어야 한다. 카탈로그에서의 역할은 **cta 기준형**이다.

## 2. 의존

- (a) 규격: `schemaVersion 1.0.0`. **기본값이 `contrast-bleed`(full-bleed)라 이음새 규칙의 영향을 카탈로그 3종 중 가장 크게 받는다**: full-bleed 연속 금지(앞 섹션은 contained여야), 페이지당 full-bleed 개수 상한, 명도 전환 1단계 규칙. 조성 설계 시 이 모듈의 위치가 제약의 중심이 된다.
- (b) 토큰: 반전 배경으로 `--color-ink`, 반전 텍스트로 `--color-surface`를 쓴다(§4 참조). 저강조 텍스트는 `--color-primary-100`, secondary 테두리는 `--color-primary-300`, 주 행동은 `--color-accent`/`--color-on-accent`. 글꼴 display+body, 여백·활자 스케일, `--radius-md`. 그림자 소비 없음.
- (c) 다른 모듈: 없음(독립). 다만 조성 관례상 페이지 말단(footer-band 직전)에 놓인다.

## 3. 변경 파급

- `backgroundBleed` 기본값을 contained 계열로 바꾸면 → 색 반전 CSS(ink 배경/surface 텍스트/primary-100 저강조)를 통째로 함께 바꿔야 한다 — 축 값과 CSS는 자동 동기화되지 않으며, 이 모듈은 그 결합이 카탈로그에서 가장 강하다. 재검증: `section-validate` + 참조 조성 `grammar-lint`(full-bleed 개수·연속 규칙이 달라짐) + 시각 검토.
- `secondaryCtaLabel`/`secondaryCtaHref`를 삭제하면 → 템플릿의 앵커도 함께 제거해야 한다(선언 없는 앵커도 정합 위반). 재검증: `section-validate`.
- 행동 버튼을 3개 이상으로 늘리는 변경은 이 모듈의 개정이 아니라 **다른 모듈 신설**로 처리한다(§1의 단일 행동 선언이 이 모듈의 정체성이므로).

## 4. 코치 코멘트

- `layoutArchetype: centered`는 "페이지 축 위의 단일 칼럼 밴드"를 뜻한다. 텍스트 정렬은 좌측(`justify-items: start`)이다 — 축 값에서 `text-align: center`를 추론해 CSS를 "고치지" 말 것. 축은 구획 배치를 말하고, 정렬은 모듈의 시각 결정이다.
- 색 반전이 `--color-ink`를 배경으로 재사용하는 방식이므로, 토큰셋이 다크 기반으로 교체되면 반전이 사라지거나 뒤집힐 수 있다. 토큰의 실제 명도는 기계 게이트가 아니라 시각 검토 사안 — 토큰셋 교체 시 이 모듈을 최우선으로 눈 확인.
- `--color-primary-100`·`--color-primary-300`을 어두운 배경 위 저강조/테두리로 쓰는 것은 primary 스케일의 밝은 끝을 반전 문맥에서 빌리는 관례다. 미검증 — 실제 대비(가독성)는 렌더 확인 전까지 보장 못 한다.
- secondary 쌍은 선택 슬롯이지만 앵커는 존재한다. 값 미제공 시 요소 제거는 렌더러 계약 미정(S4) — 템플릿을 렌더러 없이 그대로 내보내면 더미 secondary 버튼이 노출된다.
- `headline`은 `h2`다. 이 모듈 단독 페이지(랜딩 최소형) 사용 시 제목 계층 확인 필요 — lint 미커버.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/cta--neutral-action-band/

## 6. 출처

- recordId: `linear`
- sectionSpan: `captures/app-ui/linear/tile_00.png#cta`
- 범위: "말미의 명도 반전 밴드 + 단일 주 행동"이라는 구조 관찰만. 픽셀·카피·브랜드 요소 복제 아님.
