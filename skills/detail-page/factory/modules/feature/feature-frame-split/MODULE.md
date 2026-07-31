# feature-frame-split

타입: feature · 규격: SECTION-SCHEMA 1.0.0 · 게이트: section-media-v1

## 1. 왜 이 방식인가

제목과 보조 설명을 두 읽기 면으로 나눈 뒤, 큰 media frame을 그 아래의 공통 검토면으로 둔다. grid는 기능 항목과 시각 면을 같은 위계로 만들므로, 하나의 큰 보조 화면을 확인하게 하는 이 구조에서는 배제했다. split과 standard 기본값은 주장과 세부 설명을 동시에 보이게 하면서 frame을 다음 읽기 단계로 남긴다. 카탈로그에서는 frame을 수반하는 기능 변형을 맡는다.

확인한 타일에는 좌우로 나뉜 도입부와 그 아래의 큰 인터페이스형 면이 보인다. 이 모듈은 그 배치와 위계만 일반화했고, 원본의 문구·브랜드·실측값은 옮기지 않았다.

### 컬렉션 아이템 구조

- featureItems의 아이템은 { title: string, description: string }이다. title은 짧은 세부 항목 이름, description은 독립적으로 읽히는 설명이다.
- 렌더러는 data-slot="featureItems"가 붙은 목록 안에 아이템당 li 하나를 만든다.
- 아이템 수는 2개부터 8개까지다. 목록은 media를 설명하는 부가 목록이므로, media 안에 같은 항목을 중복 생성하지 않는다.

## 2. 의존

- (a) 규격: schemaVersion 1.0.0. contrast-bleed는 COMPOSITION-GRAMMAR의 full-bleed 연속 금지와 전체 비율 상한에 민감하다. split은 같은 (type, layoutArchetype) 조합으로 한 조성에 한 번만 둘 수 있다.
- (b) 토큰: 반전 표면·텍스트·선, primary 저강조색, display/body 글꼴, 여백·활자·반경·그림자 범주를 소비한다. media placeholder도 호스트의 semantic 토큰만 소비한다.
- (c) 다른 모듈: 없음(독립).

## 3. 변경 파급

- media 또는 mediaAlt 슬롯을 바꾸면 → figure 앵커와 접근 가능한 이름 연결을 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-frame-split, node v3/scripts/module-reproduce.js v3/modules/feature/feature-frame-split, 시각 검토.
- layoutArchetype 또는 backgroundBleed 기본값을 바꾸면 → 두 칼럼 헤더와 반전 표면 CSS를 함께 바꾼다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-frame-split, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토.
- 구조 또는 스타일 구획을 바꾸면 → landmark, 제목 계층, semantic 토큰 소비를 함께 검토한다. 재검증: node v3/scripts/section-validate.js v3/modules/feature/feature-frame-split, node v3/scripts/grammar-lint.js <composition.json>, 시각 검토. SECTION-SCHEMA의 슬롯이나 축을 바꾸는 일은 이 모듈 밖의 스키마 개정이다.

## 4. 코치 코멘트

- mediaAlt는 role="img" placeholder의 data-slot-aria-label과 실제 aria-label에 함께 연결된다. mediaAlt만 남기거나 aria-label만 남기는 변경은 section-media-v1에 맞지 않는다.
- data-slot="featureItems"는 목록 컨테이너 하나에만 둔다. 반복 li에 같은 앵커를 붙이면 컬렉션 계약과 맞지 않는다.
- 큰 frame은 실제 자산 주입 위치다. 자산 없이 공개하면 중립 placeholder가 그대로 보인다.
- motion은 none이다. 동작을 추가하면 reduced-motion 처리와 gate profile을 함께 다시 판단해야 한다.

## 5. 100점 예시 링크

pending — 예약 경로: v3/renders/gold/feature--feature-frame-split/

## 6. 출처

- provenance: `mined`
- recordId: linear
- span order: 6 · confidence: med
- sectionSpan: captures/app-ui/linear/tile_01.png#feature
- 범위: 확인된 타일의 분할 도입부·큰 frame·기능 역할만 가져왔다. 원본의 픽셀·카피·브랜드 요소 복제가 아니다.
