---
name: landing
description: Build a high-converting landing page or Korean 상세페이지 / Wadiz·텀블벅 funding page that does not read as AI-generated. Use for landing pages, sales pages, product detail pages, 상세페이지, 펀딩 상세, hero sections, or improving an existing one.
---

# /landing — build a converting, non-slop page

Brief: **$ARGUMENTS**

Invoke the **detail-page** skill and run its full loop — do not improvise a generic page. **The grade runs by default:** writing the `*.html` page auto-fires the anti-slop critique (the plugin's `PostToolUse` hook → `anti-ai-eval`), so steps 5–6 are not optional — you iterate to the ship gate. If no browser is installed, the static grade still runs and you MUST say *pixel critique is OFF — run `/design-setup`* rather than pass off an unshot page as done; and machine-clean is necessary, not sufficient — carry the taste read.

1. **Brief** — pin the subject, audience, the ONE message; pick mode (Landing / web vs 상세페이지·Wadiz detail mode) and platform width. Set the Schwartz pre-flight (awareness + sophistication) so the page starts in the right place.
2. **Plan the token system** before any code (color / type / layout / signature); reject the banned defaults.
3. **Structure** the section arc for the mode (PASONA for detail mode; hero→proof→value→CTA for landing).
4. **Build** with HTML+Tailwind v4 `@theme` tokens (Korean pages: load Pretendard + a KR display). For detail mode add the mobile sticky thumb-zone CTA and verify zero horizontal overflow at 390px.
5. **Shoot** — render and screenshot via the suite's short wrapper `${CLAUDE_PLUGIN_ROOT}/bin/shoot <file>` (it resolves the global `node_modules` + the skill's `scripts/shoot.js`; long fallback `NODE_PATH=$(npm root -g) node …/scripts/shoot.js`). Run `/design-setup` once if not yet installed, then READ the tiles.
6. **Score** against the 10-dimension rubric; fix the lowest dims and re-shoot until it clears the ship gate (≥8/10, no dim <7, distinctiveness ≥8, zero anti-slop fails).

If image assets would lift it (real 상세페이지 are image-dominant), generate them via the skill's asset-generation flow. Under ultracode, run the skill's `ultracode-workflow.js` so plan candidates compete and every round gates on real pixels. Deliver the file, then note the one thing to improve next.
