# Visigner v3 섹션 모듈 규격

버전: `1.0.0`  
적용 범위: `v3/modules/<type>/<name>/`의 재사용 가능한 웹 섹션 모듈

이 문서는 섹션을 조립 가능한 단위로 만들기 위한 단일 계약이다. 모듈은 제품·업종·컨설팅 맥락을 포함하지 않으며, 콘텐츠와 시각 결정은 슬롯과 변형축으로만 전달한다.

## 1. 모듈 해부 구조

모든 모듈은 다음 다섯 층을 갖는다.

1. **식별층** — `module.json`의 `schemaVersion`, `name`, `type`.
2. **콘텐츠층** — 이름이 붙은 슬롯과 슬롯별 입력 제약.
3. **구조층** — `template.html`의 랜드마크, 제목 계층, 슬롯 앵커(`data-slot`).
4. **표현층** — semantic 토큰과 선택된 변형축만 사용하는 CSS.
5. **운영층** — corpus 출처, gate profile, TMI 구조.

모듈 타입은 아래 10개 닫힌 집합이다. 필수 파트는 템플릿에 존재해야 하며, 괄호 안은 최소 필수 슬롯이다.

| 타입 | 용도 | 필수 파트 | 최소 필수 슬롯 |
| --- | --- | --- | --- |
| `hero` | 페이지의 주제와 첫 행동 제시 | 맥락, 핵심 주장, 보조 설명, 주 CTA, 미디어 영역 | `headline`, `body`, `primaryCtaLabel`, `primaryCtaHref`, `media` |
| `proof` | 근거·검증·신뢰 신호 제시 | 주장 제목, 증거 묶음, 출처 또는 보충 맥락 | `headline`, `proofItems` |
| `comparison` | 선택지·차이·기준 비교 | 비교 제목, 동일 기준의 비교 행/항목, 해석 보조 | `headline`, `comparisonItems` |
| `process` | 단계와 진행 순서 설명 | 단계 제목, 순서화된 단계 묶음, 다음 행동 | `headline`, `processSteps` |
| `pricing` | 가격 또는 플랜의 경계 설명 | 가격 제목, 플랜 묶음, 포함/제외 또는 조건 | `headline`, `pricePlans` |
| `faq` | 질문 해소 | FAQ 제목, 질문·답변 묶음, 미해결 문의 경로 | `headline`, `faqItems` |
| `cta` | 단일 행동으로 전환 | 행동 제목, 짧은 설명, 주 CTA | `headline`, `body`, `primaryCtaLabel`, `primaryCtaHref` |
| `gallery` | 이미지·사례·표본 열람 | 갤러리 제목, 미디어 묶음, 각 항목의 대체 설명 | `headline`, `galleryItems` |
| `feature` | 기능 또는 효익 묶음 설명 | 기능 제목, 기능 항목 묶음, 보조 미디어 또는 설명 | `headline`, `featureItems` |
| `footer-band` | 페이지 말단의 탐색과 법적·연락 정보 | 탐색 묶음, 연락 경로, 법적 문구 | `navItems`, `legalText` |

## 2. 슬롯 계약

### 2.1 표기와 템플릿 연결

- `module.json`의 `slots`는 슬롯 이름을 키로 하는 객체다.
- 각 슬롯 선언은 `type`, `required`를 가지며, 문자열 슬롯은 `minChars`와 `maxChars`, 컬렉션 슬롯은 `minItems`와 `maxItems`를 가진다.
- `template.html`은 선언한 모든 슬롯을 정확히 한 번 이상 `data-slot="<slotName>"`으로 앵커링한다. URL 목적지 슬롯은 링크 요소의 `data-slot-href="<slotName>"`으로 앵커링한다. 컬렉션은 반복 항목이 아니라 그 컬렉션의 컨테이너에 앵커링한다.
- 타입별 최소 필수 슬롯은 반드시 선언되고 `required: true`여야 한다. 선택 슬롯도 선언했다면 템플릿 앵커가 필요하다.
- 샘플 텍스트는 내용 주입 전의 중립 더미일 뿐이며, 실제 렌더러는 슬롯 값으로 대체한다.

### 2.2 공용 슬롯 목록

`필수성`의 “조건부”는 위 타입 표의 최소 필수 슬롯에서 결정한다. 문자열 범위는 공백을 포함한 문자 수다.

| 슬롯 | 타입 | 필수성 | 길이/개수 범위 | 의미 |
| --- | --- | --- | --- | --- |
| `eyebrow` | `text` | 선택 | 0–32자 | 작은 맥락 표지 |
| `sectionLabel` | `text` | 선택 | 0–32자 | 섹션 성격 표지 |
| `badge` | `text` | 선택 | 0–24자 | 짧은 상태·분류 표지 |
| `headline` | `text` | 조건부 | 8–72자 | 섹션의 주 제목 |
| `subheadline` | `text` | 선택 | 0–120자 | 제목 보조 문장 |
| `body` | `rich-text` | 조건부 | 24–360자 | 설명 문단, 안전한 인라인 마크업만 허용 |
| `primaryCtaLabel` | `text` | 조건부 | 2–32자 | 주 행동 라벨 |
| `primaryCtaHref` | `url` | 조건부 | 1–2048자 | 주 행동 목적지 |
| `secondaryCtaLabel` | `text` | 선택 | 2–32자 | 보조 행동 라벨 |
| `secondaryCtaHref` | `url` | 선택 | 1–2048자 | 보조 행동 목적지 |
| `media` | `asset` | 조건부 | — | 단일 이미지·영상·UI 캡처 참조 |
| `mediaAlt` | `text` | 선택 | 0–160자 | 미디어 대체 설명 |
| `proofItems` | `collection` | 조건부 | 2–6개 | 인용, 수치, 인증, 관찰 근거 |
| `comparisonItems` | `collection` | 조건부 | 2–8개 | 같은 기준으로 비교되는 행/열 |
| `processSteps` | `collection` | 조건부 | 2–7개 | 순서화된 단계 |
| `pricePlans` | `collection` | 조건부 | 1–4개 | 가격·플랜·조건 단위 |
| `faqItems` | `collection` | 조건부 | 3–10개 | 질문·답변 단위 |
| `galleryItems` | `collection` | 조건부 | 2–12개 | 미디어와 캡션 단위 |
| `featureItems` | `collection` | 조건부 | 2–8개 | 기능·효익 단위 |
| `navItems` | `collection` | 조건부 | 1–8개 | 말단 탐색 항목 |
| `legalText` | `rich-text` | 조건부 | 1–240자 | 법적·저작권 문구 |
| `contactLabel` | `text` | 선택 | 2–48자 | 연락 행동 라벨 |
| `sourceNote` | `text` | 선택 | 0–180자 | 근거의 짧은 출처 설명 |
| `footnote` | `rich-text` | 선택 | 0–240자 | 조건·보충 설명 |

컬렉션의 각 아이템 내부 구조는 해당 모듈의 `MODULE.md`에서 G1.6에 확정한다. 이 버전은 컬렉션 수와 템플릿 앵커까지만 계약한다.

## 3. 시맨틱 토큰 전용 계약

모듈 마크업과 CSS는 raw hex, `rgb()`/`hsl()`/`oklch()` 리터럴, raw `px`, primitive `--brand-*`를 사용하지 않는다. 색·공간·타이포그래피·반경·그림자·모션은 모두 아래의 이미 발행된 semantic 또는 scale 토큰을 `var(...)`로 소비한다. 토큰을 새로 정의하는 `:root` 또는 `@theme` 블록도 모듈 템플릿 안에 두지 않는다.

실측 근거는 `skills/design-core/SKILL.md`의 토큰 canonical 위치 안내와 `skills/design-system/SKILL.md`의 semantic mapping 규칙이며, 그 경로가 가리키는 컴파일 산출물 `skills/detail-page/examples/vite-tailwind/src/theme.generated.css`에서 이름을 확인했다.

| 범주 | 허용 토큰 |
| --- | --- |
| 표면·텍스트·선 | `--color-surface`, `--color-card`, `--color-ink`, `--color-muted`, `--color-line` |
| 행동 색 | `--color-primary-50`, `--color-primary-100`, `--color-primary-300`, `--color-primary-500`, `--color-primary-700`, `--color-primary-900`, `--color-primary`, `--color-accent-300`, `--color-accent-500`, `--color-accent-700`, `--color-accent`, `--color-on-accent` |
| 글꼴 | `--font-display`, `--font-body`, `--font-latin` |
| 여백 | `--space-4`, `--space-8`, `--space-12`, `--space-16`, `--space-24`, `--space-32`, `--space-48`, `--space-64`, `--space-96` |
| 활자·행간 | `--text-12`부터 `--text-64`, `--leading-12`부터 `--leading-64`의 발행된 쌍 |
| 반경·그림자 | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`, `--shadow-e1`, `--shadow-e2`, `--shadow-e3` |
| 모션 | `--dur-1`, `--dur-2`, `--dur-3`, `--ease-out`, `--ease-spring` |

모션이 `none`이 아니면 `prefers-reduced-motion: reduce`에서 전환과 애니메이션을 제거하거나 정지해야 한다. 토큰이 호스트 문서에서 공급되지 않는 상태는 템플릿이 값을 대체 정의해서 해결하지 않는다.

## 4. 변형축

`module.json.variants`는 아래 다섯 키를 모두 가져야 하며 값은 닫힌 enum 중 하나다. 축을 추가하거나 값 범위를 넓히려면 이 규격의 버전을 올린다.

| 축 키 | 허용값 |
| --- | --- |
| `layoutArchetype` | `centered`, `split`, `stack`, `grid`, `rail`, `timeline`, `comparison-table`, `media-led` |
| `density` | `airy`, `standard`, `compact` |
| `backgroundBleed` | `surface-contained`, `surface-bleed`, `card-contained`, `contrast-bleed`, `media-bleed` |
| `motion` | `none`, `reveal`, `stagger`, `scroll-linked` |
| `artDirection` | `typographic`, `editorial`, `product-ui`, `documentary`, `data-led`, `photographic` |

선택된 값은 모듈의 기본값이다. 런타임 변형은 이 enum 안에서만 고를 수 있으며, 콘텐츠 슬롯으로 레이아웃 결정을 우회하지 않는다.

## 5. 출처·게이트·TMI 필드

### 5.1 Corpus 출처 링크

`corpusSource`는 다음 두 필드를 반드시 가진다.

```json
{
  "recordId": "<corpus-index.json의 records[].id>",
  "sectionSpan": "<capture_dir>/<tile 파일>#<관찰 구역>"
}
```

`sectionSpan`은 예를 들어 `captures/stage2/supabase/tile_00.png#hero`처럼 capture 경로와 tile, 관찰 구역을 함께 적는다. 코퍼스에 수직 오프셋 맵이 없으면 추정한 좌표 범위를 쓰지 않고, 확인된 tile과 구역 이름만 적는다.

### 5.2 Gate profile

`gateProfile`은 다음 중 하나다.

- `section-baseline-v1`: 파일·스키마·슬롯·토큰 규칙
- `section-media-v1`: baseline + 미디어 대체 설명·자산 전달 점검
- `section-motion-v1`: baseline + reduced-motion 점검

### 5.3 TMI 구조 예약

`tmi`는 G1.6에서 내용과 판정 기준을 확정한다. 이 버전의 모듈은 아래 구조와 `pending-g1.6` 상태만 기록하며, 항목의 실질 내용은 채우지 않는다.

```json
{
  "status": "pending-g1.6",
  "why": null,
  "dependencies": [],
  "changeImpact": [],
  "coachComment": null,
  "perfectScoreExampleLink": null
}
```

`MODULE.md`는 `tmi.status`를 제외한 다섯 실질 TMI 필드(`why`, `dependencies`, `changeImpact`, `coachComment`, `perfectScoreExampleLink`)에 대응하는 읽기용 항목과 별도의 `6. 출처` 항목을 보유한다. `status`는 `module.json`에만 예약 상태로 기록한다. 이 규격은 TMI의 구조를 보장할 뿐, 현재 모듈의 평가·코칭 내용을 주장하지 않는다.

## 6. 파일 레이아웃과 실행

```text
v3/modules/<type>/<name>/
├── module.json       # 메타데이터, 슬롯 선언, 변형축, 출처·게이트·TMI 구조
├── template.html     # data-slot 앵커와 semantic 토큰만 소비하는 마크업
└── MODULE.md         # G1.6 TMI 목차
```

검증은 의존성 없이 실행한다.

```bash
node v3/scripts/section-validate.js v3/modules/<type>/<name>
```

검증기는 필수 파일, `module.json`의 타입·슬롯·변형축 enum, 템플릿의 raw hex·색상 함수·raw `px`·primitive 참조, 그리고 선언 슬롯과 `data-slot` 앵커의 양방향 정합을 검사한다. 모든 대상이 통과하면 exit code `0`, 하나라도 위반하면 `1`이다.
