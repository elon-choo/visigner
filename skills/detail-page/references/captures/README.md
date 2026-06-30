# 와디즈 실제 캡처 레퍼런스 (영구 보관 — 어디서든 열람)

이 폴더는 detail-page 스킬이 픽셀 벤치마크로 쓰는 **실제 와디즈 상세페이지 캡처**입니다.
`~/.claude/skills/detail-page/` 아래에 있으므로 **이 맥의 모든 프로젝트/세션에서 동일 경로로 접근**됩니다(프로젝트 한정 아님). /tmp 와 달리 재부팅·세션 종료에도 사라지지 않습니다.

## 보는 법 (택1)
- **한 번에 전체 보기:** `400620/index.html` 또는 `403454/index.html` 를 브라우저로 열기 → 페이지 전체가 위→아래로 스티칭되어 보임.
  - 예: `open ~/.claude/skills/detail-page/references/captures/400620/index.html`
- **개별 타일:** `400620/tile_00.jpg` … 순서대로 페이지 상단→하단.
- **구조 데이터/본문:** `data.json`(헤딩·이미지수·pageHeight), `bodytext.txt`(본문 텍스트 추출).

## 두 레퍼런스
- **400620** — [3.7억] AI 자동화 시스템(블로그·스레드·전자책). 다크/차콜 + 라임/옐로.
- **403454** — [누적2.9억] AI 상세페이지 템플릿(와디즈 1위). 블루/퍼플 + 민트/골드.

문법 추출 정리본은 `../wadiz-ai-digital-benchmark.md`. 픽셀은 여기, 규칙은 거기.

## 새로 캡처(풀 해상도)
```bash
cd ~/.claude/skills/detail-page
MAX_TILES=120 NODE_PATH=$(npm root -g) node scripts/capture-reference-patchright.js \
  https://www.wadiz.kr/web/campaign/detail/400620 /tmp/ref-400620
```
Akamai 차단 시 `{"blocked":true}` → 몇 분 쿨다운 후 재시도. 이 폴더의 JPEG는 축소본이라 세밀한 카피는 재캡처로 확인.
