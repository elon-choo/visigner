# Anti-AI 디자인 인프라 강화 로드맵 — 6 스테이지 × goal 프롬프트 v1.0

- **도메인:** detail-page 스킬의 anti-AI 디자인 인프라(이번 세션 신설: `references/anti-ai-tells.md`, `references/design-lexicon.md`, `scripts/design-lexicon.json`, `scripts/keyword-picker.js`, `references/design-process.md`)를 **"테스트 → 검증 → 빌드 → 시뮬레이션 → 재평가 → 리서치 → 반복"** 루프로 지속 강화한다.
- **SSOT:** 정본 `/Users/elon/visigner/skills/detail-page/` (미러 `~/.claude/skills/detail-page/`) · 세션 진단·코퍼스 = 프로젝트 메모리 `detail-page-skill.md` + `/tmp/webinar-review/corpus.md` · 원본 실패 사례 = `~/Documents/엘런_모바일연동/01_webinar.html`(docbroker).
- **원장:** `/Users/elon/visigner/docs/LEDGER.md` (단일 진실. RUN 모드에서 매 사이클 재독).
- **오케스트레이션:** Claude Code **ultracode**. **개발·구현 goal = Codex MCP(`mcp__codex__codex`) 위임**; 평가·시뮬·리서치 goal = Claude 서브에이전트/Workflow.
- **구조:** 스테이지 개요 전체 고정(§1) + Stage 1만 goal 전문 확정(§2). 이후 스테이지는 각 `G x.10` 메타-goal이 **그 시점 실제 잔존 텔·측정 결과** 기준으로 상세화(§3 개요 계약 준수). 선작성 낭비·현실 이탈 방지.

## 권고 (Recommendation)

**이 6-스테이지 로드맵을 승인하고, RUN 모드로 `G1.1`(anti-AI 측정 하네스)부터 착수하라.** 근거: 현재 인프라의 최대 미검증 지점은 "이게 실제로 AI 티를 줄이느냐"인데, 그걸 판정할 **계측기(`anti-ai-eval.js`)가 아직 없다.** 계측기 없이 재빌드부터 하면 개선을 수치로 증명할 수 없고 루프가 사람 눈에 의존하게 된다 — 그게 애초 원본 웨비나를 통과시킨 실패다. 따라서 `G1.1`(측정) → `G1.2~1.4`(빌드·시뮬·재평가) → `G1.5~1.6`(리서치) 순서를 고정한다. 대안(웨비나부터 재빌드)은 측정 없는 최적화라 기각. 착수 트리거: "오케스트레이션 시작" 또는 "다음 goal 진행"(goal-orchestrator RUN 모드). **첫 정지점(HUMAN_GATE)은 §4 참조 — 특히 G1.8 하네스 신뢰 판정과 G1.3 유료 에셋 다수.**

## 0. 전 goal 공통 규약 (모든 워커 프롬프트 앞에 붙임)
```
1. 모드: Claude Code ultracode(실작업은 멀티에이전트/Workflow 분해).
   개발·구현 goal = Codex MCP(mcp__codex__codex) 위임; 평가·시뮬·리서치 goal = Claude 서브에이전트/Workflow.
2. SSOT: detail-page 스킬 정본 /Users/elon/visigner/skills/detail-page/ + 미러 ~/.claude/skills/detail-page/.
   진단·코퍼스 = 메모리 detail-page-skill.md, /tmp/webinar-review/corpus.md. 충돌 시 구현 중지, 원장·SSOT 우선.
3. 측정(이 도메인의 핵심): "AI 티가 빠졌다"는 모든 주장은 scripts/anti-ai-eval.js(=G1.1 산출) + shoot.js 타일
   + review-rubric.md + taste-jury.md 재채점으로 증명. 사람 눈 단독 주장 불가. 텔의 '부재'만이 아니라
   선택한 키워드의 '존재(presence)'까지 확인(원본 웨비나를 통과시킨 구멍이 부재-only 검사였음).
4. 교차검증: 아키텍처·스크립트 계약·외부 API 산출물은 codex MCP에 반박 리뷰 → 불일치 해소 후 완료.
   코드 diff 리뷰는 adversarial-review 스킬 경유(글로벌 라우팅).
5. "된다" 주장은 실행 증거(테스트 출력/렌더 타일/harness json/재채점) 첨부. 없으면 '미검증' 표기. 모델재현 금지.
6. 반환 형식: 5줄 요약 + 증거 파일 경로만. 원문·로그·타일은 디스크(/tmp/anti-ai/<goal>/).
7. 기존 동작 스킬 코드는 additive만(신규 파일/추가 블록). 기존 라인 변경·삭제는 HUMAN_GATE.
   스킬 파일 변경 시 Visigner 정본↔표준 사본 두 곳 동기화 필수(바이트 동일).
8. Documents 접근(웨비나 원본 등)은 docbroker(~/.claude/rules/docbroker.md). 문서 저장 기본
   = ~/Documents/엘런_모바일연동/ (docbroker cp-in + stat 검증).
```

## 1. 스테이지 기획 (전체 지도)

각 스테이지는 사용자가 지정한 루프(**테스트→검증→빌드→시뮬→재평가→리서치**)를 **점점 넓은 범위**에 한 바퀴씩 돌리며, 그 스테이지 고유의 능력을 인프라에 추가한다.

| # | 스테이지 | 목표(한 줄) | 핵심 산출물 | SSOT 근거 | 선행 |
|---|---|---|---|---|---|
| **S1** | 측정 하네스 + 웨비나 재빌드 (베이스라인) | 루프를 **측정 가능**하게 만들고, 미검증 상태였던 웨비나 재빌드로 인프라 효과를 before/after 수치로 증명 | `scripts/anti-ai-eval.js`, `webinar/v2`, before/after 리포트, 잔존-텔 목록, 하네스 캘리브레이션 | anti-ai-tells.md·design-lexicon.json·design-process.md; 메모리의 "not yet done: 재빌드" | — |
| **S2** | 1차 갭 클로징 (인프라 패치) | S1 잔존 텔의 근원을 렉시콘/프로세스/피커에 반영, 재빌드로 **두 게이트 + 하네스 통과** 증명 | 패치된 lexicon/process/picker + 수렴한 웨비나 페이지 + 패치 회귀 통과 | S1 residual-tells.json/fixes.json | S1 GO |
| **S3** | 다-subject 일반화 | N개 다양한 subject×mode(물리/디지털/서비스 × landing/detail/wadiz)에 루프를 돌려 단일 사례가 숨긴 갭 발굴 | N개 증명 페이지 + 갭 카탈로그 + 그로 인한 인프라 패치 | korean-detailpage.md·wadiz-ai-digital-benchmark.md·captures/ | S2 GO |
| **S4** | 자동 AI-탐지기 (평가 자동화) | "사람 눈 없이도" AI스러움을 판정하는 탐지기(cross-model 비전 배심 + 텔 presence/absence + 구조-단조도)를 사람 판정·실물 와디즈에 캘리브레이션 | 강화된 `anti-ai-eval.js` + ultracode-workflow Score 통합 + 캘리브레이션 리포트 | taste-jury.md·review-rubric.md·captures/·lib-openai-responses.js | S3 GO |
| **S5** | 루프 자동화 (무인 수렴 엔진) | build→shoot→score→detect→research→patch→rebuild 전 루프를 ultracode Workflow로 캡슐화, subject 하나에 **자기수렴**시키고 원장이 수렴 추적 | 확장된 `scripts/ultracode-workflow.js`(anti-AI 하드닝 모드) + 수렴 데모 | ultracode-workflow.js·orchestrate 스킬 recipes | S4 GO |
| **S6** | 지속 리서치 & 시의성/회귀 방지 | 텔·렉시콘을 AI-디자인 관습 변화에 맞춰 갱신하는 **정기 리서치 케이던스** + 늘어난 렉시콘이 **새 하우스스타일**을 만들지 않게 하는 회귀/다양성 게이트 | 리서치-리프레시 케이던스(schedule/cron 제안) + "no new house style" 회귀 게이트 | anti-ai-tells.md 메타-인사이트(텔은 시의성 자산) | S5 GO |

**게이트 규칙:** `G x.9` = 통합 검증 + adversarial-review GO(GO 없이 다음 스테이지 금지) → `G x.9.5` = 독립 전환 리뷰(남은 goal 추가/변경/삭제/재정렬 diff; 저위험 자동 반영+로그, 범위 변경은 HUMAN_GATE) → `G x.10` = 다음 스테이지 상세 생성 메타-goal.

---

## 2. Stage 1 — goal 전문 프롬프트

### G1.1 — anti-AI 측정 하네스 신설  ·  **[Codex]**
```
/goal detail-page 스킬에 scripts/anti-ai-eval.js 신설(루프의 '테스트' 계측기). ultracode. 개발=Codex MCP.
[컨텍스트] references/anti-ai-tells.md(21 텔), scripts/design-lexicon.json(229 용어 + antiTells[]),
  scripts/keyword-picker.js. 기존 shoot.js는 렌더+overflow/axe/asset 게이트만 — "AI 티" 자체는 미측정.
[작업]
 1. anti-ai-eval.js(CommonJS, 무의존성) 작성. 입력 = 페이지 HTML 경로 (+선택 shoot.js run.json / 타일 dir /
    매니페스트 json). 
 2. design-lexicon.json.antiTells[] + anti-ai-tells.md를 소스로 정적 텔 시그니처 탐지:
    mono-eyebrow 밀도(모노폰트 소형 라벨 개수/섹션), 반복 window-chrome 목업(3-dot chrome 반복수),
    고스트 outline 숫자(대형 text-stroke-only 글리프), 균일 outline chip(동일 1px pill 반복), 
    letter-square avatar, 구조 단조도 monotonyScore(섹션 DOM/클래스 시그니처 유사도 0~1).
 3. presence 훅: 매니페스트 json(섹션×키워드)을 받으면 각 선택 키워드가 페이지에 실제 존재하는지 체크(스텁 허용).
 4. 출력 anti-ai-report.json { tellsDetected:[{tell,evidence,severity}], monotonyScore,
    presence:{expected,found,missing}, verdict }.
 5. codex MCP에 "정적 탐지의 오탐/미탐 경로" 반박 리뷰 → 반영.
[DoD — 전부 실행 증거]
 - node --check 통과.
 - 원본 /tmp/webinar-review/01_webinar.html에 실행 시 tellsDetected에 mono-label·browser-mockup·
   ghost-numeral·structural-monotony가 실제로 잡힘(report.json 첨부).
 - 대조로 assets/starter/index.html 실행 시 tellsDetected 현저히 낮음(오탐 아님을 대비 증명).
 - codex 반박 리뷰 반영 diff. Visigner↔표준 사본 동기화.
```

### G1.2 — 웨비나 이펙트 매니페스트 확정  ·  **[Claude]**
```
/goal 웨비나 subject로 keyword-picker.js plan을 돌려 섹션별 이펙트 매니페스트 확정(루프의 '기획'). ultracode.
[컨텍스트] design-process.md 스테이지 4~6, keyword-picker.js, korean-detailpage.md 섹션 arc.
  원본 카피는 docbroker로 01_webinar.html 텍스트만 추출(룩 복제 금지, 카피·주제만 재사용).
[작업]
 1. 방향 카드 작성: 1줄 컨셉 + 정확히 3개 렉시콘 형용사(메타어 금지) + 안티-레퍼런스(현 AI 수렴 클러스터).
 2. node keyword-picker.js plan --mode detail --moods "hook:...; empathy:...; ..." 로 9섹션 매니페스트 생성.
 3. 섹션마다 2~4 기법 + 1 금지 default 확정; 동일 기법이 3섹션+ 재사용되면 교체(하우스스타일 방지, ≤2섹션).
 4. 각 기법이 요구하는 에셋(실사/생성) 목록화 — 플랫 벡터로 대체 불가한 슬롯 표시.
[DoD]
 - /tmp/anti-ai/webinar/manifest.json (섹션×느낌×기법×금지×에셋).
 - 섹션간 기법 중복 ≤2 검증 출력.
 - 방향 카드가 "아무 브리프에나 맞는 일반형"이 아님을 1문단 자기비평(anti-ai-tells 텔 #21 기준).
```

### G1.3 — 웨비나 재빌드  ·  **[Codex]**
```
/goal manifest 기준 웨비나 페이지 재빌드 → /tmp/anti-ai/webinar/v2/index.html (루프의 '빌드'). ultracode. 개발=Codex MCP.
[컨텍스트] G1.2 manifest, design-process.md 7~9, aesthetics.md/@theme 토큰, gen-assets.js(무료 ChatGPT-OAuth
  경로)로 실사/생성 에셋. 원본은 참고만.
[작업]
 1. manifest의 섹션별 기법을 실제 HTML + Tailwind v4 @theme로 구현. 플랫-벡터 금지 슬롯은 gen-assets.js로 실제 이미지.
 2. 각 DOM 요소에 담당 키워드를 data-속성/주석으로 표기(G1.4 presence 체크가 읽음).
 3. 모바일 스티키 CTA + 390px 무오버플로 + reduced-motion 준수.
 4. codex 자체 빌드, @theme/토큰 단일소스·아키텍처 스스로 점검. 유료 에셋 생성이 다수면 개수·비용을 먼저 보고(HUMAN_GATE 후보).
[DoD]
 - v2/index.html 렌더됨.
 - shoot.js run.json: mobileOverflowPx 0, assetsOk true, axe gating 0.
 - 타일에서 각 섹션이 서로 다른 기법을 실제로 씀이 확인됨(균일 밴드 아님).
 - 생성 에셋 manifest + 각 에셋 픽셀 확인(생성 텍스트 오타 점검).
```

### G1.4 — before/after 시뮬 & 재평가  ·  **[Claude]**
```
/goal 원본 v1 vs 재빌드 v2를 동일 하네스로 재평가(루프의 '시뮬레이션 + 재평가'). ultracode.
[컨텍스트] anti-ai-eval.js(G1.1), shoot.js, review-rubric.md, taste-jury.md, manifest(presence 입력).
  독립 평가자 규칙: v2를 빌드하지 않은 에이전트가 채점.
[작업]
 1. v1(원본)·v2 각각 shoot(데스크톱 타일 + 390px).
 2. anti-ai-eval.js 양쪽 실행 → tellsDetected/monotonyScore/presence.
 3. 두 게이트(anti-slop + taste) 타일 기반 재채점.
 4. before/after 표: 텔 수, monotonyScore, Aesthetic distinctiveness, taste color/ambition, presence found/missing.
[DoD]
 - /tmp/anti-ai/webinar/eval/ 에 v1·v2 report.json + 타일.
 - v2가 v1 대비 tellsDetected 감소 · monotony 개선 · 두 게이트 점수 상승을 **수치로** 증명(미달이면 실패로
   기록 + 원인 명시 — 통과 위조 금지).
 - 타일 인용된 판정(근거 없는 점수 금지).
```

### G1.5 — 잔존 텔 적대적 탐지  ·  **[Claude / red-team]**
```
/goal v2에서 남은 AI 텔을 적대적으로 찾아 근원(렉시콘/프로세스/피커/하네스)에 매핑. red-team-validator 활용.
[컨텍스트] v2 타일 + report, anti-ai-tells.md, design-lexicon.md, design-process.md. 역할 = 회의적 인간 리뷰어 시뮬.
[작업]
 1. v2 타일을 훑어 "아직 AI 같다"는 지점을 각각 구체 인용(타일 좌표/요소).
 2. 각 잔존 텔을 분류: (a)기존 텔 목록에 있음(적용 실패) (b)렉시콘 용어 부족 (c)프로세스 크릿 누락 (d)피커 랭킹 문제 (e)하네스 미탐지.
 3. 심각도·빈도 매김.
[DoD]
 - /tmp/anti-ai/webinar/residual-tells.json { tell, tile_evidence, root_cause_class, proposed_fix_type }.
 - 근원이 "인프라 갭"으로 지목된 항목이 1개+ 이면 S2 입력으로 표시. 없으면 "수렴 근접" 명시(둘 중 하나는 반드시).
```

### G1.6 — 갭 → 수정안 리서치  ·  **[Claude]**
```
/goal residual-tells 각각의 구체 수정안을 리서치·도출(루프의 '리서치'). ultracode(팬아웃 허용).
[컨텍스트] residual-tells.json, /tmp/webinar-review/corpus.md, 웹 리서치 허용.
  수정 타입 = 신규 렉시콘 용어 / anti-ai-tells 신규 텔+카운터 / 프로세스 크릿 규칙 / 피커 로직 / 하네스 탐지 규칙.
[작업]
 1. 각 잔존 텔의 포지티브 대안을 2024~2026 소스로 근거화(형용사 아닌 명사=구체 기법).
 2. design-lexicon.json에 추가할 term 객체 초안(스키마: id/en/ko/domain/def/effect/use_when/sections/moods/anti_ai 준수)
    또는 anti-ai-tells.md 신규 텔+카운터 초안.
 3. 프로세스/피커/하네스 변경이 필요하면 정확한 변경 지점 명시.
 4. 새 용어가 또 다른 하우스스타일이 되지 않도록 variety 영향 1문단.
[DoD]
 - /tmp/anti-ai/webinar/fixes.json (+필요 시 초안 md) — 각 항목 소스 인용 + 스키마 준수 + 적용 지점.
 - S2 goal 생성(G1.10)의 입력임을 명시.
```

### G1.7 — 회귀 가드  ·  **[Codex]**
```
/goal 하네스·피커 신규가 기존 게이트를 안 깨는지 회귀 검증(루프의 '검증'). 개발=Codex MCP.
[컨텍스트] shoot.js, brand-lint.js, ultracode-workflow.js, keyword-picker.js, design-lexicon.json(229). 두 스킬 사본.
[작업]
 1. 기존 스크립트 스모크: shoot.js(starter) / brand-lint.js / keyword-picker.js plan·pick·search·domains·sections 전부 재실행.
 2. design-lexicon.json 스키마 재검증(unique id, mood/section 통제어휘, anti_ai HIGH/MED/LOW).
 3. Visigner ↔ 표준 사본의 5개 신규 파일 바이트 동일 확인.
 4. anti-ai-eval.js가 assets/starter/index.html(깨끗한 페이지)을 오탐하지 않는지.
[DoD]
 - 전 스크립트 exit 0 로그. 스키마 0 에러. 두 사본 diff 없음. starter 오탐 없음. fable_check(code)=PASS.
```

### G1.8 — 측정 타당성 캘리브레이션  ·  **[Claude / 스테이지 리스크 goal]**
```
/goal anti-ai-eval 하네스가 '사람 판정'과 상관되는지 캘리브레이션(이 스테이지 특유 리스크 = 잘못된 지표 최적화). ultracode.
[컨텍스트] anti-ai-eval.js, 확정 진단(원본 웨비나 = AI 티 확정), 실제 와디즈 캡처 references/captures/{400620,403454}
  (사람이 만든 실물), assets/starter/index.html(중립), v2. 선택: lib-openai-responses.scoreImageViaResponses(무료 OAuth) 비전 대조.
[작업]
 1. 하네스를 5개 페이지에 실행: 원본 웨비나 / v2 / 와디즈 400620 / 와디즈 403454 / starter.
 2. 하네스 verdict 서열이 상식 서열(와디즈 실물 = 가장 사람같음 … 원본 웨비나 = 가장 AI같음)과 일치하는지 확인.
 3. 불일치 = 지표 결함으로 기록 + 수정 제안.
 4. (선택) cross-model 비전 세컨드오피니언과 대조.
[DoD]
 - /tmp/anti-ai/calibration.json: 5개 페이지 점수 + 기대 서열 + 일치 여부.
 - 불일치 시 근원 + 수정안. "하네스 신뢰 가능 / 조건부 / 불가" 판정(불가면 HUMAN_GATE — 측정 기반 재설계는 범위 변경).
```

### G1.9 — 통합 검증 + adversarial GO 게이트
```
/goal Stage 1 통합 검증 + adversarial-review GO 게이트.
[작업] S1 산출(하네스·매니페스트·v2·before/after·잔존텔·수정안·회귀·캘리브레이션) 전부 증거 실측 →
  adversarial-review 스킬로 GO / CONDITIONAL-GO / NO-GO.
[DoD] - 각 goal 증거 경로 확인 - adversarial-review verdict + 게이트 점수 기록 - NO-GO 또는 하네스 신뢰불가면 HUMAN_GATE.
```

### G1.9.5 — 전환 리뷰 (독립 에이전트)
```
/goal 신선-컨텍스트 독립 에이전트가 S2~S6 남은 goal의 추가/변경/삭제/재정렬을 diff로 제안.
[작업] residual-tells + calibration 결과 반영해 로드맵 조정 제안. 저위험 자동 반영 + 원장 변경 로그; 범위 변경은 HUMAN_GATE.
[DoD] - 리뷰 diff + 원장 변경 로그 기입.
```

### G1.10 — 메타-goal: Stage 2 상세 생성
```
/goal 원장·S1 실제 결과 기준으로 Stage 2(1차 갭 클로징) 상세 goal 프롬프트 생성.
[작업] fixes.json/residual-tells를 입력으로 G2.1~G2.10 전문 작성(§3 개요 계약 준수) → 로드맵 §2 확장 + 원장 등록.
[DoD] - S2 goal 전문 8~12개 - 원장 NEXT → G2.1.
```

---

## Stage 2 — goal 전문 프롬프트

(G1.10이 2026-07-08 S1 실제 결과 기준 생성. 입력: fixes.json 29 fix + g1_9_conditions, residual-tells.json 18건/인프라갭 10, calibration.json 7 validity_threats, G1.9-verdict.json conditions_for_s2 3건. §0 공통 규약 + §3 S2 개요 계약 ①~⑤ 준수. **착수는 G1.9.5 전환리뷰 통과 후** — 하드게이트 3조건(COND-H01/COND-PROV/COND-HARNESS-PASS-DEF)은 S2 GO(G2.9) 전 충족 필수라 G2.1에 선두 배치. 피커 변경은 S2 범위 없음 — G1.5가 피커 무혐의 판정.)

### G2.1 — 하네스 하드게이트 3조건 이행 (COND-H01·COND-PROV·COND-HARNESS-PASS-DEF)  ·  **[Codex]**  ·  ⏸ **HUMAN_GATE**(anti-ai-eval.js 기존 라인 수정 + git 커밋은 소유자 승인 행위)
```
/goal G1.9 CONDITIONAL-GO의 S2 GO 전 하드게이트 3조건을 anti-ai-eval.js에 이행. ultracode. 개발=Codex MCP.
[컨텍스트] anti-ai-eval.js(1029줄, G1.1 산출, 현재 git 미추적), G1.9-verdict.json conditions_for_s2,
  calibration.json validity_threats #2(monotony 0 = measured/unmeasurable 혼동)·#3(highCount>=1→suspect라
  일관 라벨 페이지 clean 구조적 도달불가)·#7(monotony 렉시컬 키잉 → 버전 간 delta 과대), fixes.json
  g1_9_conditions + HR-02 spec(보더 프리미티브 시그니처 — COND-H01과 병합 지시).
[작업]
 1. COND-H01: monotonyScore 렉시컬 클래스 키잉(L689-699·731-733·768 — v1 어휘 pad/eyebrow/heading 의존)을
    structural topology 시그니처(heading/media/list/card + 보더 프리미티브 계열)로 교체 — 버전·페이지 간
    비교가능화. fixes.json HR-02 detectUniformFrameLoop의 보더 시그니처 수집 로직과 병합 구현(파서 중복 금지,
    크릿 캡 ≤4 vs 하네스 발화 ≥8의 이중 밴드임을 주석 명시). threat#2 해소: <4섹션 early-return(L744-752)은
    0이 아니라 null + measured:false 플래그로.
 2. COND-PROV: 리포트 스키마(L1014-1022)에 harnessVersion(semver + 파일 콘텐츠 해시) 필드 additive 추가.
    anti-ai-eval.js를 visigner repo에 git 커밋 — **커밋 실행은 HUMAN_GATE: 소유자 확인 후에만**(미승인 시
    '커밋 대기' 상태로 보고, 침묵 통과 금지). presence 스푸핑 구조적 완화는 차순위 — 여력 시만.
 3. COND-HARNESS-PASS-DEF: '하네스 통과'의 조작적 정의를 리포트 필드로 구현 —
    s2Pass = (verdict==='clean') OR (verdict==='suspect' AND high-severity tell 0). 정의 근거 주석 포함.
 4. codex 반박 리뷰(구/신 monotony 비교가능성·s2Pass 우회 경로) → 반영. 코드 diff는 adversarial-review 경유.
[DoD — 전부 실행 증거]
 - v1/v2/starter/와디즈 2캡처 5페이지 재실행: 신 monotony가 measured/unmeasured 구분 출력 + 동일 키잉으로
   버전 간 비교 가능함을 리포트로 증명(threat#7 해소 실측).
 - 리포트에 harnessVersion 실재 + git 커밋 해시(소유자 승인 로그 병기 — 승인 전이면 HUMAN_GATE 대기 명시).
 - s2Pass 필드 산식 구현 + v2 재실행 값 기록(threat#3: 일관 라벨 페이지가 s2Pass 도달 가능해졌는지 명시).
 - 기존 라인 수정분 diff 전량 첨부(HUMAN_GATE 번들). 두 사본 동기화(바이트 동일).
[depends] 없음 — S2 첫 goal(G1.9.5 전환리뷰 통과 후 착수).
```

### G2.2 — 하네스 신규 탐지 규칙 7종(HR-01~07) additive 적용  ·  **[Codex]**  ·  ⏸ **HUMAN_GATE**(anti-ai-eval.js L1004 디텍터 배열 기존 라인 확장)
```
/goal S1 fixes.json의 HR 계열 7종을 shoot.js·anti-ai-eval.js에 additive 적용(계약 ① 하네스 몫). 개발=Codex MCP.
[컨텍스트] fixes.json HR-01~HR-07 — spec이 곧 구현 계약(탐지 시그니처·임계값·severity·evidence 스키마·
  오탐 가드·application_point 라인 앵커 전부 명시, 재설계 금지). anti-ai-eval.js는 G2.1 반영본 기준.
[작업]
 1. shoot.js additive: primeLazyAssets(HR-01, 모바일 lazy 전멸 C-01) · auditNumberIntegrity(HR-04, 숫자
    개행 M-07) · auditJustifyRivers 주규칙(HR-05, justify 리버 M-05) · auditStickyHero(HR-07, L-05) —
    각 spec의 호출 지점(데스크톱 L725 직후·모바일 L771 직후)·checks.push·run.json evidence 스키마 그대로.
 2. anti-ai-eval.js additive: detectMarkerSequence(HR-03, 마커 인버전 H-05) · detectEnDisplayLabels(HR-06,
    EN 라벨 배급 L-01) · detectJustifyDisplay(HR-05 보조) 신규 함수 + L1004 디텍터 배열 1줄 확장(HUMAN_GATE).
    HR-02(uniform-frame-loop)는 G2.1에서 병합 구현됨 — 여기서는 등록·발화만 검증.
 3. 각 규칙의 오탐 가드(와디즈 실물 통과 조건)를 spec 그대로 구현. codex 반박 리뷰 → 반영.
[DoD — 전부 실행 증거]
 - node --check 통과(양 파일).
 - v2 실행 시 residual-tells 실측 앵커 재현: 모바일 lazyPrime forced>0(C-01) · numberIntegrity '1,640' 절단
   (M-07) · justifyRivers culprit(M-05) · en-label distinct 3(L-01) · marker-sequence 인버전 05→04(H-05).
 - starter + 와디즈 2캡처에서 신규 규칙 오탐 0(발화 없음 로그).
 - run.json/report에 각 evidence 스키마 필드 실재. diff 첨부. 두 사본 동기화.
[depends] G2.1(동일 파일 anti-ai-eval.js 순차 — 충돌 방지 + HR-02 병합 선행).
```

### G2.3 — 렉시콘/텔 등재 9종(LX-01~09)  ·  **[Codex]**  ·  ⏸ **HUMAN_GATE**(기존 term use_when·antiTells keywords·기존 텔 단락 문구 수정 수반)
```
/goal S1 fixes.json의 렉시콘 term 6종 + 신규 텔 3종을 등재(계약 ① 렉시콘/텔 몫). 개발=Codex MCP.
[컨텍스트] fixes.json lexicon_term_drafts[6](rubrication·named-face-stack·asymmetric-diptych·
  calm-fact-deadline·monogram-seal-system·coverline-block) + new_tell_drafts[3] — 등재용 전문이며 단일
  원천(재작성·의역 금지 = 드리프트 방지), LX-01~09 application_point, design-lexicon.json(229 terms·
  11 antiTells), anti-ai-tells.md(21텔), references/design-lexicon.md.
[작업]
 1. design-lexicon.json: terms 6종 append + antiTells 3종 append(텔#22 uniform document-frame loop ·
    텔#23 typeset fake hand-annotation · 텔#21 인스턴스 archival-ephemera pastiche).
 2. anti-ai-tells.md: #22·#23 삽입(텔#21과 'How to use' 사이) + 텔#5 말미 '3rd-generation survival: see #22'
    상호참조 + 텔#21 말미 'Known attractor instances' + guard rule(아카이벌 장르는 실물 캡처 아티팩트 ≥1
    필수, 시뮬 장치 수 > 실물 수 = convergence flag).
 3. 기존 라인 수정분(HUMAN_GATE): archival-ephemera term use_when에 'requires >=1 captured artifact' 구절 ·
    mono-label antiTell keywords에 "rubrication" 추가.
 4. references/design-lexicon.md 미러링(Typography 표 등 해당 행).
[DoD — 전부 실행 증거]
 - 스키마 재검증 0에러: unique id 235(229+6), moods/sections/domains 통제어휘, anti_ai 등급 —
   fixes.json schema_check와 동일 방법 재실행 로그.
 - keyword-picker.js plan·pick·search·domains·sections 전부 exit 0(신규 term이 피커를 안 깨뜨림).
 - 등재문 ↔ drafts 문자 동일 diff(드리프트 0 증명). 기존 라인 수정 diff 첨부(HUMAN_GATE 번들).
 - 두 사본 동기화(바이트 동일).
[depends] 없음 — G2.1·G2.2와 병렬 가능(파일 비중첩; HR-02→LX-01 tell명 참조는 sourceTell null-safe라 비차단).
```

### G2.4 — 프로세스 크릿 5종(PR-01~05) 등재 + presence 크릿 실측 규칙 승격  ·  **[Codex]**
```
/goal design-process.md에 PR 계열 5종 크릿을 additive 등재하고 presence 크릿을 §8 실측 규칙으로 승격
  (계약 ① 프로세스 몫 + 계약 ③). 개발=Codex MCP.
[컨텍스트] fixes.json PR-01~05 spec/application_point(§7·§8·§9 삽입 지점 라인 명시), design-process.md.
  S1 교훈(G1.3/G1.4): data-kw 숨김 span은 주석 수준 — presence 실측 9샘플 중 구현4/부분4/주석만1,
  42/42 found는 구현 증거 아님 확정. M-01·M-04·H-03·H-04 매니페스트 위반 4건이 전부 PR-01 부재로 통과했음.
[작업]
 1. PR-01 manifest-vs-build 조항별 대조 게이트(§9, SHOOT 직후·점수 산정 전) · PR-02 크로스 자산 세계관·팔레트
    연속성 패스 + gen-plan 팔레트 락(§7+§9) · PR-03 오퍼 팩트 반복 예산 ≤2 + 표기 단일화(§8+§9) ·
    PR-04 캡션-프레임 정합(§9) · PR-05 여백 의도성 스퀸트+isolating 테스트(§9+§7) — 전부 신규 불릿/체크리스트
    행 삽입만(additive), 기존 라인 무수정.
 2. 계약 ③: §8 'Evaluate the plan'에 presence 실측 규칙 승격 명문화 — "선택 키워드의 presence는 data-kw
    주석이 아니라 렌더 타일 실측(요소·좌표 인용)으로만 인정".
 3. '## Where this sits in the skill' 목록에 게이트 존재 1줄.
[DoD — 전부 실행 증거]
 - design-process.md diff가 신규 라인 삽입만임을 증명(기존 라인 0 수정 — diff 첨부).
 - presence 실측 규칙이 §8에 실재(문구 인용). 5개 크릿 각각 spec 체크 항목 대조표(누락 0).
 - 두 사본 동기화. (additive라 HUMAN_GATE 아님 — fixes.json note의 '일괄 리뷰 권장'에 따라 diff를 G2.9
   adversarial 번들에 포함)
[depends] G2.3(크릿이 인용하는 카운터 명사·텔 번호 등재 선행).
```

### G2.5 — 웨비나 v3 재빌드(BD-01~08 집행)  ·  **[Codex]**
```
/goal 인프라 패치 반영 상태에서 웨비나를 v3로 재빌드 — S1 잔존 18건의 빌드 몫 소거(계약 ② 빌드 파트).
  개발=Codex MCP.
[컨텍스트] fixes.json BD-01~08(v2 라인 앵커 포함 — 정확 지점 명시), /tmp/anti-ai/webinar/v2/ + assets,
  manifest.json, 신규 렉시콘 term(G2.3)·프로세스 크릿(G2.4)·신규 shoot 게이트(G2.2). 유료 에셋 임계:
  유료 이미지 호출 5회 초과 시 HUMAN_GATE(원장 규약).
[작업]
 1. v2 → /tmp/anti-ai/webinar/v3/ 복제 후 BD 8건 집행: 모노 키커 26개→한자 넘버링+rubrication 마커(BD-01) ·
    히어로 레터링 진짜 실현(기성 캘리폰트 아웃라인화 권장)+3행 단일 SVG 락업(BD-02) · 70/30 비대칭
    펼침면(BD-03) · 카운트다운 4박스→calm-fact-deadline 폴리오 라인(BD-04) · B/C/F/O 칩 삭제→조직도 SVG
    실주석+typeset metadata line(BD-05) · justify 한글 조판 3단 규칙(BD-06) · EN 라벨 3→1 Colophon만
    잔류(BD-07) · scrollytelling-pinned 4단계 스크롤 채움 구현(BD-08 — 제거 선택 시 매니페스트 개정은
    오케스트레이터 게이트 사안: 중지·보고).
 2. G2.4 크릿 자기 실행: manifest-vs-build 조항별 점검표(PR-01) + 팔레트 락(PR-02) + 반복 예산(PR-03) +
    캡션 정합(PR-04) + 스퀸트(PR-05) 통과 노트 작성.
 3. data-kw는 실구현 요소에만(G1.3 교훈 — 주석용 숨김 span 금지).
[DoD — 전부 실행 증거]
 - v3/index.html 렌더. shoot.js(G2.2 반영본) run.json: mobileOverflowPx 0 · assetsOk · axe 0 + 신규 게이트
   assetPaint pass(모바일 포함) · numberIntegrity broken 0 · justifyRivers culprit 0 · stickyHero 가림 0.
 - PR-01 점검표에서 매니페스트 조항 위반 0(위반 시 빌드 수정 후 재점검 — 통과 위조 금지).
 - 생성 에셋 픽셀 점검(텍스트 오타·글리프 충돌 0) + 유료 호출 수 보고.
[depends] G2.2, G2.3, G2.4.
```

### G2.6 — before/after 재평가: v1/v2/v3 동일 계측기 + 두 게이트 + s2Pass 증명  ·  **[Claude]**
```
/goal v1·v2·v3를 동일 harnessVersion으로 재평가하고 계약 ②(두 게이트 + 하네스 모두 통과)를 수치로 증명
  (루프 '시뮬+재평가'). 독립 평가자 규칙: v3 빌드 비참여 에이전트가 채점.
[컨텍스트] anti-ai-eval.js(G2.1·G2.2 반영본, harnessVersion 고정), shoot.js, review-rubric.md,
  taste-jury.md, manifest.json(presence 입력). presence는 타일 실측만 인정(G2.4 승격 규칙 — 주석 불인정).
[작업]
 1. v1/v2/v3 각각 shoot + anti-ai-eval 실행(리포트에 harnessVersion 기재 확인).
 2. 두 게이트(anti-slop + taste) 타일 기반 재채점.
 3. before/after 표: 텔 수 · 신 monotony(measured 플래그 병기) · s2Pass · 게이트 점수 · presence 실측
   (구현/부분/주석만 3분류).
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/webinar/eval-s2/ 에 3버전 리포트 + 타일.
 - **v3: 두 게이트 통과(각 ≥7.5) AND s2Pass=true(COND-HARNESS-PASS-DEF 조작적 정의 기준)** — 계약 ② 증명.
   미달이면 실패로 기록 + 원인 명시 + G2.5 재작업 라우팅(통과 위조 금지).
 - 3개 리포트의 harnessVersion 문자열 동일 확인(COND-PROV '동일 계측기' 소비 증거).
 - 타일 인용 판정(근거 없는 점수 금지).
[depends] G2.5 (+G2.1·G2.2 하네스 확정).
```

### G2.7 — 회귀 가드 + variety 회귀(하우스스타일 방지)  ·  **[Codex]**
```
/goal G2.1~G2.4 인프라 패치가 기존 게이트를 안 깨고, 신규 term이 새 하우스스타일을 만들지 않음을 검증
  (루프 '검증' + 계약 ④·⑤). 개발=Codex MCP.
[컨텍스트] G1.7 회귀 절차, fixes.json variety_impact(신규 term의 use_when/sections 게이팅 설계 —
  rubrication·seal은 문서 장르 한정, coverline-block hook 한정, calm-fact-deadline offer/cta 한정),
  두 스킬 사본.
[작업]
 1. 기존 스모크 전부 재실행: shoot.js(starter) / brand-lint.js / keyword-picker 5 서브커맨드 /
    anti-ai-eval(starter·와디즈 2캡처).
 2. design-lexicon.json 스키마 재검증(unique id 235, 통제어휘, anti_ai 등급).
 3. 계약 ④ variety 회귀: keyword-picker plan을 상이 브리프 3종+(문서 장르 아닌 무드 포함)으로 실행 —
    (a) 신규 6 term이 비해당 장르 플랜에 침투 0(use_when 게이팅 실효), (b) 문서 장르 플랜에서도
    rubrication+seal 조합이 전 섹션을 지배하지 않음(동일 기법 ≤2섹션 규칙), 분포 수치 리포트.
 4. starter + 와디즈 오탐 0(G2.1·G2.2 신규 디텍터 포함 전체 하네스 기준).
 5. 계약 ⑤: Visigner ↔ 표준 사본 전 변경 파일 바이트 동일 + fable_check(code).
[DoD — 전부 실행 증거]
 - 전 스크립트 exit 0 로그. 스키마 0에러. variety 분포 리포트(플랜 3종 수치). 오탐 0.
 - cmp 바이트 동일. fable_check(code)=PASS.
[depends] G2.1, G2.2, G2.3, G2.4.
```

### G2.8 — 재캘리브레이션 + v3 잔존 텔 재스캔  ·  **[Claude / 스테이지 리스크 goal]**
```
/goal 개조된 하네스를 재캘리브레이션하고(threat 해소 실측) v3 잔존 텔을 적대 재스캔 — S3 입력 생산
  (루프 '재평가+리서치'). ultracode.
[컨텍스트] calibration.json(G1.8 조건부 판정 + 7 validity_threats), G2.1 신 monotony·s2Pass,
  캘리브 5페이지 세트(v1/v2/와디즈 2캡처/starter) + v3, G1.5 적대 스캔 방법론.
[작업]
 1. 신 하네스로 5페이지+v3 재실행 → 서열 유지(rho) 확인 + threat 해소 실측: #2(measured 플래그 작동) ·
    #3(일관 라벨 페이지가 s2Pass 도달 가능해졌는가) · #7(monotony 버전 간 비교가능). 미해소 위협
    (#1 이미지 평탄화 false-negative · #5 starter 순환성 · #6 비전배심 미캘리브)은 S4 이월임을 명시.
 2. v3 타일 적대 재스캔(회의적 인간 리뷰어 시뮬, 타일 좌표 인용) — 신규/잔존 텔 분류(a~e).
 3. 잔존 갭이 있으면 수정 방향 경량 리서치 노트 → S3 입력.
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/calibration-s2.json: 6페이지 점수 + 서열 + threat 해소 표 + 판정(신뢰 가능/조건부/불가 —
   불가면 HUMAN_GATE, 측정 기반 재설계는 범위 변경). 리포트 harnessVersion 기재.
 - /tmp/anti-ai/webinar/residual-tells-s2.json — "인프라 갭 N개(S3 입력)" 또는 "수렴 근접" 중 하나 필수 명시.
[depends] G2.6, G2.7.
```

### G2.9 — 통합 검증 + adversarial GO 게이트 (하드게이트 3조건 blocking)
```
/goal Stage 2 통합 검증 + adversarial-review GO 게이트.
[작업] S2 산출(하드게이트 이행·HR 7종·LX 9종·PR 5종·v3·재평가·회귀·재캘리브) 전부 증거 실측 →
  adversarial-review 스킬로 GO / CONDITIONAL-GO / NO-GO. **G1.9 이월 하드게이트 3조건(COND-H01·COND-PROV·
  COND-HARNESS-PASS-DEF)의 충족을 blocking 항목으로 검증**(G2.1 diff·커밋 로그 + G2.6 harnessVersion 동일성 +
  G2.8 threat#2·#3·#7 해소 실측). G2.4 design-process.md diff 등 additive 변경 번들 일괄 리뷰 포함.
[DoD] - 각 goal 증거 경로 확인 - 3조건 충족 명시적 판정(1건이라도 미충족 = GO 불가) - verdict + 게이트
  점수 기록 - NO-GO면 HUMAN_GATE.
[depends] G2.1~G2.8 전부.
```

### G2.9.5 — 전환 리뷰 (독립 에이전트)
```
/goal 신선-컨텍스트 독립 에이전트가 S3~S6 남은 goal의 추가/변경/삭제/재정렬을 diff로 제안.
[작업] residual-tells-s2 + calibration-s2(특히 S4 이월 위협 #1·#5·#6) 반영해 로드맵 조정 제안.
  저위험 자동 반영 + 원장 변경 로그; 범위 변경은 HUMAN_GATE.
[DoD] - 리뷰 diff + 원장 변경 로그 기입.
[depends] G2.9.
```

### G2.10 — 메타-goal: Stage 3 상세 생성  ·  **[Claude]**
```
/goal 원장·S2 실제 결과 기준으로 Stage 3(다-subject 일반화) 상세 goal 프롬프트 생성.
[작업] residual-tells-s2/calibration-s2/갭 카탈로그 시드를 입력으로 G3.x 전문 작성(§3 S3 개요 계약 준수 —
  4+ subject×mode, 즉석 갭 goal, pairwise distinctiveness) → 로드맵 확장 + 원장 등록. 원장 ▶ NEXT 이동은
  G2.9.5 이후 오케스트레이터 소관.
[DoD] - S3 goal 전문 8~12개 - 개요 계약 ①~⑤ 커버 - 이월 조건 매핑 json.
[depends] G2.9.5.
```

---

## Stage 3 — goal 전문 프롬프트

(G2.10이 2026-07-09 S2 실제 결과 기준 생성. 입력: residual-tells-s2.json(v3 잔존 8텔 = 구조4 + image-baked3 + content2, 하네스 미탐지 8/8), calibration-s2.json(threat#7·#3 해소·#2 부분·#1/#4/#5/#6 S4 이월), G2.9-verdict.json conditions_for_s3 4건(COND-S3-1~4), G2.9.5-transition-review.json diffs_proposed 9건(저위험 8 + morph 게이트 1 — 소유자 2026-07-09 승인). §0 공통 규약 + §3 S3 개요 계약 ①~⑤ 준수. **비-약화 원칙(non-weakenable)**: 이중게이트(anti-slop≥7.5 AND taste≥7.5) AND s2Pass(harness 1.2.1)는 어떤 S3 빌드/평가 goal도 단일게이트(taste-only/harness-only)로 후퇴 금지(G2.9.5 axis-3·diff9). **검출기 재구축 금지**: 4검출기(repeated-decorative-label·letter-code-badge·multiscript-numbering·palette-monotony)는 S2 완료(커밋 d31354f / harness 1.2.1) — S3는 재구축이 아니라 cross-subject 일반화·오탐률 측정으로 repurpose(G2.9.5 diff2).)

**즉석 갭 goal 프로토콜 (계약②):** 어느 subject의 빌드·평가·morph 시험이 인프라 갭(도메인 용어 부족·검출기 미탐·프로세스 크릿 공백)을 드러내면 그 자리에서 ad-hoc `G3.G<n>` goal을 생성한다 — 코드 갭=Codex, 렉시콘/프로세스 갭=Claude. **각 갭 goal은 실행가능 재현 커맨드를 반드시 포함**(self-certifying/무실행 [codex] goal 금지, G2.9.5 diff9). 갭은 갭 카탈로그(G3.8)에 누적 등재하고 원장에 즉시 라인 추가. 신규 검출기 추가로 anti-ai-eval.js 기존 라인 수정·커밋이 필요하면 HUMAN_GATE.

### G3.1 — S3 진입 인프라: 이월조건 이행(회귀 픽스처·s2Pass 의미고정·supersession 확인·검출기 repurpose 선언)  ·  **[Codex]**
```
/goal S2→S3 이월 4조건 중 인프라성 3건(COND-S3-2/3/4)을 이행하고 검출기 repurpose를 선언 — S3 다-subject 루프의 '테스트/검증' 계측 기반 고정. ultracode. 개발=Codex MCP.
[컨텍스트] anti-ai-eval.js(harness 1.2.1, 커밋 d31354f, escapeTells 9종 SET + computeS2Pass L1786-1801 any-of), G2.9-verdict.json conditions_for_s3, G2.9.5-transition-review.json diffs 2~4, eval-s2-verdict.json(supersession 마커 _superseded_note L150-151 적용완료 상태), /tmp/anti-ai/G2.9-h01/partial-removal-test.txt(H-01 부분제거 반증 1회성 텍스트). repo에 test/fixture 인프라 부재(G2.9.5 실측).
[작업]
 1. COND-S3-4(H-01 회귀 픽스처 코드화): partial-removal 반증(escape텔 N-1 잔존해도 s2Pass=false = any-of)을 repo 내 영구·실행가능 회귀 픽스처로 신설(신규 test/fixture 파일 additive — 예 scripts/tests/). computeS2Pass의 any-of(L1800 escapeTellCount>0→false)가 all-of(>=N)로 은밀히 회귀하면 픽스처가 FAIL하도록. node 단독 실행 러너 포함.
 2. COND-S3-3(s2Pass 의미 고정): 리포트 출력 스키마에 additive 필드 s2PassSemantics="structural-tell-absence-only; NOT ship-approval" + anti-ai-tells.md(또는 design-process.md §8)에 해석 규칙 1블록 additive 명문화("s2Pass=true는 '구조텔 부재'만 의미, '출고가능' 아님; image-baked 텔·semantic-HTML human baseline은 S4"). 기존 s2Pass 산식 라인 무수정.
 3. COND-S3-2(supersession 확인): eval-s2-verdict.json의 supersession 마커('SUPERSEDED by harness 1.2.1 — v3 s2Pass=false; contract②-harness-half UNMET') 실재를 실측 확인만(적용완료 — 재적용·기존값 수정 금지). 미존재 시에만 additive 추가.
 4. 검출기 repurpose 선언: anti-ai-tells.md(또는 원장 주석)에 "4검출기는 S2 완료(d31354f) — S3는 재구축 아닌 cross-subject 일반화·오탐률 측정" 1줄 등재.
 5. codex 반박 리뷰(픽스처가 실제로 all-of 회귀를 잡는지·additive가 기존 게이트 무영향인지) → 반영. 코드 diff는 adversarial-review 경유.
[DoD — 전부 실행 증거]
 - H-01 회귀 픽스처 신규 파일 실재 + node 단독 실행 로그: 정상(any-of)에서 PASS, all-of로 변조 시 FAIL(반증 재현).
 - s2PassSemantics 필드 리포트 실재(1페이지 실행 출력 인용) + 해석 규칙 블록 문구 인용.
 - supersession 마커 실측 확인 로그(적용완료 재확인). 검출기 repurpose 선언 라인 실재.
 - additive 증명 diff(기존 라인 0 수정 — 수정 필요 시 HUMAN_GATE). 두 사본 동기화(바이트 동일). git 커밋은 소유자 승인 패턴(승인 전이면 '커밋 대기' 명시, 침묵 통과 금지).
[depends] 없음 — S3 첫 goal.
```

### G3.2 — v3 도주텔 근원 제거 재빌드 → v4 (COND-S3-1)  ·  **[Codex]**
```
/goal 웨비나 v3의 4 구조 도주텔을 근원 제거해 v4로 재빌드 — harness 1.2.1 s2Pass=true AND 이중 taste게이트 ≥7.5 달성(COND-S3-1, 계약②-harness-half 봉합). ultracode. 개발=Codex MCP.
[컨텍스트] /tmp/anti-ai/webinar/v3/, residual-tells-s2.json(v3 8텔: 구조4=hanzi kicker·hanzi numbering(記錄 一/二/三)·B/C/F/O letter-code badge(org-cue rename+svg)·sepia palette-monotony; image-baked3=proof screenshot grid·AI imagery·placeholder seal; content2=dual time-format·seal brand mismatch), anti-ai-eval.js 1.2.1(4검출기 발화), G2.9.5 diff1(재-morph 금지 조항).
[작업]
 1. v3 → /tmp/anti-ai/webinar/v4/ 복제 후 구조 4텔을 **근원 제거**(재-morph 금지 = 같은 텔을 새 form/script/class/raster 채널로 이동하면 근절 불인정·s2Pass=false 처리): hanzi kicker(전 섹션 장식 라벨)→라벨 역할 자체 다양화/제거(폰트만 바꾸지 말 것) · hanzi numbering→넘버링 스캐폴딩 제거 또는 콘텐츠-고유 구조로 대체 · letter-code badge(org-cue+org-chart.svg)→배지 체계 제거 · sepia palette-monotony→editorial 근거 있는 팔레트 폭 확보(near-mono 탈피).
 2. image-baked 3텔(proof screenshot·AI imagery·placeholder seal)은 S4 비전레이어 소관 — v4에서 구조적으로 제거 불가 → **라벨된 S4 테스트 입력으로 고정**(제거하지 말고 명시 기록, G2.9.5 diff6). content 2텔(dual time-format·seal brand)은 갭 카탈로그(G3.8) 이관.
 3. G2.4 PR 크릿 자기 실행(manifest-vs-build·팔레트 락·반복 예산·캡션 정합·스퀸트). 유료 이미지 5회 초과 시 HUMAN_GATE.
[DoD — 전부 실행 증거]
 - v4/index.html 렌더. shoot.js(1.2.1 반영본) run.json: overflow0·assetsOk·axe0 + 신규 게이트 전통과.
 - **anti-ai-eval.js 1.2.1 재측정: v4 s2Pass=true AND 4 구조검출기 미발화**(근원 제거 실증 — 채널 이동 아님을 G3.6 morph 게이트와 정합 확인).
 - **이중 taste게이트: anti-slop≥7.5 AND taste≥7.5**(v3 7.75/7.57 유지·이상 — 최종 채점은 독립 평가자 G3.5, 여기서는 자기 스모크). 미달 시 실패 기록·재작업(통과 위조 금지).
 - S4 이월 3 image텔 라벨 기록 파일. 유료 호출 수 보고. v4는 /tmp 산출(커밋 없음).
[depends] G3.1(s2Pass 의미·픽스처 확정 후).
```

### G3.3 — 4 subject×mode 매니페스트 확정 (물리재/AI디지털/서비스 × landing/detail·wadiz)  ·  **[Claude]**
```
/goal S3 계약① 최소 4개 다양 subject×mode의 이펙트 매니페스트를 확정 — 단일 사례(웨비나)가 숨긴 갭을 발굴할 표본 설계(루프 '기획'). ultracode.
[컨텍스트] design-process.md 4~6, keyword-picker.js(235 term), korean-detailpage.md·wadiz-ai-digital-benchmark.md 섹션 arc, references/captures/{400620,403454}(실물 와디즈 = pairwise 기준). subject 축 = 물리재(physical product) / AI·디지털 제품 / 서비스; mode 축 = landing / detail / wadiz.
[작업]
 1. 최소 4개 subject×mode 조합 선정(축 교차 커버 — 예: 물리재×wadiz, AI디지털×landing, 서비스×detail, +1 자유). 각 subject 도메인 어휘가 서로 크게 달라야(일반화 압박 극대화). 웨비나(서비스×detail)와 중복 금지.
 2. 각 subject 방향 카드: 1줄 컨셉 + 정확히 3개 렉시콘 형용사(메타어 금지) + 안티-레퍼런스(현 AI 수렴 클러스터).
 3. subject마다 keyword-picker.js plan → 섹션 매니페스트(섹션×느낌×기법×금지×에셋), 동일 기법 ≤2섹션(하우스스타일 방지), 신규 term(rubrication·seal 등)이 비해당 장르에 침투하지 않는지 확인(G2.7 게이팅 계승).
 4. 각 매니페스트에 '이 subject가 깨뜨릴 것으로 예상되는 인프라 지점' 1문단(즉석 갭 goal 후보 사전 표기).
[DoD]
 - /tmp/anti-ai/s3/manifests/{subjectA..D}.json (섹션×느낌×기법×금지×에셋) + 각 direction-card.md.
 - 4 subject 축 교차표(물리/AI디지털/서비스 × landing/detail/wadiz 커버 명시) + 섹션간 기법 중복 ≤2 검증 출력.
 - 각 방향 카드 '일반형 아님' 자기비평(텔#21 기준) + 예상 갭 지점 표기.
[depends] G3.1.
```

### G3.4 — 4 subject 다-빌드 (morph-resistance 서브체크 편입)  ·  **[Codex]**  ·  ⏸ **HUMAN_GATE 후보**(유료 에셋 다수 — 4 subject 누적 5회 초과)
```
/goal G3.3 매니페스트 기준 4 subject 페이지를 빌드 — 각 페이지가 이중게이트+s2Pass를 겨냥하고 빌드마다 morph-resistance 서브체크를 통과(계약①·④ + 소유자 승인 morph 게이트). ultracode. 개발=Codex MCP.
[컨텍스트] G3.3 manifests, design-process.md 7~9, aesthetics.md/@theme, gen-assets.js(무료 OAuth 우선), anti-ai-eval.js 1.2.1, G2.9.5 diff8(morph-resistance). 유료 이미지 호출 5회 초과(4 subject 누적) 시 HUMAN_GATE.
[작업]
 1. 각 subject 매니페스트를 실제 HTML + Tailwind v4 @theme로 구현. 플랫-벡터 금지 슬롯은 실제 이미지. data-kw는 실구현 요소에만(주석 span 금지). 모바일 스티키 CTA + 390px 무오버플로 + reduced-motion.
 2. G2.4 PR 크릿 자기 실행(manifest-vs-build·팔레트 락·반복 예산·캡션 정합·스퀸트) — subject별 점검표.
 3. **morph-resistance 서브체크(빌드 편입)**: 각 페이지 빌드 직후, 그 페이지가 쓴 라벨/넘버링/배지/팔레트 프리미티브 중 1개 이상을 의도적으로 re-skin(폰트 교체·스크립트 변경·클래스명 난독화·색 변형)한 변형본을 만들어 anti-ai-eval.js 1.2.1에 통과시켜본다 — 원본이 clean이면 변형본도 clean이어야 정상(re-skin으로 텔이 새로 발화되면 원본에 이미 잠복 텔 or 검출기 form-특이 취약). 발화 delta가 나면 그 subject를 G3.6 적대 게이트·갭 카탈로그로 라우팅.
 4. 어떤 subject가 인프라를 깨뜨리면(도메인 용어 부족 등) 즉석 갭 goal 프로토콜 발동(중지·보고, ad-hoc G3.G<n> 등재).
[DoD — 전부 실행 증거]
 - 4 subject index.html 렌더. 각 shoot run.json: overflow0·assetsOk·axe0 + 신규 게이트 전통과.
 - 각 페이지 anti-ai-eval.js 1.2.1 자기 스모크: s2Pass 값 + 발화 텔 기록(최종 채점은 G3.5 독립 평가자).
 - morph 서브체크 로그(subject별 re-skin 변형본 발화 delta) — delta>0이면 갭 라우팅 기록.
 - PR-01 점검표 위반 0(위반 시 재빌드·재점검). 생성 에셋 픽셀 점검 + 유료 호출 수 보고(5 초과 HUMAN_GATE).
[depends] G3.3 (+G3.1·G3.2 하네스·픽스처 확정).
```

### G3.5 — 4 subject 평가 + 와디즈 pairwise distinctiveness (계약④·⑤)  ·  **[Claude]**
```
/goal 4 subject 페이지를 동일 harnessVersion으로 평가해 계약④(이중게이트+s2Pass)를 수치 증명하고, 실물 와디즈 캡처 대비 pairwise distinctiveness를 적용(계약⑤). 독립 평가자 규칙: 빌드 비참여 에이전트가 채점. ultracode.
[컨텍스트] anti-ai-eval.js 1.2.1, shoot.js, review-rubric.md(pairwise distinctiveness 규칙), taste-jury.md, G3.3 manifests(presence 입력), references/captures/{400620,403454}(실물 와디즈 — image-flattened stack이라 구조축 직접 비교 한계 명시). presence는 타일 실측만 인정(G2.4 규칙).
[작업]
 1. 4 subject 각각 shoot(데스크톱 타일 + 390px) + anti-ai-eval.js 실행(리포트 harnessVersion 1.2.1 확인).
 2. 두 게이트(anti-slop + taste) 타일 기반 재채점 + presence 실측 3분류(구현/부분/주석만).
 3. 계약⑤ pairwise distinctiveness: 4 subject 상호 + 실물 와디즈 대비 review-rubric distinctiveness 적용 — 4 페이지가 서로/실물과 구별되는 개별성 점수(하우스스타일 수렴 아님 확인). 와디즈는 image-flattened라 구조축 직접 비교 불가함을 명시(calibration-s2 교훈).
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/s3/eval/ 에 4 subject 리포트 + 타일 + pairwise 매트릭스.
 - **각 subject: 두 게이트 ≥7.5 AND s2Pass=true(1.2.1)** — 계약④ 증명. 미달 subject는 실패 기록 + G3.4 재작업 라우팅(통과 위조·단일게이트 후퇴 금지).
 - 4 리포트 harnessVersion 동일 확인. pairwise distinctiveness 점수표(subject×subject + subject×wadiz) + 수렴 여부 판정.
 - 타일 인용 판정(근거 없는 점수 금지).
[depends] G3.4.
```

### G3.6 — 검출기 cross-subject 일반화 + 오탐률 측정 + morph-resistance 적대 게이트  ·  **[Claude / red-team]**
```
/goal S2 4검출기를 다-subject에 일반화 검증하고(재구축 아님), 오탐률을 넓은 표본으로 측정하며, 소유자 승인 morph-resistance 게이트를 적대적으로 집행(계약②·③ + morph 게이트). red-team-validator 활용. ultracode.
[컨텍스트] anti-ai-eval.js 1.2.1 4검출기(repeated-decorative-label·letter-code-badge·multiscript-numbering·palette-monotony), G3.4 빌드 4페이지 + v4 + starter + 와디즈2(현행 오탐 0/4는 좁은 세트, G2.9.5 diff2), residual-tells-s2.json(morph 패턴 실증: mono-latin→hanja→SVG/class-rename→raster), G2.9.5 diff8(morph 정의). **검출기 재구축 금지 — 일반화·측정·적대 시험만.**
[작업]
 1. cross-subject 일반화: 4검출기를 4 subject + v4 + 대조 세트에 실행 → 각 검출기가 subject 무관하게 텔을 잡는지(도메인 특이 오작동 없는지) 매트릭스로 정리.
 2. 오탐률 측정(넓은 표본): 사람이 만든 clean 대조군(와디즈2 + starter + 신규 legit 샘플 확보)에서 4검출기 발화율 측정 — 오탐 건수/표본. 좁은 0/4를 넘어 정량화.
 3. **morph-resistance 적대 게이트(전용 집행)**: 각 form-keyed 검출기에 동일 텔의 form-variant를 적대 생성 — multiscript-numbering→circled ①②③·fullwidth digits, repeated-decorative-label→새 폰트/클래스, letter-code-badge→새 클래스명/raster, palette→변형 — 검출기가 여전히 잡는지 시험. **회피되면 그 검출기는 미완으로 처리** → 즉석 갭 goal(G3.G<n>, Codex, 실행가능 재현 커맨드 포함) 라우팅 + 갭 카탈로그 등재.
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/s3/detector-generalization.json: 4검출기 × (4subject+v4+대조) 발화 매트릭스 + 오탐률(건수/표본).
 - /tmp/anti-ai/s3/morph-resistance.json: 각 검출기 form-variant 시험 결과(잡음/회피) + 회피 항목 갭 goal 라우팅 기록. 회피 0이면 "morph-저항 확인", ≥1이면 갭 카탈로그(G3.8) 필수 등재.
 - 검출기 재구축 없음 확인(anti-ai-eval.js 무변경 — 신규 검출기 필요는 즉석 갭 goal로 분리). red-team verdict(BLOCK/WARN/PASS).
[depends] G3.4, G3.5.
```

### G3.7 — 회귀 가드 + variety 회귀(다-subject 하우스스타일 방지) + H-01 픽스처 통과  ·  **[Codex]**
```
/goal S3 신규 subject·매니페스트가 기존 게이트를 안 깨고 새 하우스스타일을 만들지 않으며 H-01 회귀 픽스처가 통과함을 검증(루프 '검증' + 계약④). 개발=Codex MCP.
[컨텍스트] G1.7/G2.7 회귀 절차, G3.1 H-01 픽스처, G3.3 4 subject 매니페스트, design-lexicon.json(235 term), 두 스킬 사본.
[작업]
 1. 기존 스모크 전부 재실행: shoot.js(starter) / brand-lint.js / keyword-picker 5 서브커맨드 / anti-ai-eval.js(starter·와디즈2).
 2. G3.1 H-01 회귀 픽스처 실행 → PASS(any-of 봉합 유지 확인). design-lexicon.json 스키마 재검증(235 id·통제어휘·anti_ai 등급).
 3. variety 회귀(다-subject): 4 subject 기법 분포를 합산해 특정 기법/term이 subject 무관하게 지배하지 않는지(새 수렴점=하우스스타일 미형성) 수치 리포트. 신규 term 비장르 침투 0 재확인.
 4. Visigner ↔ 표준 사본 전 변경 파일 바이트 동일 + fable_check(code).
[DoD — 전부 실행 증거]
 - 전 스크립트 exit 0 로그. H-01 픽스처 PASS 로그. 스키마 0에러. starter+와디즈 오탐 0.
 - variety 분포 리포트(4 subject 합산 — 지배 기법 없음·하우스스타일 0). cmp 바이트 동일. fable_check(code)=PASS.
[depends] G3.1, G3.3, G3.4.
```

### G3.8 — 갭 카탈로그 정리 + 수정안 리서치 → S4 입력  ·  **[Claude]**
```
/goal S3에서 누적된 인프라 갭(즉석 갭 goal·morph 회피·오탐·미탐 content텔)을 갭 카탈로그로 정리하고 수정안을 리서치해 S4 입력을 생산(루프 '리서치' + 계약③). ultracode(팬아웃 허용).
[컨텍스트] G3.6 morph-resistance.json/detector-generalization.json, 즉석 갭 goal 산출들, residual-tells-s2.json content 2텔(dual time-format 재진술·placeholder-seal 브랜드 불일치 — F-5, 현행 검출기·S4 vision 미커버), G2.9.5 diff7. 수정 타입 = 렉시콘 term / 신규 텔+카운터 / 프로세스 크릿 / 하네스 검출 규칙(신규 검출기는 코드 갭 goal로 분리).
[작업]
 1. 갭 카탈로그 누적 등재(계약③): S3 전 goal에서 발굴된 갭을 단일 카탈로그로 통합 — 출처 goal, 갭 유형(도메인 용어/검출기 미탐/morph 회피/오탐/content 일관성), 심각도, 제안 수정 타입, S3 즉시처리 vs S4 이월 분류.
 2. content 2텔(dual time-format·seal brand mismatch) 명시 등재 — cross-asset/content consistency 검출 부재로 S4(또는 신규 크릿) 이월 표시.
 3. 각 갭 수정안을 2024~2026 소스로 근거화(형용사 아닌 명사=구체 기법), 스키마 준수 초안(design-lexicon term 또는 신규 텔). variety 영향 1문단(새 하우스스타일 방지).
[DoD — 전부 실행 증거]
 - /tmp/anti-ai/s3/gap-catalog.json — 누적 갭 전건(출처·유형·심각도·수정타입·S3/S4 분류) + content 2텔 등재.
 - /tmp/anti-ai/s3/fixes-s3.json — 각 갭 수정안(소스 인용·스키마 준수·적용 지점) + S4(G3.10)의 입력임을 명시.
 - "인프라 갭 N개(S4 입력)" 또는 "S3 수렴" 중 하나 필수 명시.
[depends] G3.6 (+즉석 갭 goal 산출 전건).
```

### G3.9 — 통합 검증 + adversarial GO 게이트 (이월 4조건 + morph 게이트 blocking)
```
/goal Stage 3 통합 검증 + adversarial-review GO 게이트.
[작업] S3 산출(이월조건 이행·v4 재빌드·4 subject 매니페스트/빌드/평가·검출기 일반화·morph-resistance·회귀·갭 카탈로그) 전부 증거 실측 → adversarial-review 스킬로 GO / CONDITIONAL-GO / NO-GO. **이월 4조건(COND-S3-1~4) 충족 + morph-resistance 게이트 집행 결과를 blocking 항목으로 검증**(G3.2 v4 s2Pass=true + G3.1 픽스처·의미고정 + G3.6 morph 회피 0 or 갭 등재). 계약④ 이중게이트 non-weakenable 유지 확인(단일게이트 후퇴 0).
[DoD] - 각 goal 증거 경로 확인 - 4조건+morph 게이트 명시적 판정(1건이라도 미충족 = GO 불가) - verdict + 게이트 점수 기록 - NO-GO 또는 morph 게이트 회피 미해소면 HUMAN_GATE.
[depends] G3.1~G3.8 전부.
```

### G3.9.5 — 전환 리뷰 (독립 에이전트)
```
/goal 신선-컨텍스트 독립 에이전트가 S4~S6 남은 goal의 추가/변경/삭제/재정렬을 diff로 제안.
[작업] gap-catalog/fixes-s3 + morph-resistance 결과 반영해 로드맵 조정 제안(특히 S4 계약 gap-fill: semantic-HTML human baseline·image-flattening/AI-image 탐지·morph 게이트 S6 상시화). 저위험 자동 반영 + 원장 변경 로그; 범위 변경은 HUMAN_GATE.
[DoD] - 리뷰 diff + 원장 변경 로그 기입.
[depends] G3.9.
```

### G3.10 — 메타-goal: Stage 4 상세 생성  ·  **[Claude]**
```
/goal 원장·S3 실제 결과 기준으로 Stage 4(자동 AI-탐지기) 상세 goal 프롬프트 생성.
[작업] gap-catalog/fixes-s3/morph-resistance 결과 + S3 이월(semantic-HTML human baseline·image-flattening/AI-image 비전탐지·morph 상시게이트)을 입력으로 G4.x 전문 작성(§3 S4 개요 계약 준수 — cross-model 비전배심, 캘리브레이션 서열 게이트, 오탐/미탐률 라벨셋, 신뢰도 미달 HUMAN_GATE) → 로드맵 확장 + 원장 등록. 원장 ▶ NEXT 이동은 G3.9.5 이후 오케스트레이터 소관.
[DoD] - S4 goal 전문 8~12개 - 개요 계약 ①~⑤ 커버 - S3 이월 매핑 json.
[depends] G3.9.5.
```

---

## 3. Stage 2~6 개요 계약 (각 스테이지 메타-goal이 반드시 포함할 체크리스트)

각 스테이지의 상세 goal은 이전 스테이지 `G x.10`이 **그 시점 실제 상태 기준**으로 생성한다. 아래는 그 생성이 지켜야 할 필수 포함 항목이다. 모든 스테이지는 공통으로 **루프 6단계(테스트→검증→빌드→시뮬→재평가→리서치)** 를 자기 범위에 한 바퀴 돌리고, 마지막 3개 goal은 `G x.9 / G x.9.5 / G x.10` 고정형으로 끝낸다.

- **S2 (1차 갭 클로징):** ① S1 fixes.json의 렉시콘/텔/프로세스/피커 변경을 **additive로** 적용(Codex) — design-lexicon.json 스키마 재검증 필수 ② 변경 후 웨비나 재빌드 → before/after에서 두 게이트 + 하네스 모두 통과 증명 ③ presence 크릿을 design-process.md 스테이지 8에 실측 규칙으로 승격 ④ 새 용어 variety 회귀(하우스스타일 방지) ⑤ 두 사본 동기화 + fable_check(code).
- **S3 (다-subject 일반화):** ① 최소 4개 subject×mode(물리재/AI디지털/서비스 × landing/detail·wadiz) 매니페스트→빌드→평가 ② subject가 인프라를 깨뜨리면(예: 특정 도메인 용어 부족) 그 자리에서 갭 goal 생성 ③ 갭 카탈로그 누적 ④ 각 페이지 두 게이트 + 하네스 통과 ⑤ 실제 와디즈 캡처 대비 pairwise distinctiveness(review-rubric 규칙) 적용.
- **S4 (자동 AI-탐지기):** ① anti-ai-eval에 cross-model 비전 배심(lib-openai-responses, 무료 OAuth) + 구조-단조도 정량화 통합 ② 사람 판정·실물 와디즈·원본 웨비나에 캘리브레이션(서열 일치가 게이트) ③ ultracode-workflow.js Score가 탐지기 verdict를 소비 ④ 오탐/미탐률을 라벨된 페이지셋으로 측정 ⑤ 탐지기 신뢰도 미달 시 HUMAN_GATE.
  - *S3 이월 gap-fill(G2.10 흡수, G2.9.5 diff5·6):* ①에 이미지-평탄화(raster/SVG-baked)·AI생성 이미지 탐지를 명시하고 v4 잔존 3 image-baked 텔(proof-screenshot grid·AI imagery·placeholder seal)을 라벨된 테스트 입력으로 고정. ②에 semantic-HTML(비-image-flattened) human reference set 확보를 추가 — 실물 와디즈는 bare `<img>` stack(0 semantic section·monotony=0 퇴화 null)이라 구조축 캘리브레이션 불가(calibration-s2 실측), 이 null을 human baseline으로 읽으면 false inference.
- **S5 (루프 자동화):** ① ultracode-workflow.js에 anti-AI 하드닝 모드 추가(build→shoot→eval→detect→research-patch 제안→rebuild 반복, best-round 반환) — 기존 워크플로 시그니처 보존(additive/off-by-default) ② 자기수렴 데모(라운드마다 tellsDetected 감소 로그) ③ **인프라 자동 패치는 제안까지만, 적용은 HUMAN_GATE**(자율 코드 수정 폭주 방지) ④ 원장이 수렴 라운드 추적 ⑤ long-job 규약(caffeinate/jobreg)으로 기동.
- **S6 (지속 리서치 & 회귀 방지):** ① 텔·렉시콘을 최신 AI-디자인 관습에 맞춰 갱신하는 정기 리서치 케이던스(schedule/CronCreate 제안 — 승인 후 등록) ② "no new house style" 회귀 게이트: 누적 렉시콘/샘플 페이지의 기법 분포가 새 수렴점을 만드는지 감시 ③ 텔 시의성 만료 규칙(오래된 텔 재검증) ④ 전체 인프라 버전 태깅 + 변경 이력 ⑤ 이 로드맵 자체의 재-DESIGN 트리거 조건 명시.
  - *상시 게이트 추가(소유자 승인 2026-07-09, G2.10 흡수, G2.9.5 diff8):* **morph-resistance 상시 게이트** — 각 form-keyed 검출기에 대해 form-variant(다른 script/class/raster)로 재-skin했을 때의 회피 여부를 정기 재시험(escapeTells 이름-SET이 form-특이적이라 un-named 신채널이 구조적으로 통과하는 근본 리스크 = G1.5→G2.8 반복 대응). S3 G3.6이 최초 집행, S6이 리서치 케이던스에 편입해 상시 운영·회피 발견 시 검출기 갱신 트리거.

---

## 4. HUMAN_GATE 목록 (자동 진행 중단 — 사전 예고)
- 어떤 `G x.9` adversarial 판정이 **NO-GO**.
- 같은 goal **3회 실패**(3-스트라이크).
- 원장 ↔ 스킬 SSOT **충돌** 발견.
- 기존 동작 스킬 코드의 **비-additive 변경**(기존 라인 수정/삭제) 필요.
- **유료 에셋 생성 다수**(gen-assets 유료 호출이 임계 초과 — 기본 임계는 첫 RUN 선언 시 확정).
- G1.8/S4 캘리브레이션에서 **하네스/탐지기 신뢰 불가** 판정(측정 기반 붕괴 → 지표 재설계는 범위 변경).
- 전환 리뷰(`G x.9.5`)의 **범위 변경 제안**(goal 추가/삭제, 스테이지 재편, 아키텍처 전환).
- S5의 **인프라 자동 패치 적용**(자율 코드 수정) — 제안까지는 무인, 적용은 사람 승인.
- Documents 실물 산출의 **대외 배포/발송**(비가역 행동).
