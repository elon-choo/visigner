'use strict';

const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { inject } = require(path.join(ROOT, 'scripts', 'librarian-inject.js'));

test('injector grounds a SaaS brief in Linear\'s real recipe and cites it in the plan preamble', () => {
  const result = inject({
    category: 'saas-marketing-site',
    awareness: 'solution-aware',
  });

  assert.strictEqual(result.retrieval.matches[0].id, 'linear');
  assert.match(result.groundingBlock, /imitate THIS exemplar's technique — `linear`/u);
  assert.match(result.groundingBlock, /references\/corpus\/recipes\/linear\.recipe\.md/u);
  assert.match(result.groundingBlock, /`#08090a`/u);
  assert.match(result.groundingBlock, /Product-UI hero render/u);
  assert.match(result.groundingBlock, /ANTI-SLOP GUARDRAILS/u);
  assert.match(result.planPreamble, /Retrieved exemplar cited: `linear`/u);
  assert.match(result.planPreamble, /Recipe cited: `references\/corpus\/recipes\/linear\.recipe\.md`/u);
});

test('injector refuses the kr-crowdfunding negative-only case', () => {
  const result = inject({ category: 'kr-crowdfunding' });

  assert.deepStrictEqual(result.retrieval.matches, []);
  assert.match(result.groundingBlock, /no on-brief exemplar to imitate — do NOT inject a negative exemplar\./u);
  assert.match(result.groundingBlock, /Only negative exemplars match this brief; nothing to imitate\./u);
  assert.doesNotMatch(result.groundingBlock, /`400620`/u);
  assert.doesNotMatch(result.groundingBlock, /recipe\.md/u);
  assert.doesNotMatch(result.planPreamble, /Retrieved exemplar cited:/u);
});
