# V3 Capture Targets

Public, captureable targets for the v3 fleet. The SaaS entries do not duplicate the 12 corpus records or the five existing stage-2 overlay captures. The two Wadiz entries are the required GAP-04 recapture targets, using the URLs measured from the archived `400620` and `403454` captures. The three 29CM URLs returned HTTP 200 at selection time and use `capture-spa.js`'s accepted `/products/<number>` route.

| ID | URL | Category | Capture | Selection reason |
| --- | --- | --- | --- | --- |
| saas-framer | https://www.framer.com/ | SaaS product | capture-styles | Visual site-builder product page with a live product-led interface and broad layout system. |
| saas-webflow | https://webflow.com/ | SaaS product | capture-styles | Website-experience platform that exposes a dense product-marketing design system. |
| saas-typeform | https://www.typeform.com/ | SaaS product | capture-styles | Form SaaS with a distinctive conversational interaction and editorial product presentation. |
| saas-miro | https://miro.com/ | SaaS product | capture-styles | Collaborative canvas SaaS covering product UI demonstrations and multi-audience messaging. |
| saas-loom | https://www.loom.com/ | SaaS product | capture-styles | Async video collaboration product with a separate visual language from the existing corpus. |
| kr-29cm-airy-blue-check-shirt-3909782 | https://www.29cm.co.kr/products/3909782 | KR commerce detail | capture-spa | Verified public 29CM numeric product-detail route. |
| kr-29cm-dusk-cotton-pants-3964891 | https://www.29cm.co.kr/products/3964891 | KR commerce detail | capture-spa | Verified public 29CM numeric product-detail route. |
| kr-29cm-burnet-stripe-shirt-4025621 | https://www.29cm.co.kr/products/4025621 | KR commerce detail | capture-spa | Verified public 29CM numeric product-detail route. |
| kr-wadiz-blorism-400620 | https://www.wadiz.kr/web/campaign/detail/400620 | KR commerce detail | capture-spa | GAP-04 URL recovered from the archived public capture. |
| kr-wadiz-haxai-403454 | https://www.wadiz.kr/web/campaign/detail/403454 | KR commerce detail | capture-spa | GAP-04 URL recovered from the archived public capture. |
| portfolio-locomotive | https://locomotive.ca/ | Portfolio / agency | capture-styles | Motion-led digital-studio case-study presentation. |
| portfolio-instrument | https://www.instrument.com/ | Portfolio / agency | capture-styles | Public product and brand agency work-led presentation. |
| portfolio-buck | https://www.buck.co/ | Portfolio / agency | capture-styles | Creative-studio portfolio with rich art direction and transitions. |
| portfolio-koto | https://koto.studio/ | Portfolio / agency | capture-styles | Identity-system-focused brand agency portfolio. |
| marketing-apple-iphone-16-pro | https://www.apple.com/iphone-16-pro/ | Marketing landing | capture-styles | Device launch storytelling with clear media hierarchy. |
| marketing-apple-airpods-pro | https://www.apple.com/airpods-pro/ | Marketing landing | capture-styles | Compact hardware campaign with feature proof and visual pacing. |
| marketing-playstation-ps5 | https://www.playstation.com/en-us/ps5/ | Marketing landing | capture-styles | Product, games, and ecosystem messaging in one landing page. |
| marketing-nintendo-switch-2 | https://www.nintendo.com/us/gaming-systems/switch-2/ | Marketing landing | capture-styles | Family-oriented product explanation in modular campaign blocks. |
| editorial-its-nice-that | https://www.itsnicethat.com/ | Editorial / content | capture-styles | Design-publication card hierarchy. |
| editorial-npr | https://www.npr.org/ | Editorial / content | capture-styles | Information-dense public-news typography and topic navigation. |
| editorial-works-in-progress | https://www.worksinprogress.co/ | Editorial / content | capture-styles | Restrained reading-first long-form publication layout. |
| editorial-vice | https://www.vice.com/en | Editorial / content | capture-styles | Culture-news framing and modular story treatment. |
| other-rust | https://www.rust-lang.org/ | Other | capture-styles | Developer-tool ecosystem navigation and documentation structure. |
| other-mozilla | https://www.mozilla.org/en-US/ | Other | capture-styles | Mission-led technology organization combining advocacy and products. |
| other-charity-water | https://www.charitywater.org/ | Other | capture-styles | Nonprofit impact storytelling and donation pathways. |

Counts: SaaS product 5; KR commerce detail 5 (29CM 3, Wadiz 2); portfolio / agency 4; marketing landing 4; editorial / content 4; other 3. Total 25.

## 역제안(G2.4)

실측 분포에서 5건 미만인 섹션 타입은 `comparison` 0건, `process` 2건, `cta` 1건이다. 아래는 이 세 타입을 보강하기 위한 실행 전 캡처 후보 큐다. URL은 기존 타깃·코퍼스 URL 및 도메인과 겹치지 않으며, 모두 2026-07-24 확인 시 HTTP 200이었다. `robots.txt`에서 해당 경로를 금지한 후보는 제외했다. 아직 캡처는 실행하지 않았다. 역제안 5건의 `Capture`는 세그먼트 재료가 남는 `full-capture`로 지정한다. 실제 실행은 `capture-spa` 계열 또는 `capture-styles`에 DOM/타일 보완을 결합하는 방식이 필요하다.

| ID | URL | 보강 타입 | Capture | 큐 선정 근거 |
| --- | --- | --- | --- | --- |
| reverse-comparison-asana | https://asana.com/compare | comparison | full-capture | 비교 페이지 경로; `/compare`는 robots.txt 금지 목록에 없음. |
| reverse-comparison-dropbox | https://www.dropbox.com/compare | comparison | full-capture | 비교 페이지 경로; `/compare`는 robots.txt 금지 목록에 없음. |
| reverse-comparison-shopify | https://www.shopify.com/compare | comparison | full-capture | 비교 페이지 경로; `/compare`는 robots.txt 금지 목록에 없음. |
| reverse-process-airtable | https://www.airtable.com/product | process | full-capture | 제품 워크플로·사용 흐름을 관찰할 수 있는 공개 제품 페이지; robots.txt가 `/`를 허용. |
| reverse-cta-duolingo | https://www.duolingo.com/ | cta | full-capture | 첫 진입 행동 유도를 관찰할 수 있는 공개 랜딩; 루트 경로는 robots.txt 금지 목록에 없음. |

실행 조건은 기존 `capture-fleet.js` 큐 계약을 따른다. 이 절은 큐 추가만 하며 실제 캡처·외부 사이트 변경은 수행하지 않는다.
