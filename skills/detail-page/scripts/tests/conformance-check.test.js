'use strict';

const assert = require('assert');
const test = require('node:test');

const { scoreConformance } = require('../conformance-check.js');

const recipe = `# Fixture recipe

## 1 · TOKEN BLOCK

### 1.1 Color
- **60 — ground:** \`#08090a\`
- **30 — panel:** \`#0f1011\`
- **10 — accent:** \`#5e6ad2\`

### 1.2 Type
- **Display:** resolvedFamily \`domaine\`; fontWeight \`400\`; fontSize \`96px\`
- **Body:** resolvedFamily \`inter\`; fontWeight \`400\`; fontSize \`16px\`
- **Mono:** resolvedFamily \`commitMono\`; fontWeight \`400\`; fontSize \`14px\`

### 1.3 Spacing
- \`8px\`; count 20
- \`16px\`; count 20
- \`24px\`; count 10
- \`48px\`; count 5

### 1.4 Radius
- \`6px\`; count 8
- \`16px\`; count 8

## 2 · LAYOUT CONCEPT + STRUCTURE

Dark hero.

## 3 · THE SIGNATURE

1. **Name:** Left hero plus right floating cube composition [tile_00]
   **Visual decomposition:** Large serif hero text on the left, small pill announcement above it, and a tilted grid of dark square panels on the right. [tile_00]

## 4 · THE CONTENT

Copy.

## 5 · BUILD ORDER

1. Build it.

## 6 · ANTI-SLOP GUARDRAILS

No substitutions.
`;

const conformedBuild = `<!doctype html><style>
body { background:#08090a; color:#fff; font-family:Inter, sans-serif; font-weight:400; }
.hero { display:grid; grid-template-columns:1fr 1fr; gap:24px; padding:48px 16px; }
.announcement { border-radius:9999px; padding:8px 16px; background:#0f1011; }
h1 { font-family:domaine, Georgia, serif; font-weight:400; margin:0 0 24px; }
.cube { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
.panel { border-radius:6px; background:#5e6ad2; padding:16px; }
.mono { font-family:commitMono, monospace; font-weight:400; }
</style><section class="hero"><div><div class="announcement">New</div><h1>Heading</h1></div><div class="cube"><i class="panel"></i><i class="panel"></i><i class="panel"></i></div></section>`;

const naiveBuild = `<!doctype html><style>
body { background:#ffffff; color:#17202a; font-family:Inter, sans-serif; }
.hero { display:grid; grid-template-columns:1fr 1fr; gap:31px; padding:90px 20px; }
.eyebrow { border-radius:100px; padding:7px 12px; background:#eeeaff; }
.terminal { border-radius:16px; padding:25px; background:#101827; }
pre { font:13px/1.8 ui-monospace, monospace; }
</style><section class="hero"><div class="eyebrow">New</div><div class="terminal"><pre>code</pre></div></section>`;

test('conformance oracle discriminates a token-and-signature build from a copy-only control', () => {
  const conformed = scoreConformance({ recipe, build: conformedBuild });
  const naive = scoreConformance({ recipe, build: naiveBuild });

  assert.ok(conformed.overall > naive.overall + 30, `${conformed.overall} should exceed ${naive.overall}`);
  assert.ok(conformed.dimensions.palette > naive.dimensions.palette);
  assert.ok(conformed.dimensions.signature > naive.dimensions.signature);
  assert.ok(conformed.evidence.find((entry) => entry.dimension === 'palette').found.some((entry) => entry.recipe === '#08090a'));
});
