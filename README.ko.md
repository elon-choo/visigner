# Visigner

[**English README →**](README.md) · [**랜딩 페이지**](https://elon-choo.github.io/visigner/) · [**가이드**](https://elon-choo.github.io/visigner/guide.html)

**디자인에 필요한 전부를, 설치 한 번에.** 이 저장소 하나를 Claude Code에 추가하면 디자인 툴체인 전체가 손에 들어옵니다 — 랜딩 페이지, 한국형 상세페이지/와디즈 페이지, 앱·웹 UI, 디자인 토큰·시스템, 브랜드 아이덴티티, UX 플로우·와이어프레임, 디자인→코드, 전환/마케팅까지. 여기에 독립적인 design-critic·접근성 감사 에이전트와 친절한 슬래시 커맨드가 더해집니다. **스킬 8 · 에이전트 3 · 커맨드 11 · 빌트인 Node 스크립트 28개**가 하나로 묶여 있어, 설치형 디자인 스킬·플러그인·npm 패키지를 따로 이어 붙일 일이 크게 줄어듭니다.

이것은 Anthropic의 `frontend-design` 미학 규율(코드 전에 토큰 시스템 설계, 뻔한 기본값 거부)과 **스크린샷 자기비평 루프** 위에 만들어졌습니다 — 그래서 결과물이 AI가 만든 티가 나지 않습니다.

> **정직한 범위 (나머지 기능과 같은 잣대).** Visigner에는 **외부 성능 벤치마크가 없습니다** — 인용할 전환율·속도 수치가 없고, 만들어내지도 않습니다. 다시 셀 수 있는 것은 위 인벤토리(`ls skills/ agents/ commands/`), design-critic의 **10차원** 루브릭, **WCAG 2.2 AA** 목표, 그리고 실제 와디즈 캡처 2건뿐입니다. Figma·Photoshop·호스팅·ESP는 **대체하지 않고 공급**하며, API 키가 없으면 이미지 슬롯은 lo-fi SVG 컴프로 대체되고, 컴플라이언스는 운영자 몫입니다. **[가이드의 경계 표](https://elon-choo.github.io/visigner/guide.html#boundaries)**를 보세요.

### 대체하는 것 vs. 공급하는 것

- **대체** — Claude Code용 다른 설치형 디자인 *스킬 / 플러그인 / 패키지*. 본 스위트는 실제 산출물을 직접 만듭니다: 페이지/컴포넌트 **코드**, **SVG**, 디자인 **토큰**, 핸드오프 **스펙**, **다이어그램/와이어프레임**, 전환 **카피**, ESP에 붙여넣을 **이메일 HTML**, **실험 통계**(A/B 표본 설계, Welch t / SRM / 베이지안 판독, 퍼널 드롭오프), **검증 계산**(대비, 터치 타깃, 오버플로) — 전부 의존성 0 Node 스크립트로.
- **대체하지 않고 공급** — 디자인의 하류 도구에 넘기되, 그 도구가 되지는 않습니다: 라이브 캔버스 GUI(**Figma / FigJam**), 래스터 편집기(**Photoshop**), 런타임 인프라(**웹 호스팅**, **ESP 발송**, **분석 웨어하우스**). 배포는 여전히 그쪽으로 합니다.
- **실제 사진/일러스트 생성**은 이미지 API 키(`OPENAI_API_KEY` / `GEMINI_API_KEY`)나 ChatGPT 로그인이 필요합니다. 없으면 각 이미지 슬롯은 **의도된 lo-fi 컴프** — 결정적·온브랜드 SVG — 로 렌더되어 슬롯의 의도만 표시할 뿐, 완성 에셋이 아닙니다. 운영자가 배포 전에 실제 아트로 교체합니다. **스크린샷 브라우저**는 **`/design-setup`**으로 한 번 설치합니다.

---

## 설치 (명령 두 줄)

Claude Code 안에서:

```
/plugin marketplace add elon-choo/visigner
/plugin install visigner@visigner
```

끝입니다 — 스킬·에이전트·커맨드가 모두 켜집니다. Claude Code **v2.1.100+** 가 필요합니다(`claude --version`).

> **파워 기능을 위한 일회성 설정(선택):** 스크린샷 자기비평 루프, 라이브 레퍼런스 캡처, 이미지 에셋 배치는 헤드리스 브라우저를 씁니다. **`/design-setup`**을 한 번 실행해 설치하세요. 그 외 — 기획·디자인·코드 작성·검수 — 는 설치 없이 바로 됩니다.

### 팀 설치 (모두에게 자동 적용)

프로젝트의 `.claude/settings.json`에 아래를 커밋하면 팀원은 워크스페이스를 신뢰하는 순간 자동으로 받습니다:

```json
{
  "extraKnownMarketplaces": {
    "visigner": { "source": { "source": "github", "repo": "elon-choo/visigner" } }
  },
  "enabledPlugins": { "visigner@visigner": true }
}
```

---

## 여기서 시작 (당신이 누구냐로)

| 당신은… | 이렇게 입력 | 받는 것 |
|---|---|---|
| **잘 모름 / 바이브코더** | `/design <원하는 것 설명>` | 라우팅 → 브리프 고정 → 품질 게이트까지 제작 |
| **마케터 / 창업자** | `/landing <제품>` | 슬롭 아닌 전환형 랜딩·상세페이지/와디즈 |
| **프로덕트 디자이너** | `/ui <화면 또는 앱>` | 전 상태 컴포넌트의 앱·웹 UI, 픽셀로 채점 |
| **브랜드 디자이너 / CEO** | `/brand <비즈니스>` | 전략 → 보이스 → 비주얼 아이덴티티 시스템 |
| **기획자 / PM** | 플랜/와이어프레임 요청 | 플로우·IA·와이어프레임·빌드 가능한 스펙 (`ux-flows`) |
| **개발자** | `/ui` 또는 빌드 설명 | React/Tailwind v4/shadcn 구현, 접근성·반응형 |
| **배포 직전 누구나** | `/design-review <페이지>` | 독립 SHIP / NO-SHIP 판정 |
| **비주얼 만드는 누구나** | `/design-image <이미지 설명>` | 최신 OpenAI/Gemini 모델로 실제 이미지 생성 — ChatGPT/codex OAuth 무료 또는 API 키 |
| **디자인시스템 관리자** | `/design-publish` | 컴포넌트 라이브러리를 Claude Design(claude.ai/design)으로 발행 |

대부분 이름을 외울 필요가 없습니다 — 평소 말로 작업을 설명하면 알맞은 **스킬이 자동 발동**합니다. 커맨드는 지름길입니다.

---

## 안에 든 것

### 스킬 (관련 작업에서 자동 발동)
- **design-core** — 나머지 스킬들이 올라서는 공유 엔진: 토큰 레이어, 안티-슬롭 미학 방법론, **전역 이미지 서비스**(`gpt-image-2` / `gemini-3-pro-image`로 어떤 디자인에도 실제 에셋 생성 — ChatGPT/codex OAuth 무료 또는 API 키; `/design-image` 뒤), 배포 게이트, 그리고 **Claude Design 발행**(컴포넌트 라이브러리를 claude.ai/design 디자인시스템 프로젝트로 푸시; `/design-publish` 뒤). 하나의 코어, 다양한 디자인.
- **detail-page** — 랜딩 페이지 + 한국형 상세페이지 / 와디즈·텀블벅 펀딩 페이지, 이미지 에셋 생성, 스크린샷 자기비평 루프. 안티-AI-슬롭 미학 + 한국형 전환 구조(PASONA, Schwartz 인지×정교화). 보정용 실제 와디즈 캡처 동봉.
- **ui-design** — 앱·웹·프로덕트 UI, 대시보드, SaaS, 폼, 컴포넌트 — 모든 인터랙티브 상태, 모션 규율, 프로덕트 UI에 적용된 안티슬롭 기준. 다크모드는 두 HTML 스타터에서 기본 제공이며, `icon-set.js`가 일관된 1st-party SVG 아이콘 패밀리 + 검증 시트를 생성합니다.
- **design-system** — 디자인 토큰(DTCG + Tailwind v4 `@theme`), OKLCH 램프, 시맨틱 테마, 멀티브랜드 & 다크모드, 개발 핸드오프 스펙 시트, 그리고 `undefined-token-ref`를 CI에서 잡는 `brand-lint` 게이트.
- **brand-identity** — 브랜드 전략(포지셔닝, 아키타입), 버벌 아이덴티티(보이스, 네이밍, 메시징), 비주얼 아이덴티티(로고 방향, 컬러, 타입, 이미지) + SVG 로고 + `guidelines.html` 제작.
- **ux-flows** — 기획자의 본진: 아이디어 → 유저 플로우 → 정보 구조 → 와이어프레임 → 수용 스펙.
- **frontend-build** — 디자인 → 동작하는 코드: React/Next + Tailwind v4 + shadcn/ui, 접근성, 반응형, 스크린샷/Figma → 코드, 스크린샷으로 검증. 실행 가능한 **React + Vite + Tailwind v4** 스타터 동봉.
- **marketing-conversion** — 퍼널 매핑, CRO, 전환 카피 프레임워크, A/B 가설, 채널 카피, 그리고 중요한 지표들.

### 에이전트 (독립 리뷰어 — 생성기는 자기 작업을 채점하지 않음)
- **design-critic** — 안티슬롭 비주얼 + 전환 비평, **10차원** 루브릭과 SHIP/NO-SHIP 게이트, 실제 스크린샷에서 채점.
- **a11y-auditor** — WCAG 2.2 AA 감사(대비, 키보드, 포커스, 이름/역할, prefers-reduced-motion), PASS/FAIL.
- **design-director** — 빌드 전에 강하고 비제너릭한 아트 디렉션(토큰 시스템 + 시그니처 요소)을 고정.

### 커맨드 (11)
`/design`(라우터) · `/landing` · `/ui` · `/brand` · `/plan` · `/campaign` · `/design-tokens` · `/design-image` · `/design-publish` · `/design-review` · `/design-setup`

디자인 커맨드 10개 + 일회성 셋업 1개(`/design-setup`)입니다. `/campaign`은 하나의 아이디어를 고정해 랜딩 + 유료 광고 + 소셜 + 이메일 시퀀스로 펼치고, 결정적 카피 플로어(`copy-lint.js --idea`)와 이메일 플로어, 독립 `design-critic MODE=copy` 시맨틱 채점으로 크로스서피스 메시지-매치를 점검합니다.

---

## 품질 기준 (왜 AI가 만든 티가 안 나나)

방치하면 모델은 고확률의 **제너릭 센터** — "AI 슬롭" 룩(Inter 폰트, 흰 배경 보라 그라데이션, 동일 카드 4개, 전부 가운데 정렬) — 을 뱉습니다. 여기 모든 스킬은 같은 척추로 이를 막습니다:

1. **코드 전에 토큰 시스템 설계** — 색 / 타입 / 레이아웃 / 이름 붙은 *시그니처* 요소 — 그리고 같은 브리프에 나올 법한 것과 대조해, 기본값과 겹치는 건 전부 바꿉니다.
2. **금지 기본값** — 피해야 할 제너릭 단서의 명시적 목록.
3. **픽셀로 검증** — 자기 출력물을 렌더·스크린샷(`shoot.js`)하고, 본 것을 루브릭으로 독립 critic과 함께 채점합니다. "코드 봤는데 괜찮아 보여요"는 허용되지 않습니다.

---

## 동봉된 의존성 0 스크립트 (npm install 불필요, 빌트인 Node만)

스크린샷 루프(`shoot.js`) 외에도 직접 호출하는 실행형 헬퍼가 동봉됩니다 — `ab.js`(A/B 표본·판독), `pull-funnel.js`(읽기 전용 PostHog/GA4 퍼널), `email.js` / `email-lint.js`(ESP용 HTML 이메일 + 카피 린트), `copy-lint.js`(채널별 카피 플로어), `plan-lint.js`(ux-flows PRD 플로어), `name-check.js`(RDAP 도메인 + GitHub/npm + 상표 검색), `icon-set.js`, `brand-book.js`, `logo-handoff.js` 등. 그리고 **CI 게이트(템플릿)** — `.github/workflows/design-gate.yml`, `npm run lint:brand` / `lint:tokens` / `gate` 스크립트(이 스크립트들은 `skills/detail-page/package.json`에 정의되어 있으니 그 폴더에서 돌리거나 당신 저장소의 `package.json`으로 복사해 쓰세요), `.husky/pre-commit` 훅 — 으로 brand-lint, @theme↔DTCG 드리프트 체크, 스크린샷+axe 게이트를 머지 요건으로 만들 수 있습니다. 이들은 플러그인 안의 본보기 파일이며, 루트에서 바로 `npm run gate`가 도는 게 아닙니다.

## 참고

- **이미지 생성**(`/design-image`)은 **브라우저 설치가 필요 없습니다** — 자격증명 하나만 있으면 됩니다: 무료 ChatGPT/codex 로그인(`codex login`) 우선, 없으면 API 키(`OPENAI_API_KEY` / `GEMINI_API_KEY`). 아무것도 없으면 이미지 슬롯은 **의도된 lo-fi 컴프**(결정적 온브랜드 SVG)로 렌더되어 실제 아트로 교체합니다. `image-service.js --doctor`로 무엇이 활성인지 확인하세요. (**라이브 페이지 캡처** — 실제 경쟁사 페이지 스크린샷 — 만 일회성 `/design-setup` Patchright + Chromium 설치가 필요합니다.)
- **Claude Design 발행**(`/design-publish`)은 컴포넌트 라이브러리를 네이티브 DesignSync 툴로 **claude.ai/design** 디자인시스템 프로젝트에 푸시합니다. claude.ai 로그인에 디자인시스템 접근이 필요하며(읽기 실패 시 `/design-login` 1회 실행), sync를 재구현하지 않고 매 푸시 전 대상 프로젝트를 먼저 확인합니다.
- **컴플라이언스**(광고/표시법, 주장 입증)는 의도적으로 운영자에게 맡깁니다 — 본 스위트는 디자인·전환 품질에 최적화되어 있고 법적 검토는 하지 않습니다.
- 라이선스: MIT.
