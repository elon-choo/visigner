# Visigner v3 컴포지션 문법

버전: `1.0.0`  
적용 범위: 여러 `v3/modules/<type>/<name>/` 모듈을 한 페이지로 조립하는 `composition.json`

페이지는 하나의 조성 아래 성격이 다른 악장(섹션)을 순서대로 배치한다. 조성의 정체성은 페이지 전체에서 유지하고, 악장 간 차이는 `SECTION-SCHEMA.md`의 다섯 변형축으로만 만든다.

## 1. 불변 코어와 가변 경계

### 불변 코어

아래 값은 페이지 최상위 `core`에 한 번만 선언하며 모든 섹션이 공유한다.

- `tokenSet`: 페이지가 소비하는 하나의 semantic 토큰셋 식별자 또는 경로
- `typographyVoices`: display, body, latin 성부에 쓰는 글꼴 토큰의 고정 매핑
- `signatureMotif`: 페이지 전체에서 반복하는 한 가지 시각적 모티프의 짧은 설명

섹션 항목은 이 코어를 재선언하거나 덮어쓸 수 없다. 섹션의 템플릿은 `SECTION-SCHEMA.md`의 semantic 토큰 계약을 지켜야 하며, 조립 전후 모두 `section-validate.js`를 통과해야 한다.

### 가변 경계

섹션별 차이는 아래 다섯 축의 선택값으로만 표현한다. 값과 키는 `SECTION-SCHEMA.md`의 닫힌 enum을 그대로 사용하며, 이 문서는 새 축이나 새 값을 추가하지 않는다.

- `layoutArchetype`
- `density`
- `backgroundBleed`
- `motion`
- `artDirection`

섹션에 `variants`를 쓰지 않으면, lint는 참조한 `module.json`의 `variants`를 그대로 사용한다. `variants`를 쓰면 다섯 축을 모두 적어야 하며 각 값은 해당 모듈 규격의 enum 안에 있어야 한다.

## 2. 페이지 매니페스트

`composition.json`은 아래 형태를 사용한다. `module`은 매니페스트 파일을 기준으로 한 모듈 디렉터리 또는 `module.json` 경로다.

```json
{
  "compositionVersion": "1.0.0",
  "core": {
    "tokenSet": "semantic-v3",
    "typographyVoices": {
      "display": "--font-display",
      "body": "--font-body",
      "latin": "--font-latin"
    },
    "signatureMotif": "페이지 전반에 반복할 하나의 시각적 리듬"
  },
  "sections": [
    {
      "module": "../modules/hero/neutral-split-hero"
    },
    {
      "module": "../modules/proof/neutral-evidence-grid",
      "variants": {
        "layoutArchetype": "grid",
        "density": "standard",
        "backgroundBleed": "card-contained",
        "motion": "none",
        "artDirection": "data-led"
      }
    }
  ]
}
```

`sections`의 배열 순서가 페이지의 읽기 순서다. lint는 `module.json`에서 `type`과 기본 `variants`를 읽는다. 따라서 기본값을 그대로 쓸 때는 첫 항목처럼 모듈 참조만 남긴다.

## 3. 다양성 플로어

인접한 두 섹션은 다음을 모두 만족해야 한다.

- 다섯 변형축 중 최소 두 축의 값이 달라야 한다.
- `layoutArchetype` 값이 같으면 안 된다.
- **섹션 `type`이 같으면 안 된다 (`adjacent-same-type`).** 예를 들어 `cta` 바로 뒤에 또 다른 `cta`를 둘 수 없다. 변형축을 다르게 잡아도 이 규칙을 우회할 수 없다.

페이지 전체에서는 같은 `(type, layoutArchetype)` 조합을 한 번만 쓸 수 있다. 즉 반복 상한은 `1`이다. 같은 타입을 다시 써야 한다면 다른 레이아웃 아키타입과 앞뒤 섹션에서 두 축 이상의 차이를 함께 만들어야 한다.

### 유형별 페이지 상한과 위치

아래 상한은 `(type, layoutArchetype)` 반복 상한 및 모든 인접 규칙에 추가로 적용된다. 표에 없는 타입에는 별도의 페이지 수 상한을 더하지 않는다.

| 섹션 type | 페이지 상한 | 위치 제약 |
| --- | ---: | --- |
| `hero` | 1 | 존재하면 반드시 첫 섹션 |
| `cta` | 2 | 인접 불가; 기본 conversion 조성은 콘텐츠 뒤의 CTA 1개만 둠 |
| `footer-band` | 1 | 존재하면 반드시 마지막 섹션 |

따라서 일반적인 conversion 조성은 `hero → 콘텐츠 섹션들 → cta → footer-band` 순서를 쓴다. 두 CTA가 정말 필요해도 콘텐츠 섹션으로 분리해야 하며, 서로 인접할 수 없다.

## 4. 일관성 실링

다양성을 위해 코어를 바꾸지 않는다.

- 모듈 템플릿에는 semantic 토큰만 사용한다. raw 색상, raw `px`, primitive `--brand-*` 참조는 금지한다. `section-validate.js`와 `grammar-lint.js`가 각각 이를 확인한다.
- 팔레트 역할은 한 토큰셋 안에서 `60/30/10`을 넘지 않게 배분한다. 기본 표면이 약 60, 보조 표면·카드가 약 30, 행동·강조색이 약 10의 역할을 갖는다. 강조색을 섹션 배경의 주색으로 승격하거나, 행동색 비중을 10보다 크게 늘리면 안 된다.
- display/body/latin 성부의 역할과 `signatureMotif`는 전 섹션에서 유지한다. 변형축 값으로 그 역할을 바꾸지 않는다.

## 5. 이음새 규칙

`backgroundBleed`의 `surface-bleed`, `contrast-bleed`, `media-bleed`는 full-bleed다. `surface-contained`, `card-contained`는 contained다.

- full-bleed는 연속할 수 없다. full-bleed 뒤에는 contained 섹션이 반드시 온다.
- full-bleed 섹션 수는 전체 섹션 수의 절반 이하로 제한한다. 홀수 섹션 수에서는 반올림 올림으로 계산하되, 연속 금지 규칙을 함께 적용한다.
- 명도 전환은 한 이음새에서 한 단계만 허용한다. `surface`와 `card`의 contained 전환, 또는 contained와 하나의 `contrast-bleed`/`media-bleed` 전환은 허용한다. 두 개의 강한 배경 전환을 바로 연결하지 않는다. 토큰의 실제 명도는 시각 검토에서 확인한다.
- `motion`이 `none`이 아닌 섹션은 전체의 `ceil(섹션 수 / 3)`개 이하로 제한한다. 이 수를 넘기면 모션 밀도가 과하다. reduced-motion 처리는 각 모듈의 gate profile을 따른다.

## 6. lint 실행

```bash
node v3/scripts/section-validate.js v3/modules/<type>/<name>
node v3/scripts/grammar-lint.js v3/fixtures/composition-valid.json
```

`grammar-lint.js`는 매니페스트 구조, 모듈 참조, 변형축 enum, 인접 다양성, **인접 동일 type**, 아키타입 중복, `(type, layoutArchetype)` 반복 상한, hero/CTA/footer-band의 페이지 상한·위치, full-bleed 빈도·연속, 모션 밀도와 참조 모듈의 token guard를 검사한다. 위반이 없으면 exit code `0`, 하나라도 있으면 `1`이다.
