# module-miner 소스 계약

적용 범위: v3 module-miner의 구조(스팬)·스타일 참조 입력

## 1. 구조(스팬) 채굴 허용 소스

구조(스팬) 채굴의 소스 우주는 `v3/segments/`에 실제 존재하는 아래 22개 JSON 레코드로 한정한다. 이 목록 밖의 캡처·스타일 파일은 구조 스팬의 근거로 사용할 수 없다.

- `400620.json` — deprecated
- `403454.json` — deprecated
- `arc.json`
- `clerk.json`
- `cursor.json`
- `ecommerce-teenage-engineering-ep-133.json`
- `editorial-pudding-ethical-champions.json`
- `kr-29cm-airy-blue-check-shirt-3909782.json`
- `kr-29cm-burnet-stripe-shirt-4025621.json`
- `kr-29cm-dusk-cotton-pants-3964891.json`
- `kr-detail-29cm-hata-3989017.json`
- `kr-detail-29cm-mongdol-2530940.json`
- `kr-wadiz-blorism-400620.json`
- `kr-wadiz-haxai-403454.json`
- `linear.json`
- `posthog.json`
- `railway.json`
- `raycast.json`
- `resend.json`
- `stripe.json`
- `supabase.json`
- `vercel.json`

사유: 세그먼트는 관찰 구역과 구조 스팬을 남기는 검토 가능한 재료이므로 구조 채굴의 근거를 재현할 수 있다.

## 2. styles-only 참조 제한

fleet의 `capture-styles` 승격분 20건은 아래 ID의 `references/captures/v3-fleet/<id>/styles.json`만을 가리킨다.

- `saas-framer`
- `saas-webflow`
- `saas-typeform`
- `saas-miro`
- `saas-loom`
- `portfolio-locomotive`
- `portfolio-instrument`
- `portfolio-buck`
- `portfolio-koto`
- `marketing-apple-iphone-16-pro`
- `marketing-apple-airpods-pro`
- `marketing-playstation-ps5`
- `marketing-nintendo-switch-2`
- `editorial-its-nice-that`
- `editorial-npr`
- `editorial-works-in-progress`
- `editorial-vice`
- `other-rust`
- `other-mozilla`
- `other-charity-water`

이 20건은 스타일 축인 토큰·팔레트·타이포·스페이싱 전용 참조이며 구조(스팬) 채굴에는 사용하지 않는다.

사유: styles-only 결과는 스타일 축을 확인하는 재료이지 세그먼트 기반 구조 스팬을 보장하는 소스가 아니므로, 구조 근거로 사용하면 관찰 범위를 넘는다.

## 3. Wadiz 중복 레코드 처리

구 Wadiz 본체 레코드는 채굴 시 deprecated로 취급한다.

| deprecated 레코드 | 우선 레코드 |
| --- | --- |
| `400620.json` | `kr-wadiz-blorism-400620.json` |
| `403454.json` | `kr-wadiz-haxai-403454.json` |

사유: 오버레이 재캡처본을 우선해야 동일 대상의 본체·재캡처가 구조 신호에 이중 가중되지 않는다.

## 4. 채굴 판정 요약

- 구조 스팬: §1의 22개 세그먼트만 사용한다.
- 스타일 축: §2의 20건은 토큰·팔레트·타이포·스페이싱 참조로만 사용한다.
- Wadiz: §3의 두 deprecated 레코드는 우선 레코드와 함께 가중하지 않는다.
