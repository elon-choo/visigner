'use strict';

const assert = require('assert');
const test = require('node:test');

const {
  VISION_UNAVAILABLE_MESSAGE,
  aggregateRuns,
  scoreRepeated,
} = require('../reproduce-and-score.js');

test('reproduction oracle aggregates repeat fidelity scores and reports population standard deviation', () => {
  const report = aggregateRuns([
    {
      overallFidelity: 80,
      dimensions: { token: 70, structural: 80, signature: 90, craft: 80 },
      upgradeList: ['Match the heading scale', 'Restore the distinctive hero crop'],
    },
    {
      overallFidelity: 84,
      dimensions: { token: 74, structural: 84, signature: 88, craft: 82 },
      upgradeList: ['Match the heading scale'],
    },
    {
      overallFidelity: 88,
      dimensions: { token: 76, structural: 86, signature: 86, craft: 84 },
      upgradeList: ['Tighten card alignment'],
    },
  ]);

  assert.strictEqual(report.meanFidelity, 84);
  assert.strictEqual(report.sd, 3.27);
  assert.deepStrictEqual(report.dimensions, { token: 73.33, structural: 83.33, signature: 88, craft: 82 });
  assert.deepStrictEqual(report.upgradeList.slice(0, 2), ['Match the heading scale', 'Restore the distinctive hero crop']);
  assert.strictEqual(report.runs.length, 3);
});

test('reproduction oracle fails loud without auth and never calls the scorer', async () => {
  let scorerCalled = false;
  await assert.rejects(
    () => scoreRepeated({
      referenceTiles: ['reference.png'],
      reproductionTiles: ['reproduction.png'],
      runs: 3,
      authAvailable: () => false,
      apiKeyAvailable: () => false,
      scoreFn: async () => {
        scorerCalled = true;
        return { overallFidelity: 100, dimensions: { token: 100, structural: 100, signature: 100, craft: 100 }, upgradeList: [] };
      },
    }),
    (error) => error && error.code === 'VISION_SCORING_UNAVAILABLE' && error.message.startsWith(VISION_UNAVAILABLE_MESSAGE),
  );
  assert.strictEqual(scorerCalled, false);
});
