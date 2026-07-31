# Visigner v3 카탈로그 소비 계약

버전: `1.0.0` (G4.0)  
적용 범위: `v3/modules/<type>/<name>/module.json`  
소비자: Stage 4 composer

이 문서는 composer가 모듈 카탈로그에서 읽는 값과 그 불변식을 고정한다. 계약은 기존 모듈을 재생성하거나 보정하지 않으며, `module.json`을 읽어 조립 가능한 후보로 판정하는 데만 사용한다.

## 1. 소비 필드

Composer top-level 계약 필드는 **9개**다. `provenance`와 `variantProvenance`는 한 provenance 계열이지만 서로 다른 JSON 키이므로 필드 수에 각각 포함한다.

| 필드 | JSON 타입 | 소비 의미 | 키 존재 규칙 |
| --- | --- | --- | --- |
| `schemaVersion` | string | 슬롯·축·구조 해석에 사용하는 SECTION-SCHEMA 버전 | 필수, 현재 `1.0.0` |
| `name` | string | 카탈로그 내 모듈 식별자 | 필수, 모듈 디렉터리명과 동일 |
| `type` | enum string | 조성 타입 및 타입별 필수 슬롯 선택 | 필수, 10개 닫힌 집합 |
| `slots` | object | 주입 가능한 top-level 슬롯 선언 | 필수 |
| `variants` | object | 모듈의 5개 기본 변형축 | 필수, 정확히 5축 |
| `provenance` | enum string | 구조 출처의 상위 분류 | 현재 값이 있으면 `mined` 또는 `schema-authored` |
| `variantProvenance` | enum string | 축 기본값이 관찰인지 조합인지 나타내는 분류 | 현재 값이 있으면 `structure-mined`, `structure-mined; axis-composed`, `schema-authored` |
| `corpusSource` | object | 출처 레코드와 관찰 구역 | 필수, `recordId`·`sectionSpan` |
| `gateProfile` | enum string | composer 이후 적용할 검증 프로파일 | 필수, 3개 닫힌 집합 |

`tmi`와 `miningEvidence`는 이 계약의 9개 소비 필드가 아니다. Stage 4 composer는 이들을 조립 입력으로 해석하지 않으며, 존재하는 값을 변경하지 않는다.

### 1.1 provenance 읽기 정규화

G3.x에서 생성된 40개 파일에는 두 provenance 키가 모두 있는 형태와 한 키가 생략된 형태가 함께 존재한다. 따라서 키 생략은 기존 파일을 수정하지 않고 처리하는 **읽기 시 정규화 규칙**으로만 허용한다.

1. `provenance`가 있으면 그 값을 `sourceProvenance`로 사용한다. 없으면 `corpusSource.recordId === "schema"`일 때 `schema-authored`, 그 외에는 `mined`로 해석한다.
2. `variantProvenance`가 있으면 그 값을 사용한다. 없으면 `sourceProvenance === "schema-authored"`일 때 `schema-authored`, 그 외에는 `structure-mined`로 해석한다.
3. `axis-composed`는 단독 값이 아니다. 직렬화된 값은 `structure-mined; axis-composed`이며, 축 조합을 실제로 기록한 경우에만 인정한다. 생략값에서 `axis-composed`를 추론하지 않는다.
4. 명시된 값이 정규화 결과와 모순되면 계약 위반이다. 예를 들어 `provenance: "schema-authored"`와 `variantProvenance: "structure-mined"`의 조합은 허용하지 않는다.

정규화는 메모리상의 composer view에만 적용된다. 원본 `module.json`에 누락 키를 써 넣거나 순서를 바꾸지 않는다.

## 2. `slots` 계약

`slots`는 슬롯 이름을 키로 하는 object다. 슬롯 순서는 의미가 없으며, 선언된 슬롯은 composer가 콘텐츠를 주입할 수 있는 top-level 입력 경계다.

### 2.1 슬롯 선언 불변식

- 키는 아래 공용 슬롯 집합에만 속한다. 알 수 없는 슬롯은 거부한다.
- 각 선언은 `type`과 boolean `required`를 가진다.
- `text`, `rich-text`, `url`은 공백을 포함한 `minChars`·`maxChars`를 정확히 선언한다. `minChars <= maxChars`여야 한다.
- `collection`은 문자 수가 아니라 정수 `minItems`·`maxItems`를 선언한다. `minItems <= maxItems`여야 한다.
- `asset`은 단일 자산 참조이며 문자 수·항목 수 범위를 갖지 않는다.
- 타입별 최소 필수 슬롯은 반드시 선언되고 `required: true`여야 한다. 선택 슬롯은 `required: false`로 선언하며, DOM 위치와 생략 동작은 `MODULE.md`에서 읽는다.
- 컬렉션 아이템의 내부 필드·반복 DOM은 `module.json`의 top-level 슬롯 계약에 넣지 않는다. 해당 규격은 각 모듈의 `MODULE.md`에 둔다.

### 2.2 공용 슬롯과 범위

| 슬롯 | 타입 | 기본 필수성 | 범위 |
| --- | --- | --- | --- |
| `eyebrow` | `text` | 선택 | `0–32`자 |
| `sectionLabel` | `text` | 선택 | `0–32`자 |
| `badge` | `text` | 선택 | `0–24`자 |
| `headline` | `text` | 타입별 조건부 | `8–72`자 |
| `subheadline` | `text` | 선택 | `0–120`자 |
| `body` | `rich-text` | 타입별 조건부 | `24–360`자 |
| `primaryCtaLabel` | `text` | 타입별 조건부 | `2–32`자 |
| `primaryCtaHref` | `url` | 타입별 조건부 | `1–2048`자 |
| `secondaryCtaLabel` | `text` | 선택 | `2–32`자 |
| `secondaryCtaHref` | `url` | 선택 | `1–2048`자 |
| `media` | `asset` | 타입별 조건부 | 문자 수 없음 |
| `mediaAlt` | `text` | 선택 | `0–160`자 |
| `proofItems` | `collection` | 타입별 조건부 | `2–6`개 |
| `comparisonItems` | `collection` | 타입별 조건부 | `2–8`개 |
| `processSteps` | `collection` | 타입별 조건부 | `2–7`개 |
| `pricePlans` | `collection` | 타입별 조건부 | `1–4`개 |
| `faqItems` | `collection` | 타입별 조건부 | `3–10`개 |
| `galleryItems` | `collection` | 타입별 조건부 | `2–12`개 |
| `featureItems` | `collection` | 타입별 조건부 | `2–8`개 |
| `navItems` | `collection` | 타입별 조건부 | `1–8`개 |
| `legalText` | `rich-text` | 타입별 조건부 | `1–240`자 |
| `contactLabel` | `text` | 선택 | `2–48`자 |
| `sourceNote` | `text` | 선택 | `0–180`자 |
| `footnote` | `rich-text` | 선택 | `0–240`자 |

타입별 필수 슬롯은 다음과 같다.

| `type` | 필수 슬롯 |
| --- | --- |
| `hero` | `headline`, `body`, `primaryCtaLabel`, `primaryCtaHref`, `media` |
| `proof` | `headline`, `proofItems` |
| `comparison` | `headline`, `comparisonItems` |
| `process` | `headline`, `processSteps` |
| `pricing` | `headline`, `pricePlans` |
| `faq` | `headline`, `faqItems` |
| `cta` | `headline`, `body`, `primaryCtaLabel`, `primaryCtaHref` |
| `gallery` | `headline`, `galleryItems` |
| `feature` | `headline`, `featureItems` |
| `footer-band` | `navItems`, `legalText` |

## 3. `variants` 계약

`variants`는 아래 키를 **정확히 5개** 가진다. 값은 모듈의 기본값이며, 콘텐츠 슬롯으로 축 결정을 우회하지 않는다. 런타임 변형을 선택할 때도 각 축의 닫힌 enum 안에서만 고른다.

| 축 | 허용값 |
| --- | --- |
| `layoutArchetype` | `centered`, `split`, `stack`, `grid`, `rail`, `timeline`, `comparison-table`, `media-led` |
| `density` | `airy`, `standard`, `compact` |
| `backgroundBleed` | `surface-contained`, `surface-bleed`, `card-contained`, `contrast-bleed`, `media-bleed` |
| `motion` | `none`, `reveal`, `stagger`, `scroll-linked` |
| `artDirection` | `typographic`, `editorial`, `product-ui`, `documentary`, `data-led`, `photographic` |

`density`, `motion`, `artDirection`의 선택 이유·관찰 범위·기본값 문장은 `MODULE.md`의 TMI 문서 계약을 따른다. JSON 값 자체는 이 문서의 enum만으로 판정한다.

## 4. `corpusSource` 계약

`corpusSource`는 정확히 `recordId`와 `sectionSpan`을 가진다.

- `recordId`: 비어 있지 않은 string. 실제 코퍼스 레코드 ID 또는 schema-authored 모듈의 `schema`다.
- 일반 출처의 `sectionSpan`: `captures/<...>/tile_<...>.png#<관찰 구역>` 형식. 확인된 tile과 구역명만 사용하며 좌표를 추정하지 않는다.
- `recordId: "schema"`의 `sectionSpan`: `v3/SECTION-SCHEMA.md#<type>` 형식.
- 출처 값은 원본 카피·픽셀·브랜드 요소를 소비 입력으로 만들지 않는다. composer는 레코드와 관찰 구역의 식별 정보만 보존한다.

## 5. `gateProfile` 계약

허용 프로파일은 다음 3개다.

- `section-baseline-v1`: 파일·스키마·슬롯·토큰 규칙
- `section-media-v1`: baseline + 미디어 대체 설명·자산 전달 점검
- `section-motion-v1`: baseline + reduced-motion 점검

프로파일은 검증 범위를 선언한다. 낮은 프로파일로 높은 프로파일의 검사를 생략하는 근거로 사용하지 않는다.

## 6. 검증기와 판정

검증기는 의존성 없이 40개 카탈로그 파일을 읽는다.

```bash
node v3/scripts/contract-validate.js
```

- 모듈마다 한 줄을 출력한다.
- 전 모듈이 계약을 만족하면 exit `0`, 하나라도 실패하거나 모듈 수가 40개가 아니면 exit `1`이다.
- 검증기는 파일을 쓰지 않으며, 기존 모듈·템플릿·엔진을 변경하지 않는다.
- 검증 대상은 `v3/modules/<type>/<name>/module.json`이며, 디렉터리명·`name`·`type`의 정합도 함께 확인한다.

실측 근거: `v3/SECTION-SCHEMA.md`의 공용 슬롯·축·게이트 표, 40개 `module.json`의 파싱 결과, `v3/MINER-SOURCES.md`와 G3.5/G3.8 증적. 디자인 토큰 이름은 `skills/design-core`·`skills/design-system`이 안내하는 `skills/detail-page/examples/vite-tailwind/src/theme.generated.css`의 발행 semantic bridge를 따른다.
