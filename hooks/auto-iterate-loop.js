'use strict';

const HARD_ROUND_CAP = 4;

function boundedCap(requested) {
  const numeric = Number.isFinite(Number(requested)) ? Math.floor(Number(requested)) : HARD_ROUND_CAP;
  return Math.max(1, Math.min(HARD_ROUND_CAP, numeric));
}

function numericScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new TypeError('grade.score must be a finite number');
  return score;
}

function criticSummary(critic) {
  if (!critic || typeof critic !== 'object') return { available: false, overall: null, minDimension: null };
  const overall = Number(critic.overall);
  const values = [];
  let dimensionsValid = true;

  if (Array.isArray(critic.dimensions)) {
    for (const item of critic.dimensions) {
      const value = Number(item && typeof item === 'object' ? item.score : item);
      if (Number.isFinite(value)) values.push(value);
      else dimensionsValid = false;
    }
  } else if (critic.dimensions && typeof critic.dimensions === 'object') {
    for (const item of Object.values(critic.dimensions)) {
      const value = Number(item && typeof item === 'object' ? item.score : item);
      if (Number.isFinite(value)) values.push(value);
      else dimensionsValid = false;
    }
  } else {
    dimensionsValid = false;
  }

  const minDimension = dimensionsValid && values.length ? Math.min(...values) : null;
  return {
    available: Number.isFinite(overall) && minDimension != null,
    overall: Number.isFinite(overall) ? overall : null,
    minDimension,
  };
}

function gatePassed(grade, visualCriticAvailable) {
  if (!grade || grade.s2Pass !== true) return false;
  if (!visualCriticAvailable) return true;
  const critic = criticSummary(grade.critic);
  return critic.available && critic.overall >= 8 && critic.minDimension >= 7;
}

function roundRecord(round, artifact, grade, visualCriticAvailable) {
  const critic = criticSummary(grade.critic);
  return {
    round,
    artifact: typeof artifact === 'string' ? artifact : null,
    score: numericScore(grade.score),
    letter: grade.letter || null,
    verdict: grade.verdict || null,
    s2Pass: grade.s2Pass === true,
    tellsDetected: Array.isArray(grade.tellsDetected) ? grade.tellsDetected : [],
    criticAvailable: Boolean(visualCriticAvailable && critic.available),
    criticOverall: critic.overall,
    criticMinDimension: critic.minDimension,
    gatePassed: gatePassed(grade, visualCriticAvailable),
  };
}

async function runAutoIterate(options) {
  if (!options || typeof options.grade !== 'function') throw new TypeError('grade function is required');
  if (typeof options.improve !== 'function') throw new TypeError('improve function is required');

  const cap = boundedCap(options.maxRounds);
  const visualCriticAvailable = options.visualCriticAvailable === true;
  const rounds = [];
  let artifact = options.initialArtifact;
  let previousScore = null;

  for (let round = 1; round <= cap; round += 1) {
    const grade = await options.grade({ artifact, round, rounds: rounds.slice() });
    const record = roundRecord(round, artifact, grade, visualCriticAvailable);
    rounds.push(record);

    if (record.gatePassed) {
      record.terminationReason = 'gate-passed';
      return { cap, terminationReason: 'gate-passed', gatePassed: true, rounds, finalArtifact: artifact };
    }

    if (previousScore != null && record.score <= previousScore) {
      record.terminationReason = 'no-progress';
      return { cap, terminationReason: 'no-progress', gatePassed: false, rounds, finalArtifact: artifact };
    }

    if (round === cap) {
      record.terminationReason = 'cap-reached';
      return { cap, terminationReason: 'cap-reached', gatePassed: false, rounds, finalArtifact: artifact };
    }

    previousScore = record.score;
    artifact = await options.improve({ artifact, grade, round, rounds: rounds.slice() });
  }

  throw new Error('unreachable: bounded loop exhausted without termination');
}

module.exports = {
  HARD_ROUND_CAP,
  boundedCap,
  criticSummary,
  gatePassed,
  runAutoIterate,
};
