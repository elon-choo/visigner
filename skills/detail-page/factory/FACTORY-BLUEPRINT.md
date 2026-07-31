# Visigner v3 공장 실행 설계도

상태: G4.6 가상 인입 리허설 기준. 이 설계도는 `v3/INTAKE-COMMAND.md` 0.2와 강화 composer의 실제 경계를 함께 기록한다.

## 입력에서 산출까지

| 구간 | 입력 | 처리와 책임 | 산출 | 통과 조건 |
| --- | --- | --- | --- | --- |
| Step 0 | 사람에게서 받은 원자료 | 사람이 수집하고 AI가 정형화 보조 | `input.md` | 가게·행동·목적지·소개·미디어·증거·법적 범위가 명시됨 |
| Step 1 | `input.md` | AI가 사실만 브리프로 정형화 | `brief.md` | **여기서 사람 컨펌** 후 `confirmed` |
| Step 2 | confirmed `brief.md`, 카탈로그 | AI가 근거·재료 매핑·문법 사전 점검을 제안 | `section-plan.md`, composer용 `brief.json` | **여기서 사람 컨펌** 후 `confirmed`; `brief.json`은 확정 플랜과 동일해야 함 |
| Step 3 | `brief.json` | 강화 composer가 선택 후 순수 조립 | `selection.json`, `page.html` | hero/footer 위치, CTA 상한, adjacent-same-type 금지 등 선택 규칙 통과 |
| Step 4 | selection·page | two-tier가 문법·결합·토큰·anti-AI를 검인 | gate JSON·로그 | exit 0만 다음 단계 입력이 됨 |
| Step 5 | 렌더·게이트 로그·원자료 | 사람이 고객용 확인을 마친다 | `delivery-checklist.md` | **여기서 사람 컨펌** 후에만 실제 납품 |

## 현재 구현의 정확한 경계

`INTAKE-COMMAND.md`가 목표로 적은 `composition.json`과 슬롯 값 파일은 아직 현 composer의 산출물이 아니다. 현재 구현은 `brief.json`을 받아 `selection.json`과 `page.html`을 만든다. 섹션 플랜의 재료 매핑은 소급성 기록이며, composer는 아직 그 슬롯 값을 페이지로 주입하지 않는다.

따라서 실제 고객용 슬롯·목적지·연락처·미디어가 HTML에 주입됐다는 증거가 없으면 Step 5의 실제 납품은 반드시 막는다. G4.6의 `archive-lantern`은 이 제한을 드러낸 기술 리허설 납품이지 고객용 페이지 납품이 아니다.

## 사람 개입 3지점

1. **게이트 1 — 여기서 사람 컨펌:** 원자료에서 생성된 브리프의 사실·열린 질문·톤 원문을 확정한다.
2. **게이트 2 — 여기서 사람 컨펌:** 섹션 순서·모듈·변형·TBD 처리와 `brief.json` 브리지를 확정한다.
3. **게이트 3 — 여기서 사람 컨펌:** 실제 렌더, 슬롯 출처, CTA, 법적·연락처, 대체 텍스트를 확인하고 서명한다.

가상 리허설에서는 세 지점을 `rehearsal-auto-approved`로 표시할 수 있지만, 그 표시는 실사람 승인이나 고객 납품을 대체하지 않는다.

## Fail-closed 경로

| 실패 지점 | 자동 처리 | 허용되지 않는 우회 |
| --- | --- | --- |
| 필수 원자료 누락 | `brief.md`를 draft로 유지하고 열린 질문으로 되돌림 | 사실·수치·후기·연락처 생성 |
| 증거 재료 0건 | proof 자동 제외 | 가상 증거로 proof 채우기 |
| 게이트 1/2 미확정 | 다음 단계 입력으로 사용 금지 | 자동으로 confirmed 처리 |
| composer 문법 실패 | `composer-fallback.js`가 최대 2회 대체 후보를 시도하고 계속 실패하면 `failure-report.json`으로 종료 | 규칙 완화·실패 페이지 납품 |
| two-tier 실패 | Tier 2는 진단만 수행; Step 5로 진행 금지 | Tier 2 결과로 Tier 1 실패를 덮기 |
| 고객용 슬롯 미주입 또는 고객용 체크 미완료 | 실제 납품 보류 | 기술 리허설을 실제 고객 납품으로 표기 |

## 결정론과 판단의 경계

| 판단 구간 | 결정론 구간 |
| --- | --- |
| 원자료 수집, 사실성 판단, 톤 원문 해석, 섹션 목적·모듈 선택, 사람 게이트 승인 | 고정된 `brief.json`과 변하지 않은 카탈로그·gold exemplar에서 selection 재생성, 고정된 `selection.json`과 템플릿에서 HTML 조립, 문법·two-tier 검인 |

선택은 같은 `brief.json`과 동일 카탈로그 상태에서 재생성할 때 결정적이다. 조립은 같은 `selection.json`과 동일 템플릿·토큰 소스에서 byte-identical이어야 한다. 시간·랜덤·네트워크는 조립 입력이 아니다.

## 재현 절차

같은 confirmed 브리프를 보존한 채 아래처럼 직접 산출물 이름만 바꿔 실행한다.

```bash
node v3/scripts/composer-select.js v3/intake-run/<client>/brief.json v3/composer/g4.6-<client>/selection.replay.json
node v3/scripts/composer-assemble.js v3/composer/g4.6-<client>/selection.replay.json v3/composer/g4.6-<client>/page.replay.html
cmp -s v3/composer/g4.6-<client>/selection.json v3/composer/g4.6-<client>/selection.replay.json
cmp -s v3/composer/g4.6-<client>/page.html v3/composer/g4.6-<client>/page.replay.html
shasum -a 256 v3/composer/g4.6-<client>/page.html v3/composer/g4.6-<client>/page.replay.html
```

`archive-lantern` 리허설의 실제 비교·해시는 `docs/goals/evidence/v3/G4.6/archive-lantern/reproduction.log`에 남긴다.
