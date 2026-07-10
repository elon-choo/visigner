# ui-craft 흡수 업그레이드 로드맵 — 4 스테이지 × goal 프롬프트 v1.0

- **도메인:** detail-page 스킬(visigner)을 **ui-craft(educlopez/ui-craft, MIT)** 학습으로 업그레이드한다. ui-craft의 4-lane 대조 분석(detector / evals / architecture / distribution)에서 도출한 흡수 항목을 **"가장 값싸고 임팩트 큰 것 먼저"** 우선순위로 스테이지화한다.
- **별개 트랙 선언:** 이 로드맵은 기존 `anti-ai-roadmap.md`(S1·S2 완료, S3 실행중)와 **별개 트랙**이다. 목적이 다르다 — anti-ai 트랙 = 자체 텔 탐지 인프라의 지속 강화, ui-craft 트랙 = 외부 도구의 검증된 아키텍처·룰·배포 패턴 흡수. **충돌·중복은 §5에서 명시**하고, 어디는 기존 anti-ai Stage에 흡수/인계하고 어디는 신규 Stage인지 구분한다.
- **SSOT:** 정본 `/Users/elon/visigner/skills/detail-page/` (미러 `~/.claude/skills/detail-page/`). ui-craft 소스 = `/tmp/ui-craft/`(MIT, (c) 2026 Eduardo Calvo). 4-lane 분석 동결본 = `/tmp/anti-ai/uicraft-analysis.json` (이 로드맵의 단일 진실 입력 — anti-ai 트랙 fixes.json 위치와 동형).
- **원장:** `/Users/elon/visigner/docs/LEDGER.md` (단일 진실). 이 트랙의 goal id 접두 = **`UC`**(anti-ai의 `G1~G6`과 비충돌). RUN 모드 등록·NEXT 이동은 소유자/오케스트레이터 소관.
- **오케스트레이션:** Claude Code ultracode. **개발·구현 goal = Codex MCP(`mcp__codex__codex`) 위임**; 평가·리서치·기획 goal = Claude 서브에이전트/Workflow.
- **구조:** 스테이지 개요 전체 고정(§1) + Stage U1만 goal 전문 확정(§2). U2~U4는 각 `UCx.10` 메타-goal이 **그 시점 실제 측정 결과** 기준으로 §3 개요 계약을 지켜 상세화(선작성 낭비·현실 이탈 방지, anti-ai 로드맵 형식 계승).

## 권고 (Recommendation)

**이 4-스테이지 로드맵을 승인하고, RUN 모드로 `UC1.1`(분석 동결 + 트랙 조정 계약)부터 착수하라.** 근거: 4-lane 분석에서 확인된 **가장 값싸고 임팩트 큰 단일 항목은 evals lane의 "라벨 페이지 픽스처 baseline"이다.** visigner에는 `calibration threat#4`("this real KR page should land in [x,y]" 앵커가 ZERO — 유일 회귀 픽스처 `s2pass-escape-anyof.test.js`는 SYNTHETIC tell array만 먹임, `find` 확인)가 미해결로 남아 있고, ui-craft `baselines.json` + `score.test.mjs`(designer min 100 > slop max 68 분리 어서트, 실측 49/49 pass)가 그 갭을 닫는 **정확한 이식 패턴**이다. 동시에 evals lane은 visigner가 **이미 절반 배운** deterministic-vs-judged 분리(`s2PassSemantics` + review-rubric/taste Co-gate 'not a blend')를 **코드 심(seam)으로 형식화**만 하면 되는 상태임을 확인했다 — 신규 개발이 아니라 additive 승격. 따라서 Stage U1 = "라벨 픽스처 baseline + 결정론적 복합점수 형식화"를 최우선 배치한다. 이후 U2(detector 상보 룰) → U3(커맨드/persona/references) → U4(배포)는 각각 임팩트/노력 비율 감소 순. **첫 정지점(HUMAN_GATE)은 §6 — 특히 `UC1.4`의 `computeS2Pass` 근접 additive 편집(anti-ai 트랙 SSOT 파일)과 U4의 대외 배포.**

## 0. 전 goal 공통 규약 (모든 워커 프롬프트 앞에 붙임)
```
1. 모드: Claude Code ultracode(실작업은 멀티에이전트/Workflow 분해).
   개발·구현 goal = Codex MCP(mcp__codex__codex) 위임; 평가·리서치·기획 goal = Claude 서브에이전트/Workflow.
2. SSOT: detail-page 스킬 정본 /Users/elon/visigner/skills/detail-page/ + 미러 ~/.claude/skills/detail-page/.
   ui-craft 소스 = /tmp/ui-craft/(참고·이식 원본, 절대 SUT 아님). 4-lane 동결 = /tmp/anti-ai/uicraft-analysis.json.
   충돌 시 구현 중지, 원장·SSOT 우선.
3. 트랙 불변식(non-weakenable): 이 트랙의 어떤 goal도 anti-ai 트랙의 boolean s2Pass + escapeTells any-of 게이트
   (computeS2Pass, anti-ai-eval.js L1786-1801, harness 1.2.1)를 약화·치환 금지. 신규 graded 복합점수는
   strictly additive(별도 필드, boolean 불변). anti-ai G2.9.5·G3 non-weakenable 원칙 계승.
4. 파일 직렬화: anti-ai-eval.js / brand-lint.js / shoot.js는 anti-ai S3 진행중 파일. 같은 파일을 additive
   확장할 때는 anti-ai 트랙과 파일 단위 직렬화(동시 편집 금지) + 원장에서 잠금 상태 확인. 기존 라인 수정=HUMAN_GATE.
5. ui-craft attribution(MIT 준수): verbatim 코드(정규식 룰 본문·score.test 패턴·hooks 페이로드)를 옮기면
   (a) 이식 파일 헤더 주석 'Ported/adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft',
   (b) visigner 루트 ATTRIBUTIONS.md 항목 추가, (c) MIT 허가문 보존. 가능하면 재구현으로 흡수, 복제 시에만 헤더.
6. 측정: "흡수가 효과 있다"는 모든 주장은 실행 증거(테스트 출력/렌더 타일/report json/재채점)로 증명.
   사람 눈 단독 주장 불가. 없으면 '미검증' 표기. 모델재현 금지.
7. 교차검증: 아키텍처·스크립트 계약·외부 API 산출물은 codex MCP에 반박 리뷰 → 불일치 해소 후 완료.
   코드 diff 리뷰는 adversarial-review 스킬 경유(글로벌 라우팅).
8. 반환 형식: 5줄 요약 + 증거 파일 경로만. 원문·로그·타일은 디스크(/tmp/anti-ai/uc/<goal>/).
9. 기존 동작 스킬 코드는 additive만(신규 파일/추가 블록). 기존 라인 변경·삭제는 HUMAN_GATE.
   스킬 파일 변경 시 Visigner 정본↔표준 사본 두 곳 동기화 필수(바이트 동일).
10. 무료 설치 제약(소유자): 배포되는 정적 detector는 무 API-key 경로만. 유료 경로(gen-assets image gen,
    shoot headed Chrome)는 공개 배포 surface에서 제외. zero-dep 스크립트에 dependency 추가는 공급망 HUMAN_GATE.
```

## 1. 스테이지 기획 (전체 지도)

각 스테이지는 4-lane 분석의 한 우선순위 축을 흡수하며, 임팩트/노력 비율이 높은 순으로 배치했다. 마지막 3개 goal은 `UCx.9`(통합 GO) / `UCx.9.5`(전환 리뷰) / `UCx.10`(다음 스테이지 생성) 고정형.

| # | 스테이지 | 목표(한 줄) | 핵심 산출물 | ui-craft 근거 | anti-ai 트랙 관계 | 선행 |
|---|---|---|---|---|---|---|
| **U1** | 결정론적 계측 형식화 + 라벨 픽스처 baseline | 가장 값싼 임팩트: threat#4(라벨 baseline 부재) 즉시 해소 + deterministic-vs-judged 분리를 코드 심으로 형식화(이미 절반 배움) + brand-lint를 scored token 차원으로 | KR designer/slop 라벨 픽스처 + `baselines.json` + separation 회귀 테스트 + graded 기계 복합점수(additive) + brand-lint token 차원 | evals: `score.mjs`·`baselines.json`·`score.test.mjs`(designer 100 > slop 68), tokens-rules→score.mjs 아키텍처 | **부분 흡수 + 인계** — boolean s2Pass 불변 additive graded; KR 픽스처 코퍼스를 anti-ai **S4 human-baseline로 인계** | — |
| **U2** | detector 상보 룰 흡수 + edit-time 게이트 | anti-ai-eval이 단독으로 놓치는 code-smell/copy 텔 11종 + 정적 pre-flight + agent 편집중 게이트 + severity→exit 이빨 | 신규 detector 11종(placeholder-shipped·em-dash·glassmorphism·emoji-icon·gradient-numeral·image-no-dim·uppercase-heading·scroll-cue·duplicate-cta·generic-cta·outline-none) + static pre-flight + PostToolUse 훅 + `--fail-on`/GATE_EXIT + config/inline-suppress + SARIF | detector: `rules.mjs`·`engine.mjs`; architecture: `hooks.mjs`·`ci.mjs` | **신규(상보축)** — KR-editorial-structural과 직교하는 code-smell/copy 축. anti-ai-eval.js 확장은 S3 파일과 직렬화 + 기존 라인 HUMAN_GATE. dark-pattern/app-a11y 룰은 이식 금지 | U1 |
| **U3** | 커맨드·persona·references 아키텍처 | visigner의 #1 미결(안티-slop 통과인데 timid)의 **누락 APPLY 단계**를 미세 리파인 verb로 채우고, subject-preset·durable memory·references 갭 메움 | 커맨드 9종(bolder/colorize/quieter/distill/polish/typeset/redesign/remember/animate) + SUBJECT-PRESET 테이블 + `.visigner/brief.md` durable memory + references(finish-bar/heuristics/personas/state-design) + acceptance-bar 구조화 | architecture: `commands/`·persona skill·`references/`; evals: acceptance-data.mjs | **신규(생성/리파인축, 무충돌)** — 순수 additive commands/·references/. agent 층 무접촉(visigner 우위) | U2 |
| **U4** | 배포 채널 확장 (무료 제약 준수) | anti-ai-eval을 zero-dep npm detector + MCP 게이트로 공개해 Claude 밖에서도 소환 가능하게 — 단 **설치·사용 무료** | `visigner-detect` npm(zero-dep, 무 API-key) + `visigner-mcp`(check_anti_ai/lint_brand/pick_keywords) + plugin `.mcp.json` 자동등록 + marketplace CalVer auto-bump + `.npmrc` 48h hold | distribution: `package.json`·`mcp/`·`.githooks/pre-commit` | **신규(배포축)** — Go CLI/TUI·skills-CLI는 과설계 skip. 정적 무료 detector만 공개, 유료 gen/shoot 제외 | U3 |

**게이트 규칙(anti-ai 계승):** `UCx.9` = 통합 검증 + adversarial-review GO(GO 없이 다음 스테이지 금지) → `UCx.9.5` = 독립 전환 리뷰(남은 goal diff; 저위험 자동 반영+로그, 범위 변경은 HUMAN_GATE) → `UCx.10` = 다음 스테이지 상세 생성 메타-goal.

**크로스-트랙(신규 스테이지 안 만듦, §5 상세):** ⓐ vision layer(image-baked 텔) = anti-ai **S4 소관** — ui-craft가 visigner 유일우위 확인만. ⓑ U1 KR 픽스처 코퍼스 = anti-ai **S4 semantic-HTML human baseline 입력**으로 인계. ⓒ agent 층 = 손대지 않음(visigner design-critic/a11y-auditor/design-director가 ui-craft code-only 에이전트보다 우위).

---

## 2. Stage U1 — goal 전문 프롬프트

### UC1.1 — 4-lane 분석 동결 + 트랙 조정 계약  ·  **[Claude]**
```
/goal ui-craft 4-lane 분석을 동결하고 이 트랙과 anti-ai 트랙의 충돌·흡수·직렬화 계약을 확정 — 이후 전 goal의
  단일 진실 입력 고정(루프 '테스트/검증'의 계측 기반). ultracode.
[컨텍스트] /tmp/anti-ai/uicraft-analysis.json(4-lane 동결 초안), anti-ai-roadmap.md §5(관계),
  anti-ai-eval.js(harness 1.2.1, 커밋 d31354f, escapeTells 9 any-of), LEDGER.md(anti-ai S3 진행 라인),
  ui-craft /tmp/ui-craft/(MIT).
[작업]
 1. uicraft-analysis.json의 track_relationship을 실측 확인: (a) anti-ai-eval.js/brand-lint.js/shoot.js가
    실제로 anti-ai S3에서 편집중인지 원장·git 상태로 확인, (b) 흡수/신규/인계 분류가 4-lane 근거와 일치하는지.
 2. 파일 직렬화 계약 명문화: 이 트랙이 anti-ai-eval.js를 건드리는 goal(UC1.4·U2 detector)과 anti-ai S3 goal의
    동시성 충돌 규칙 — 원장 잠금 필드 설계 제안(동시 편집 금지 절차).
 3. non-weakenable 불변식 계약: boolean s2Pass any-of 게이트를 약화하지 않는다는 검증가능 기준 1문단(무엇이
    '약화'인지 조작적 정의 — 예: escapeTell 1건→s2Pass=false가 유지되어야 함).
 4. ui-craft attribution 계획: ATTRIBUTIONS.md 초안(이식 예정 항목 목록 + MIT 허가문 보존 위치).
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/uc/UC1.1/track-contract.json: 흡수/신규/인계 분류 실측 확인 + 파일 직렬화 규칙 + non-weakenable
   조작적 정의 + attribution 계획.
 - uicraft-analysis.json과 불일치 0(또는 불일치를 diff로 기록하고 동결본 갱신).
 - ATTRIBUTIONS.md 초안(visigner 루트 예정 경로) — MIT (c) 2026 Eduardo Calvo 명시.
[depends] 없음 — U1 첫 goal.
```

### UC1.2 — KR 라벨 페이지 픽스처 설계 (designer/slop 밴드 + 분리 임계)  ·  **[Claude]**
```
/goal ui-craft baselines.json 패턴을 KR로 이식할 라벨 픽스처 세트를 설계 — designer/slop 각 클래스 + 점수
  밴드 + 분리 임계 정의(루프 '기획'). threat#4(라벨 baseline 부재) 해소의 설계 단계. ultracode.
[컨텍스트] uicraft-analysis.json evals.visigner_fixture_set_design(10 픽스처 스펙), ui-craft
  evals/quality/fixtures/ + baselines.json + score.test.mjs:345-392(in-band + designerMin>slopMax),
  review-rubric.md §A·taste-jury.md 7축, calibration-s2.json(threat#4 근거), references/captures/{400620,403454}.
[작업]
 1. 픽스처 카탈로그 확정(evals 스펙 계승, 필요시 조정): designer 4(editorial-restraint-29cm·
    color-confident-band·proof-dense-material·mobile-quality-floor) + slop 6(ai-purple-template-hero·
    sad-beige-monochrome·fake-blob-render·empty-placeholder-panels·smartstore-urgency-theatre·escape-tell-swap).
    각 픽스처: 무엇을 대표하는지(KR 맥락) + 기계 복합점수 밴드[min,max] + taste 게이트 기대값.
 2. **핵심 판별자 명시**: sad-beige-monochrome = 기계측 기만적 HIGH[75,90] BUT taste_gate=false(두 게이트
    직교 증명, ui-craft 무등가물 — 최고가치). escape-tell-swap = s2Pass=false by construction(escapeTellCount>0).
 3. 분리 임계 정의: designerMin > slopMax가 성립해야 할 최소 gap + 각 밴드 폭(tuning survive하되 drift 잡는
    넓이) 근거.
 4. 재사용 vs 신규 저작 분류: 기존 렌더(v1 웨비나=AI-slop 확정, 와디즈 캡처=사람 designer, starter=중립, v4)로
    커버 가능한 라벨과, 신규 저작 필요한 KR 판별자(특히 sad-beige-monochrome·escape-tell-swap) 구분 → UC1.3 입력.
[DoD]
 - /tmp/anti-ai/uc/fixtures/fixture-spec.json: 10 픽스처(클래스·대표성·밴드·taste 기대·재사용/신규 분류).
 - /tmp/anti-ai/uc/fixtures/baselines-draft.json: fixture→[scoreMin,scoreMax] 밴드 + 분리 임계 gap.
 - 각 슬롯이 '일반 회귀핀이 아니라 계급 판별 baseline'임을 1문단 자기비평(designer/slop 분리 논리).
[depends] UC1.1.
```

### UC1.3 — 라벨 픽스처 코퍼스 조립 (기존 렌더 재사용 + 누락 KR 판별자 저작)  ·  **[Codex]**
```
/goal UC1.2 스펙 기준 라벨 픽스처 코퍼스를 repo에 조립 — 기존 렌더 재사용 + 누락 판별자 저작(루프 '빌드').
  개발=Codex MCP.
[컨텍스트] UC1.2 fixture-spec.json/baselines-draft.json, 기존 렌더(v1/v4 /tmp/anti-ai/webinar/, 와디즈
  captures references/captures/{400620,403454}, assets/starter/index.html), aesthetics.md/@theme, gen-assets.js
  (무료 OAuth 우선 — 유료 5회 초과 HUMAN_GATE).
[작업]
 1. 재사용 픽스처 배선: 기존 렌더를 라벨과 함께 fixtures 디렉터리에 참조/복제(경로 매핑 + 라벨 매니페스트).
 2. 누락 KR 판별자 저작(신규 HTML): sad-beige-monochrome(anti-slop PASS·taste FAIL 구성) ·
    escape-tell-swap(escapeTell ≥1 by construction) · 기타 스펙상 미보유 슬롯. 플랫-벡터 금지 슬롯은 실제 이미지.
    390px 무오버플로 + reduced-motion.
 3. 픽스처 매니페스트: fixtures/manifest.json {name, path, class(designer|slop), expected_band, taste_expected}.
 4. codex 반박 리뷰(각 slop 픽스처가 실제로 목표 텔을 렌더하는지·designer가 clean인지) → 반영.
[DoD — 전부 실행 증거]
 - /Users/elon/visigner/skills/detail-page/tests/fixtures/(또는 합의 경로)에 10 픽스처 실재 + manifest.json.
 - 신규 저작 픽스처 렌더 확인(타일) + sad-beige가 anti-slop 통과·taste 실패 구성임을 자기 스모크로 확인.
 - 재사용 픽스처 라벨 매핑 정확(v1=slop, 와디즈=designer, starter=neutral 등).
 - 유료 에셋 호출 수 보고(5 초과 HUMAN_GATE). additive(신규 파일만). 두 사본 동기화.
[depends] UC1.2.
```

### UC1.4 — 결정론적 기계 복합점수 additive 구현 + brand-lint token 차원 편입  ·  **[Codex]**  ·  ⏸ **HUMAN_GATE 후보**(computeS2Pass 근접 편집 + anti-ai 트랙 SSOT 파일 + git 커밋)
```
/goal anti-ai-eval의 boolean s2Pass를 그대로 둔 채, ui-craft UICraftScore식 graded 기계 복합점수를 additive로
  발행하고 brand-lint.js를 scored token_discipline 차원으로 편입(루프 '빌드'). 개발=Codex MCP.
[컨텍스트] anti-ai-eval.js(computeVerdict severityScore, computeS2Pass L1786-1801 any-of, 리포트 스키마),
  brand-lint.js(:3 'OFF by default', {pass,errorCount,violations} boolean+count), ui-craft
  evals/quality/score.mjs:38-54(WEIGHTS/GRADE_BANDS EXPORTED)·:174-225(_buildResult composite),
  tokens-rules.mjs→score.mjs 편입 패턴, uicraft-analysis.json evals.deterministic_vs_judged/token_dimension.
  **불변식(공통규약 3): boolean s2Pass + escapeTells any-of 게이트 무수정.**
[작업]
 1. graded 기계 복합점수 additive: severityScore(가중 low/med/high=1/2/3)를 0-100 mechanicalScore + letter
    band로 발행 — **EXPORTED weights table + bands**(ui-craft score.mjs:38-54 미러, 공개·검증가능 계약).
    리포트에 mechanicalScore 필드 additive 추가. boolean s2Pass 라인 무수정(별도 필드 공존).
 2. brand-lint token 차원 편입: brand-lint.js findings(raw-hex/banned-font/ai-purple/ΔE)를 flat per-finding
    penalty로 mechanicalScore의 token_discipline 축에 반영(ui-craft WEIGHTS.token_discipline 미러). brand-lint를
    소비 지점에서 import(현재 'nothing imports it' 해소).
 3. **모듈 심(seam) 하드코딩**: 기계 복합점수 산출 모듈 출력객체가 ship-verdict 필드(would_ship 등)를 절대
    안가지도록 분리 — 'mechanical output has no ship-verdict key'가 테스트로 어서트 가능하게(ui-craft
    'never averaged' 규율). judged(taste/review) 소비자는 strictly 별도.
 4. computeS2Pass 근접 편집(리포트 스키마에 필드 추가)이 불가피하면 HUMAN_GATE — 기존 라인 무수정 diff 우선,
    수정 필요 시 소유자 승인 + adversarial-review 경유. git 커밋은 소유자 승인 패턴(승인 전 '커밋 대기').
 5. codex 반박 리뷰(graded가 boolean any-of를 우회/약화하지 않는지 — 불변식 검증) → 반영.
[DoD — 전부 실행 증거]
 - anti-ai-eval.js 리포트에 mechanicalScore(0-100)+letter 실재(1페이지 실행 출력 인용). EXPORTED weights table
   실재(모듈에서 import 가능 증명).
 - brand-lint findings가 token_discipline 축에 반영됨을 실측(brand-lint ON 페이지 vs clean 페이지 점수 delta).
 - **불변식 증명**: boolean s2Pass·computeS2Pass any-of 값이 graded 도입 전후 동일(escape-tell 1건 페이지가
   여전히 s2Pass=false) — 회귀 로그.
 - 모듈 심 증명: 기계 모듈 출력에 ship-verdict 키 부재(grep/스키마 확인).
 - additive diff(기존 라인 수정 시 HUMAN_GATE 번들 + 승인 로그). 두 사본 동기화(바이트 동일).
[depends] UC1.1(직렬화·불변식 계약 확정 후).
```

### UC1.5 — separation/in-band 회귀 테스트 이식 (threat#4 → CI 게이트)  ·  **[Codex]**
```
/goal ui-craft score.test.mjs 패턴을 이식해 라벨 픽스처의 in-band + designer/slop 분리를 잠그는 node-runnable
  회귀 테스트를 신설 — threat#4를 CI 게이트로 전환(루프 '검증'). 개발=Codex MCP.
[컨텍스트] UC1.3 fixtures/manifest.json + baselines-draft.json, UC1.4 mechanicalScore, ui-craft
  score.test.mjs:345-370(in-band loop)·:373-392(designerMin>slopMax), 기존 s2pass-escape-anyof.test.js(참고 —
  SYNTHETIC-only의 한계 대비). attribution(공통규약 5): score.test 패턴 이식 헤더 주석.
[작업]
 1. 회귀 테스트 신설(additive 신규 파일 — 예 tests/mechanical-score.test.js): 각 픽스처를 렌더/로드해
    mechanicalScore 실행 → baselines 밴드 in-band 어서트 + designerMin > slopMax 분리 어서트(최소 gap 검증).
 2. node 단독 러너(--test 또는 자체 러너) — CI/pre-commit에서 실행 가능.
 3. escape-tell-swap 픽스처가 s2Pass=false를 유지하는지 어서트(불변식 회귀 — UC1.4와 정합).
 4. attribution 헤더 + ATTRIBUTIONS.md 항목(score.test 패턴 = ui-craft MIT).
 5. codex 반박 리뷰(밴드가 너무 넓어 drift를 놓치지 않는지·분리가 우연이 아닌지) → 반영. adversarial-review 경유.
[DoD — 전부 실행 증거]
 - 신규 테스트 파일 실재 + node 단독 실행 로그: 전 픽스처 in-band PASS + designerMin>slopMax PASS(실제 값 인용,
   ui-craft의 designer 100 > slop 68에 해당하는 KR 수치).
 - 밴드 변조(임의 fixture 점수 이동) 시 FAIL 재현(회귀 잡음 증명).
 - escape-tell-swap s2Pass=false 어서트 PASS. attribution 헤더 실재.
 - additive(신규 파일). 두 사본 동기화.
[depends] UC1.3, UC1.4.
```

### UC1.6 — 캘리브레이션 + separation 유효성 + anti-ai S4 human-baseline 인계  ·  **[Claude / 스테이지 리스크 goal]**
```
/goal graded 기계 복합점수가 '사람 서열'과 상관되고 designer/slop 분리가 실물에 유지되는지 캘리브레이션하고,
  KR 픽스처 코퍼스를 anti-ai S4 human-baseline 입력으로 인계(이 스테이지 특유 리스크 = 잘못된 지표 최적화 +
  라벨 신뢰성). ultracode.
[컨텍스트] UC1.4 mechanicalScore, UC1.3 픽스처 코퍼스, anti-ai calibration.json/calibration-s2.json(기존
  서열·threat), 실물 와디즈 references/captures/{400620,403454}, anti-ai-roadmap.md S4 개요계약 ②
  (semantic-HTML human reference set 요구), uicraft-analysis.json track_relationship.absorbed_into_antiai.
[작업]
 1. 서열 검증: graded 복합점수를 5+ 페이지(v1 웨비나/v4/와디즈2/starter + sad-beige)에 실행 → verdict 서열이
    상식 서열(와디즈 실물=가장 사람같음 … 원본 웨비나=가장 AI같음)과 일치하는지. 불일치=지표 결함 기록+수정안.
 2. separation 유효성: sad-beige-monochrome이 기계측 HIGH인데 taste FAIL로 분류되는지 실측(두 게이트 직교의
    실제 재현) — 실패 시 픽스처 or 지표 결함.
 3. **S4 인계**: KR 픽스처 코퍼스가 anti-ai S4의 semantic-HTML human baseline 요구를 충족하는지 매핑 —
    calibration-s2 교훈(실물 와디즈=image-flattened stack, monotony=0 퇴화 null → 구조축 캘리브 불가)을 명시하고,
    이 코퍼스가 그 null을 메우는 semantic 대체본임을 인계 노트로 작성.
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/uc/UC1.6/calibration-uc.json: 5+ 페이지 graded 점수 + 기대 서열 + 일치 여부 + separation 유효성
   (sad-beige 직교 재현) + 판정("지표 신뢰 가능/조건부/불가" — 불가면 HUMAN_GATE, 지표 재설계는 범위 변경).
 - /tmp/anti-ai/uc/UC1.6/s4-handoff.json: 픽스처 코퍼스 → anti-ai S4 human-baseline 매핑 + image-flattening 한계
   명시(anti-ai 트랙이 소비할 계약).
[depends] UC1.4, UC1.5.
```

### UC1.7 — 회귀 가드 + 두 사본 동기화 + fable_check  ·  **[Codex]**
```
/goal U1 additive 변경(graded 복합점수·brand-lint 편입·픽스처·회귀 테스트)이 기존 게이트를 안 깨는지 회귀 검증
  (루프 '검증'). 개발=Codex MCP.
[컨텍스트] G1.7/G2.7/G3.7 회귀 절차, 기존 스크립트(shoot.js·brand-lint.js·keyword-picker.js·anti-ai-eval.js),
  anti-ai s2pass-escape-anyof.test.js(기존 회귀), 두 스킬 사본.
[작업]
 1. 기존 스모크 전부 재실행: shoot.js(starter) / brand-lint.js / keyword-picker plan·pick·search·domains·sections
    / anti-ai-eval.js(starter·와디즈2) / 기존 s2pass-escape-anyof.test.js.
 2. graded 복합점수 도입 후에도 anti-ai-eval의 기존 verdict/s2Pass/tellsDetected 출력이 불변(회귀 없음) 확인.
 3. brand-lint 편입이 brand-lint 단독 실행(pre-commit 경로)을 안 깨는지.
 4. Visigner ↔ 표준 사본 전 변경/신규 파일 바이트 동일 + fable_check(code).
[DoD — 전부 실행 증거]
 - 전 스크립트 exit 0 로그. 기존 s2pass-escape-anyof.test.js PASS. anti-ai-eval 기존 출력 불변 diff.
 - starter 오탐 없음(graded 포함 전체). cmp 바이트 동일. fable_check(code)=PASS.
[depends] UC1.4, UC1.5, UC1.6.
```

### UC1.9 — 통합 검증 + adversarial GO 게이트 (불변식 blocking)
```
/goal Stage U1 통합 검증 + adversarial-review GO 게이트.
[작업] U1 산출(트랙 계약·픽스처 설계/코퍼스·graded 복합점수·brand-lint 차원·separation 회귀·캘리브·인계·회귀가드)
  전부 증거 실측 → adversarial-review 스킬로 GO / CONDITIONAL-GO / NO-GO. **non-weakenable 불변식(boolean s2Pass
  any-of 무약화)을 blocking 항목으로 검증**(UC1.4 회귀 로그 + UC1.7 기존출력 불변). 모듈 심(ship-verdict 키 부재)
  + separation 성립(designerMin>slopMax) + S4 인계 계약 확인.
[DoD] - 각 goal 증거 경로 확인 - 불변식 충족 명시적 판정(약화 1건이라도 = GO 불가) - verdict + 게이트 점수 기록
  - NO-GO 또는 지표 신뢰불가면 HUMAN_GATE.
[depends] UC1.1~UC1.7 전부.
```

### UC1.9.5 — 전환 리뷰 (독립 에이전트)
```
/goal 신선-컨텍스트 독립 에이전트가 U2~U4 남은 goal의 추가/변경/삭제/재정렬을 diff로 제안.
[작업] calibration-uc + separation 결과 반영해 로드맵 조정 제안(특히 U2 detector 우선순위·U4 무료 제약).
  저위험 자동 반영 + 원장 변경 로그; 범위 변경은 HUMAN_GATE.
[DoD] - 리뷰 diff + 원장 변경 로그 기입.
[depends] UC1.9.
```

### UC1.10 — 메타-goal: Stage U2 상세 생성  ·  **[Claude]**
```
/goal 원장·U1 실제 결과 기준으로 Stage U2(detector 상보 룰 흡수) 상세 goal 프롬프트 생성.
[작업] uicraft-analysis.json detector.genuine_gaps_absorb(11룰) + architecture_adopt(hook/gating/config/SARIF)를
  입력으로 UC2.x 전문 작성(§3 U2 개요 계약 준수) → 로드맵 §2 확장 + 원장 등록. anti-ai-eval.js 파일 직렬화
  계약(UC1.1) 반영. 원장 ▶ NEXT 이동은 UC1.9.5 이후 오케스트레이터 소관.
[DoD] - U2 goal 전문 6~10개 - 개요 계약 커버 - 파일 직렬화·HUMAN_GATE 매핑.
[depends] UC1.9.5.
```

---

## 3. Stage U2~U4 개요 계약 (각 스테이지 메타-goal이 반드시 포함할 체크리스트)

각 스테이지 상세 goal은 이전 스테이지 `UCx.10`이 **그 시점 실제 상태 기준**으로 생성한다. 모든 스테이지는 마지막 3개 goal을 `UCx.9 / UCx.9.5 / UCx.10` 고정형으로 끝낸다. additive 우선, 기존 동작코드 비-additive 변경은 HUMAN_GATE, ui-craft verbatim 이식은 attribution(공통규약 5).

- **U2 (detector 상보 룰 흡수 + edit-time 게이트):** ① `uicraft-analysis.json detector.genuine_gaps_absorb`의 11룰을 **additive로** 흡수 — 최우선 placeholder-shipped(critical, ~15줄 무의존, 최고가성비) → em-dash-flood → glassmorphism-stack → emoji-icon → gradient-numeral → image-no-dimensions → uppercase-heading(en-label과 dedupe) → scroll-cue(KR 확장) → duplicate-cta-intent(KR 세트) → generic-cta(KR 세트) → outline-none-a11y. 각 룰은 **와디즈 실물 통과 오탐 가드** 필수(genuine_gaps 스펙 계승). ② **정적 pre-flight**: 렌더 전 소스 토큰 스캔(transition-all/animate-bounce class 문자열)을 agent 편집 루프에 — shoot 게이트 앞 fast 무-브라우저 패스. ③ **PostToolUse 훅**(hooks.mjs 이식): Edit|Write|MultiEdit 후 편집 페이지에 anti-ai-eval 실행, critical/major면 exit 2로 findings 피드백, **fails-open**(broken hook이 스킬 정지 금지). ④ **severity→exit gating**(`--fail-on`/GATE_EXIT): verdict∈{ai-likely,suspect} or s2Pass=false → exit 1, design-gate.yml에 실게이트 편입(shoot GATE_EXIT 패턴 미러). ⑤ **config + inline suppression**(.anti-ai-rc.json rules{id:off|warn|error} + `<!-- anti-ai-ignore: <rule> -->`) — 의도된 editorial 선택의 escape hatch(brand-lint ALLOW_PURPLE 대비). ⑥ (선택) SARIF 출력 + fix_apply autofix(기계적 텔만). **경계:** dark-pattern/app-a11y/forms/tables/dataviz 룰은 정적 KR 상세페이지에 오탐 → **이식 금지**(단 forms/state/dataviz는 U3 reference로 재소환). **직렬화:** anti-ai-eval.js detectors[] 확장은 anti-ai S3 파일과 파일 단위 직렬화 + 기존 배열 라인 수정 HUMAN_GATE. ⑦ 회귀 가드 + 두 사본 동기화 + fable_check.

- **U3 (커맨드·persona·references 아키텍처):** ① **미세 리파인 verb 커맨드**(detail-page 위 thin command, 순수 additive) — 우선 bolder(HIGHEST, #1 미결 cure) + colorize + quieter, 이후 distill + polish + typeset, 그다음 redesign + remember + animate. 각 커맨드는 관련 reference 로드 + MOTION/VARIANCE knob 존중. ② **SUBJECT-PRESET 테이블**(persona 메커니즘, 4 sub-skill split 금지): detail-page 내부 1 row/subject{mandatory product-visual-language, required proof-module set, color-forward palette family, refuse할 AI-centre tell} — wadiz-ai-digital-benchmark.md가 이미 1 row, 나머지(물리재/서비스/AI디지털) 완성. ③ **durable per-project 설계 메모리**(`.visigner/brief.md` + decisions + learned-constraints) + remember 커맨드 — calibration threat(human baseline 미영속) 직결, brief.md 선채택. ④ **references 갭**: finish-bar.md(10 orthogonal fix-ordered passes, score→fix HOW 보완) 우선, 이후 heuristics.md/personas.md(USABILITY 렌즈 — taste-jury/conversion rubric 미커버 축), state-design.md(harden/unhappy 전제). ⑤ **acceptance-bar 구조화**(evals): review-rubric §A + taste 7축 → surface-keyed machine-enumerable 체크리스트 데이터(acceptance-data.mjs 패턴, agent skip 방지). ⑥ agent 층 무접촉(visigner 우위) — 채택 없음. ⑦ 회귀 가드 + variety 회귀(신규 term이 새 하우스스타일 안 만드는지) + 두 사본 동기화.

- **U4 (배포 채널 확장 — 무료 제약):** ① **zero-dep npm detector**(`visigner-detect`): anti-ai-eval.js를 bin으로 — package.json에 bin/files allow-list(eval + design-lexicon.json + anti-ai-tells.md + 픽스처) 추가, **patchright drop**(browser 스크립트 제외), main을 anti-ai-eval.js로 repoint. **무 API-key**(소유자 free-install 충족). `.npmrc minimum-release-age=2880`(48h publish hold, 공급망 위생) 이식. ② **MCP 서버**(`visigner-mcp`, 별도 npm): check_anti_ai(HIGH, 먼저 — evaluate(html,{run,tiles,manifest}) pure export로 refactor 필요) + lint_brand + pick_keywords/plan_keywords. **shoot/serve-shoot 노출 금지**(patchright hard-req, MCP는 fast/in-process). ③ **plugin .mcp.json**: MCP 서버를 plugin에 번들해 /plugin install 시 게이트 자동등록(ui-craft 패턴). ④ **marketplace CalVer auto-bump**(.githooks/pre-commit:16 sed-bump 이식): 콘텐츠 변경 시 plugin 캐시 refresh — visigner .husky/pre-commit은 현재 brand-lint만. ⑤ **버전 SSOT**: harnessVersion을 eval SSOT로 유지·MCP 출력에 surface; detector npm은 자체 semver(plugin 버전과 decouple). ⑥ **skip**: Go CLI/TUI(Homebrew+Scoop+goreleaser) + skills-CLI = single-harness plugin엔 과설계, zero 마진 reach. ⑦ **HUMAN_GATE**: npm/MCP registry publish·marketplace 공개버전 bump(대외 비가역) + zero-dep 스크립트 dependency 추가(공급망). ⑧ 회귀 가드(publish 전 detector가 무 API-key로 clean 실행) + 두 사본 동기화.

---

## 4. ui-craft Attribution (MIT 준수)

- **원본:** ui-craft — github.com/educlopez/ui-craft, npm `ui-craft-detect` v0.11.0. **라이선스: MIT, Copyright (c) 2026 Eduardo Calvo** (`/tmp/ui-craft/LICENSE`). visigner 자체 MIT라 라이선스 **호환**.
- **저작권 경계:** 아이디어·패턴·아키텍처(deterministic-vs-judged 분리, persona knob-lock, severity→exit 게이팅)는 저작권 대상 아님 — 자유 흡수. **verbatim 코드**(정규식 룰 본문, score.test 어서트 패턴, hooks.mjs 페이로드, toSarif 렌더러)는 저작물 — 옮길 때 attribution 필수.
- **절차(공통규약 5):** ① 가능하면 **재구현(reimplement)** 으로 흡수(KR 맥락 재작성) — 이 경우 아이디어 차용이라 헤더 주석은 권장(의무 아님). ② 코드를 **복제**하면 이식 파일 헤더에 `// Ported/adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft` + visigner 루트 `ATTRIBUTIONS.md`에 항목(이식 파일·원본 경로·라이선스) + MIT 허가문 전문 보존. ③ npm/MCP 배포 패키지(U4)에도 ATTRIBUTIONS 포함(files allow-list에 추가).
- **이식 예정 항목(UC1.1이 ATTRIBUTIONS.md 초안화):** score.test 분리 어서트 패턴(UC1.5), WEIGHTS/GRADE_BANDS 구조(UC1.4), rules.mjs 정규식 룰(U2), hooks.mjs PostToolUse(U2), engine.mjs config/ignore/SARIF(U2), package.json/.npmrc/.githooks 배포 스캐폴드(U4).

---

## 5. anti-ai 트랙과의 관계 (충돌·중복·흡수·인계 명시)

이 트랙은 anti-ai-roadmap.md(S1·S2 완료, S3 실행중)와 **별개 트랙**이되, 일부 항목은 기존 Stage에 **흡수/인계**되고 일부는 **신규 Stage**다. 구분:

**A. 신규 Stage (이 트랙에서 새로 실행) — 대부분:**
- **U2 detector 11룰** = anti-ai-eval의 KR-editorial-structural 축과 **직교하는** code-smell/copy 축(중복 아님, 상보). premise 정정: raw-hex/ai-purple/transition-all/img-alt/uniform-cards는 이미 brand-lint/shoot/tell-count가 커버 → **이식 안 함**(중복 회피).
- **U3 커맨드/persona/references** = 생성·리파인 축. anti-ai 트랙(탐지 인프라)과 무충돌, 순수 additive.
- **U4 배포** = 배포 축. anti-ai 트랙과 무충돌.

**B. 부분 흡수 + 코드 심 충돌 지점 (조율 필요):**
- **U1 graded 복합점수 ↔ anti-ai s2Pass:** anti-ai S3(G3.1)가 `s2PassSemantics="structural-tell-absence-only; NOT ship-approval"`을 **동결**했고 escapeTells any-of 게이트가 non-weakenable로 잠겨 있다. 이 트랙의 graded 복합점수는 그 boolean을 **치환하지 않고 additive**로만 발행(공통규약 3 불변식). `computeS2Pass`/detectors[] 근접 편집은 anti-ai 트랙 SSOT 파일이라 **파일 직렬화 + 기존 라인 수정 HUMAN_GATE**(UC1.1이 계약).

**C. 기존 anti-ai Stage로 인계 (신규 Stage 안 만듦):**
- **U1 KR 픽스처 코퍼스 → anti-ai S4 human-baseline:** anti-ai S4 개요계약 ②가 "semantic-HTML human reference set 확보"를 요구하고, calibration threat#4(라벨 baseline 부재)가 S4-deferred였다. 이 트랙 U1이 만든 KR 라벨 코퍼스가 **정확히 그 입력** → UC1.6이 인계(anti-ai 트랙이 소비). 실물 와디즈=image-flattened(monotony=0 퇴화 null)라 구조축 캘리브 불가한 한계를 이 코퍼스가 메운다.
- **vision layer(image-baked 텔) → anti-ai S4 소관:** ui-craft도 computed-style/screenshot-diff까지만이라 raster-baked 텔에 무해답 — visigner가 shoot.js 렌더+gen-assets.js 생성 surface로 **유일 우위**임을 확인만. 신규 Stage 안 만듦. ui-craft 'never-average' governance(결정론 s2Pass + 판정 visionVerdict side-by-side, 둘 다 clean이어야 출고)를 anti-ai S4에 계승 권고.

**D. 채택 안 함:**
- **agent 층:** visigner design-critic(opus, shoot 재렌더)·a11y-auditor(axe 실행)·design-director가 ui-craft code-only 에이전트보다 우위 → 손대지 않음. adversarial-review purple 게이트 하위 design-domain 판정자로 라우팅만(별개 사안).
- **out-of-scope detector 룰**(dark-pattern/modal/streaming/forms/tables/dataviz-rainbow): interactive app 대상, 정적 KR 상세엔 오탐 → U2에서 명시 제외.
- **Go CLI/TUI + skills-CLI 배포:** single-harness plugin엔 과설계 → U4에서 skip.

---

## 6. HUMAN_GATE 목록 (자동 진행 중단 — 사전 예고)
- 어떤 `UCx.9` adversarial 판정이 **NO-GO**.
- 같은 goal **3회 실패**(3-스트라이크).
- 원장 ↔ 스킬 SSOT **충돌**, 또는 **anti-ai 트랙과 파일 편집 충돌**(anti-ai-eval.js/brand-lint.js/shoot.js 동시성).
- 기존 동작 스킬 코드의 **비-additive 변경**(기존 라인 수정/삭제) 필요 — 특히 `computeS2Pass`/detectors[] 근접 편집(UC1.4·U2).
- **non-weakenable 불변식 위반 위험**: graded 복합점수 도입이 boolean s2Pass any-of 게이트를 약화할 수 있는 변경(escape-tell 1건→s2Pass=false가 깨지면) → 즉시 중단.
- anti-ai-eval.js/brand-lint.js **git 커밋**(소유자 승인 행위 — anti-ai 트랙 패턴 계승).
- **유료 에셋 생성 다수**(gen-assets 유료 호출 임계 초과 — 픽스처 저작 UC1.3 등).
- **zero-dep 스크립트에 dependency 추가**(anti-ai-eval.js 등 — 공급망 위생, npm config ignore-scripts 확인).
- U1/anti-ai S4 캘리브레이션에서 **지표 신뢰 불가** 판정(측정 기반 붕괴 → 지표 재설계는 범위 변경).
- 전환 리뷰(`UCx.9.5`)의 **범위 변경 제안**(goal 추가/삭제, 스테이지 재편).
- **U4 대외 배포/발송**(npm publish, MCP registry, marketplace 공개버전 bump — 비가역 공개 행동, 소유자 승인).
