### 7b · Per-component a11y tests + a stories scaffold (catch the regression in CI, not in review)
The §8 shoot is a page-level smoke gate; a **component** a11y test fails the build the moment a `<Dialog>` loses its label or a button its name. Two equivalent recipes — pick by what the repo already runs:

**Vitest + jest-axe** (unit/jsdom — fast, no browser; best for a Vite/RHF component repo):
```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom jest-axe @types/jest-axe
```
```tsx
// Button.test.tsx
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Button } from "./Button";
expect.extend(toHaveNoViolations);
it("has no a11y violations in each state", async () => {
  for (const props of [{}, { disabled: true }, { loading: true }]) {     // test the STATE MACHINE, not just default
    const { container } = render(<Button {...props}>Save</Button>);
    expect(await axe(container)).toHaveNoViolations();
  }
});
```
**@axe-core/playwright** (real-browser — catches focus-visible/contrast that jsdom can't; use when you already run Playwright):
```bash
npm i -D @playwright/test @axe-core/playwright
```
```ts
import AxeBuilder from "@axe-core/playwright";
test("component story is axe-clean", async ({ page }) => {
  await page.goto("/iframe.html?id=button--loading");                    // a Storybook story URL, or any mounted route
  const r = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa"]).analyze();
  expect(r.violations).toEqual([]);
});
```
Gate on `serious`/`critical` (mirror the §8 `axe.gatingCount` floor) so a component test fails the same class of defect the page gate does.

**Minimal Storybook stories scaffold** — one `*.stories.tsx` per component renders **every state as a named story**, which (a) is the visual catalogue a designer reviews and (b) gives the Playwright recipe above its per-state URLs. Don't over-invest; one story per state is the floor:
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
const meta: Meta<typeof Button> = { component: Button, args: { children: "Save changes" } };
export default meta;
export const Default: StoryObj<typeof Button> = {};
export const Loading: StoryObj<typeof Button> = { args: { loading: true } };
export const Disabled: StoryObj<typeof Button> = { args: { disabled: true } };
```
Scaffold with `npx storybook@latest init` only if the team wants the catalogue; the stories file is useful on its own as the state inventory even without running Storybook.

### 7c · Inline editor governance — a flat-config ESLint preset (feedback BEFORE commit/CI)
The §8 shoot and the §VERIFY brand-lint are commit/CI-time gates; they catch a violation *after* it's written. To get the same a11y + token discipline as **red squiggles in the editor** — the cheapest place to fix it — wire a **flat-config** `eslint.config.js` (ESLint v9) with **`eslint-plugin-jsx-a11y`** (the static half of the axe gate: missing `alt`, label-less control, role misuse, no positive `tabindex`) plus a Tailwind class linter. Don't hand-roll rules — extend the plugin's recommended flat config:
```js
// eslint.config.js (ESLint v9 flat config) — inline a11y + token feedback as you type
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import readableTw from "eslint-plugin-readable-tailwind";   // or: eslint-plugin-tailwindcss (v4 support: track its release)
export default [
  js.configs.recommended,
  jsxA11y.flatConfigs.recommended,                          // ← the static-a11y squiggles
  { files: ["**/*.{jsx,tsx}"],
    plugins: { "readable-tailwind": readableTw },
    rules: { "readable-tailwind/no-unregistered-classes": "warn" } },  // flags a class outside your @theme utilities
];
```
**The suite ships this preset ready-made** — `${CLAUDE_PLUGIN_ROOT}/eslint.config.js` is a CommonJS flat config wiring `eslint-plugin-jsx-a11y` (with an optional `@typescript-eslint/parser` for `.tsx`). It **degrades to a no-op with a notice if those peer deps are absent** rather than crashing, and carries a note that brand governance stays in `brand-lint.js` + `npm run lint:tokens` (ESLint does not duplicate it). Install the peers and point it at the React source:
```bash
npm i -D eslint eslint-plugin-jsx-a11y @typescript-eslint/parser
npx eslint ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter-react
```
The Tailwind plugin can't read your `@theme` for raw-hex leaks the way `brand-lint.js` does, so **pair the preset with a brand-lint editor hook**: run `${CLAUDE_PLUGIN_ROOT}/bin/brand-lint ./src` (dir mode — it already lints `.tsx/.jsx/.css`, see design-system §VERIFY) as an **editor task / on-save watcher** or a lint-staged step, so the token-leak / banned-font / ai-purple ERRORs surface in-editor, not only at the `.husky/pre-commit` hook. Net: jsx-a11y + the Tailwind rule give live a11y/class feedback; the brand-lint wrapper gives live token feedback — the same governance the CI gate (§8) enforces, moved left to keystroke time.

