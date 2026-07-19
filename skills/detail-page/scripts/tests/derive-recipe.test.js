'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { deriveRecipeFromCapture, VISION_SLOT } = require(path.join(ROOT, 'scripts', 'derive-recipe.js'));
const { validateRecipeText } = require(path.join(ROOT, 'scripts', 'recipe-validate.js'));

const LINEAR = path.join(ROOT, 'references', 'captures', 'app-ui', 'linear');
const REAL_KR_NO_STYLES = path.join(ROOT, 'references', 'captures', '400620');
const KR_CHROME_FIXTURE = path.join(__dirname, 'fixtures', 'kr-chrome-capture');

function validate(result, name) {
  const validation = validateRecipeText(result.markdown, name);
  assert.deepStrictEqual(validation.errors, [], validation.errors.map((item) => item.message).join('\n'));
}

function count(text, fragment) {
  return text.split(fragment).length - 1;
}

function tokenBlock(text) {
  return text.split('## 2 · LAYOUT CONCEPT + STRUCTURE')[0];
}

test('derive-recipe reproduces Linear mechanical tokens and keeps visual fields empty', () => {
  const linear = deriveRecipeFromCapture(LINEAR);

  validate(linear, 'linear.recipe.md');
  assert.strictEqual(linear.stats.layerB.filled, 9);
  assert.strictEqual(linear.stats.layerB.total, 9);
  assert.match(linear.markdown, /`#08090a`/u);
  assert.match(linear.markdown, /resolvedFamily `Inter Variable`; fontWeight `510`; fontSize `64px`; lineHeight `64px`; letterSpacing `-1\.408px`/u);
  assert.match(linear.markdown, /`4px`; count 61/u);
  assert.match(linear.markdown, /The product development\nsystem for teams and agents/u);
  assert.match(linear.markdown, /Purpose-built for planning and building products\. Designed for the AI era\./u);
  assert.match(linear.markdown, new RegExp(VISION_SLOT.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.strictEqual(count(linear.markdown, VISION_SLOT), 12, 'all 12 tile-dependent fields must remain explicit empty slots');
  assert.doesNotMatch(linear.markdown, /Product-UI hero render|isometric line-art|left-aligned and asymmetric/u);
});

test('derive-recipe rejects likely-platform-chrome values even when styles.json is present', () => {
  const chrome = deriveRecipeFromCapture(KR_CHROME_FIXTURE);

  validate(chrome, 'kr-chrome.recipe.md');
  assert.strictEqual(chrome.stats.layerB.filled, 0);
  assert.strictEqual(chrome.stats.tokenSource, 'likely-platform-chrome-or-unsafe');
  assert.match(chrome.markdown, /styles\.json is likely-platform-chrome; tokens must come from vision\./u);
  assert.doesNotMatch(chrome.markdown, /#f2f5f8/u);
  assert.strictEqual(count(tokenBlock(chrome.markdown), VISION_SLOT), 6, 'every token field must be a slot');
  assert.match(chrome.markdown, /### 1\.1 Color\n_EMPTY — \[tile — TODO vision \(G2\.4\)\]/u);
});

test('derive-recipe transcript fences outrun backtick runs in bodytext instead of terminating early', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-fence-'));
  const attack = [
    'Intro copy line.',
    '````',
    'fence-escape attempt: this line must stay inside the transcript fence',
    '````',
    'Outro copy line.',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'bodytext.txt'), `${attack}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ headings: [] }), 'utf8');

  const result = deriveRecipeFromCapture(dir);
  const transcript = result.markdown.split('**Verbatim bodytext.txt transcript (preserved without semantic rewording):**')[1];

  assert.match(transcript, /^`{5}text$/mu, 'the fence must be one backtick longer than the longest content run');
  assert.ok(transcript.includes(attack), 'the bodytext (including its 4-backtick runs) must survive verbatim');
  const closing = transcript.split(attack)[1];
  assert.match(closing, /^`{5}$/mu, 'the transcript must close with the same lengthened fence');
});

test('derive-recipe treats an absent styles.json as a first-class token gap', () => {
  const noStyles = deriveRecipeFromCapture(REAL_KR_NO_STYLES);

  validate(noStyles, '400620.recipe.md');
  assert.strictEqual(noStyles.stats.layerB.filled, 0);
  assert.strictEqual(noStyles.stats.tokenSource, 'no-styles-json');
  assert.strictEqual(noStyles.stats.captureJsonPresent, false);
  assert.match(noStyles.markdown, /no styles\.json collected for this capture; tokens must come from vision or a re-capture\./u);
  assert.doesNotMatch(noStyles.markdown, /#f2f5f8/u);
  assert.strictEqual(count(tokenBlock(noStyles.markdown), VISION_SLOT), 6, 'every token field must be a slot');
});
