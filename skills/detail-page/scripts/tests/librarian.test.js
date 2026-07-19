'use strict';

const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { retrieve } = require(path.join(ROOT, 'scripts', 'librarian.js'));

test('librarian returns only positive SaaS exemplars and exposes Linear\'s committed recipe', () => {
  const result = retrieve({
    category: 'saas-marketing-site',
    awareness: 'solution-aware',
  }, { k: 4 });

  assert.strictEqual(result.retrievalMode, 'imitate');
  assert.strictEqual(result.note, null);
  // The corpus is designed to grow; assert the KNOWN SaaS records are PRESENT and the shape holds,
  // rather than freezing an exact membership (a frozen set breaks the moment a real record is added,
  // which is the corpus working). linear is the reference record with a committed recipe.
  const ids = result.matches.map((match) => match.id);
  assert.ok(ids.includes('linear'), 'the reference SaaS record linear must be retrieved');
  assert.ok(result.matches.length >= 3, 'at least the core SaaS records are returned');
  assert.ok(result.matches.every((match) => match.exemplar_role === 'positive'));
  assert.ok(result.matches.every((match, index, all) => index === 0 || match.score <= all[index - 1].score));

  const linear = result.matches.find((match) => match.id === 'linear');
  assert.strictEqual(linear.recipePath, 'references/corpus/recipes/linear.recipe.md');
  assert.ok(linear.matchedTags.some((tag) => tag.field === 'category'));
});

test('librarian never serves the negative crowdfunding corpus as an imitation target', () => {
  const result = retrieve({ category: 'kr-crowdfunding' });

  assert.strictEqual(result.retrievalMode, 'imitate');
  assert.deepStrictEqual(result.matches, []);
  assert.match(result.note, /Only negative exemplars match this brief; nothing to imitate\./u);
  assert.ok(!result.matches.some((match) => match.id === '400620' && match.exemplar_role === 'positive'));
});

test('librarian returns an empty, explained response when no indexed exemplar matches', () => {
  // GB.4 grew the corpus: ecommerce-pdp now has an exemplar, so pin the
  // no-match path to a category that is still uncovered (see coverage-report).
  const result = retrieve({ category: 'motion-reel' });

  assert.deepStrictEqual(result.matches, []);
  assert.match(result.note, /No on-brief exemplar found; nothing to imitate\./u);
});
