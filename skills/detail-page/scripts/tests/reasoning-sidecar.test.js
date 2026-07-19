'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { inject } = require(path.join(ROOT, 'scripts', 'librarian-inject.js'));
const {
  DEFAULT_REASONING_DIR,
  validateFile,
  validateTarget,
} = require(path.join(ROOT, 'scripts', 'reasoning-validate.js'));

const DUPLICATE_KEY_FIXTURE = path.join(
  DEFAULT_REASONING_DIR,
  'fixtures',
  'duplicate-decision-rule-key.json',
);

test('injector joins the exact brief category to a delimited reasoning sidecar', () => {
  const result = inject({
    category: 'saas-marketing-site',
    awareness: 'solution-aware',
  });

  const expectedSidecar = [
    '## Category reasoning sidecar',
    '',
    'Category: `saas-marketing-site`',
    'Recommended pattern: A product-in-context hero followed by workflow proof, credibility bands, and a focused product CTA.',
    '',
    '### Decision rules (if/then)',
    '- `if_data_heavy` → Show a readable real product state and reserve blur or glass effects for nonessential framing.',
    '- `if_enterprise_buyers` → Place security, compliance, and customer proof beside the product mechanism rather than in a distant footer.',
    '- `if_new_category` → Explain the before-and-after workflow before naming abstract platform benefits.',
    '',
    '### Anti-patterns',
    '- Opaque product screenshots that cannot teach the workflow.',
    '- A dark gradient or glossy blob used as a substitute for product evidence.',
    '- Feature grids whose cards do not add up to a product narrative.',
    '',
    'Severity: `HIGH`',
  ].join('\n');

  assert.strictEqual(result.retrieval.matches[0].id, 'linear');
  assert.ok(result.groundingBlock.endsWith(expectedSidecar));
  assert.ok(result.groundingBlock.includes('\n---\n\n## Category reasoning sidecar\n'));
});

test('reasoning validator accepts every shipped category sidecar', () => {
  const result = validateTarget(DEFAULT_REASONING_DIR);
  assert.ok(result.records.length >= 8);
  assert.ok(result.records.every(({ record }) => record.category));
});

test('reasoning validator rejects the fixture with a duplicate decision-rules key', () => {
  assert.ok(fs.existsSync(DUPLICATE_KEY_FIXTURE));
  assert.throws(
    () => validateFile(DUPLICATE_KEY_FIXTURE),
    /duplicate JSON key "if_luxury" inside decision_rules/u,
  );
});
