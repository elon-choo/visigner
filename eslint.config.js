// eslint.config.js — flat-config a11y/governance preset for the Visigner detail-page React design source.
//
// What it does: gives INLINE accessibility feedback on JSX/TSX (alt text, label↔control association, valid
// ARIA, no-autofocus, interactive-role keyboard handlers…) via eslint-plugin-jsx-a11y, so the React starter
// (assets/starter-react/) and any app the skill scaffolds get the same a11y discipline the AXE runtime gate
// enforces — but at edit time.
//
// Install (optional peer deps; this preset degrades to a no-op if they're absent rather than crashing):
//   npm i -D eslint eslint-plugin-jsx-a11y @typescript-eslint/parser
// Run:
//   npx eslint assets/starter-react
//
// CommonJS on purpose: the repo root has no `"type":"module"`, so a .js flat config must be CJS (require/
// module.exports). ESLint loads flat configs as either; `node --check eslint.config.js` parses this cleanly.

// jsx-a11y is the a11y rule source. Optional — skip with a notice if not installed.
let jsxA11y = null;
try {
  jsxA11y = require('eslint-plugin-jsx-a11y');
} catch {
  console.warn(
    '[visigner/eslint] eslint-plugin-jsx-a11y not installed — a11y rules skipped. Run: npm i -D eslint-plugin-jsx-a11y',
  );
}

// @typescript-eslint/parser lets ESLint read .ts/.tsx (espree alone chokes on TS syntax). Optional: without
// it we lint only .js/.jsx so the run never hard-fails on a TS file it can't parse.
let tsParser = null;
try {
  tsParser = require('@typescript-eslint/parser');
} catch {
  /* TS files skipped until the parser is installed */
}

const a11yRecommended =
  jsxA11y && jsxA11y.flatConfigs && jsxA11y.flatConfigs.recommended
    ? jsxA11y.flatConfigs.recommended.rules
    : jsxA11y && jsxA11y.configs && jsxA11y.configs.recommended
      ? jsxA11y.configs.recommended.rules
      : {};

const a11yBlock = jsxA11y
  ? [
      {
        files: tsParser ? ['**/*.{js,jsx,ts,tsx}'] : ['**/*.{js,jsx}'],
        plugins: { 'jsx-a11y': jsxA11y },
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
          ...(tsParser ? { parser: tsParser } : {}),
        },
        rules: { ...a11yRecommended },
      },
    ]
  : [];

module.exports = [
  // never lint build output / deps
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'] },
  ...a11yBlock,
  // GOVERNANCE NOTE — brand governance (raw-hex / banned-font / AI-purple bans + @theme↔DTCG token drift) is
  // enforced DETERMINISTICALLY by skills/detail-page/scripts/brand-lint.js and `npm run lint:tokens`, not by
  // ESLint, because they read CSS/@theme color semantics in OKLab that ESLint can't see. For inline Tailwind
  // class validation/ordering add a Tailwind ESLint plugin (e.g. eslint-plugin-better-tailwindcss) as another
  // block here; it's intentionally left out to keep the default dependency surface minimal.
];
