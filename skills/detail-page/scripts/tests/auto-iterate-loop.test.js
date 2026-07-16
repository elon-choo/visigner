'use strict';

const assert = require('assert');
const test = require('node:test');
const path = require('path');
const {
  HARD_ROUND_CAP,
  boundedCap,
  gatePassed,
  runAutoIterate,
} = require(path.resolve(__dirname, '..', '..', '..', '..', 'hooks', 'auto-iterate-loop.js'));

test('pathological improver stops on no progress before the hard cap', async () => {
  let improveCalls = 0;
  const result = await runAutoIterate({
    initialArtifact: 'stuck.html',
    maxRounds: HARD_ROUND_CAP,
    grade: () => ({ score: 46, verdict: 'ai-likely', s2Pass: false }),
    improve: ({ artifact }) => {
      improveCalls += 1;
      return artifact;
    },
  });

  assert.strictEqual(result.terminationReason, 'no-progress');
  assert.strictEqual(result.gatePassed, false);
  assert.strictEqual(result.rounds.length, 2);
  assert.ok(result.rounds.length <= HARD_ROUND_CAP);
  assert.strictEqual(improveCalls, 1);
});

test('monotonic improver exits immediately at the static gate', async () => {
  const scores = [46, 63, 85];
  const result = await runAutoIterate({
    initialArtifact: 0,
    maxRounds: HARD_ROUND_CAP,
    grade: ({ artifact }) => ({
      score: scores[artifact],
      verdict: artifact < 2 ? 'suspect' : 'clean',
      s2Pass: artifact === 2,
    }),
    improve: ({ artifact }) => artifact + 1,
  });

  assert.strictEqual(result.terminationReason, 'gate-passed');
  assert.strictEqual(result.gatePassed, true);
  assert.deepStrictEqual(result.rounds.map((round) => round.score), scores);
  assert.strictEqual(result.rounds.length, 3);
});

test('caller cannot raise the cap above four rounds', async () => {
  let gradeCalls = 0;
  let improveCalls = 0;
  const result = await runAutoIterate({
    initialArtifact: 0,
    maxRounds: 999,
    grade: ({ artifact }) => {
      gradeCalls += 1;
      return { score: artifact + 1, verdict: 'suspect', s2Pass: false };
    },
    improve: ({ artifact }) => {
      improveCalls += 1;
      return artifact + 1;
    },
  });

  assert.strictEqual(boundedCap(999), HARD_ROUND_CAP);
  assert.strictEqual(result.cap, HARD_ROUND_CAP);
  assert.strictEqual(result.terminationReason, 'cap-reached');
  assert.strictEqual(result.rounds.length, HARD_ROUND_CAP);
  assert.strictEqual(gradeCalls, HARD_ROUND_CAP);
  assert.strictEqual(improveCalls, HARD_ROUND_CAP - 1);
});

test('visual gate requires s2Pass, critic overall 8, and every dimension 7', () => {
  const passing = {
    s2Pass: true,
    critic: { overall: 8, dimensions: { craft: 7, conversion: 8.4, distinctiveness: 9 } },
  };
  assert.strictEqual(gatePassed(passing, true), true);
  assert.strictEqual(gatePassed({ ...passing, critic: { overall: 8, dimensions: { craft: 6.9, conversion: 9 } } }, true), false);
  assert.strictEqual(gatePassed({ ...passing, critic: { overall: 7.9, dimensions: { craft: 9 } } }, true), false);
  assert.strictEqual(gatePassed({ ...passing, critic: { overall: 8, dimensions: { craft: 7, broken: 'NaN' } } }, true), false);
  assert.strictEqual(gatePassed({ ...passing, critic: { overall: 8, minDimension: 7, dimensions: { craft: 6 } } }, true), false);
  assert.strictEqual(gatePassed({ ...passing, critic: { overall: 8, dimensions: {} } }, true), false);
  assert.strictEqual(gatePassed({ s2Pass: true }, true), false);
  assert.strictEqual(gatePassed({ s2Pass: false, critic: passing.critic }, true), false);
  assert.strictEqual(gatePassed({ s2Pass: true }, false), true);
});

test('gate success wins over no-progress on an equal-score round', async () => {
  let grades = 0;
  const result = await runAutoIterate({
    initialArtifact: 'same-score.html',
    grade: () => {
      grades += 1;
      return { score: 46, verdict: 'suspect', s2Pass: grades === 2 };
    },
    improve: ({ artifact }) => artifact,
  });

  assert.strictEqual(result.terminationReason, 'gate-passed');
  assert.strictEqual(result.rounds.length, 2);
  assert.strictEqual(result.rounds[1].gatePassed, true);
});
