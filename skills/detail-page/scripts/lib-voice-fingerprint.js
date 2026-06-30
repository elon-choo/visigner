// lib-voice-fingerprint.js — deterministic, zero-dep voice-fingerprint pass shared by copy-lint.js and
// email-lint.js. Given the text of several SURFACES (a campaign ladder / an email sequence) it computes,
// per surface, three register signals — owned-term coverage, sentence-length variance, and a
// Flesch–Kincaid reading grade — then FLAGS surfaces that are statistical outliers vs their peers.
// It NEVER fails a gate: outliers are advisory WARNs that give the LLM copy-critic a deterministic
// voice-drift signal ("this surface reads in a wildly different register than the rest").
//
// Pure functions, no fs/process. Needs >= 3 surfaces to call anything an outlier (it needs a baseline).

'use strict';

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - mu) * (x - mu), 0) / xs.length);
}

// approximate English syllable count (vowel-group heuristic) — deterministic.
function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Per-surface register metrics.
//   ownedCoverage  fraction (0..1) of owned brand terms that appear, or null if no owned list given
//   avgSentenceLen mean words per sentence
//   sentenceLenStdev  spread of sentence lengths (rhythm / burstiness)
//   readingGrade   Flesch–Kincaid grade level
function fingerprintText(text, owned) {
  const raw = String(text || '');
  const sentences = raw.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const words = raw.toLowerCase().match(/[a-z][a-z'’]*/g) || [];
  const wc = words.length;
  const sc = Math.max(1, sentences.length);
  const sentWordCounts = sentences
    .map((s) => (s.match(/[A-Za-z][A-Za-z'’]*/g) || []).length)
    .filter((n) => n > 0);
  const avgSentenceLen = sentWordCounts.length ? mean(sentWordCounts) : 0;
  const sentenceLenStdev = stdev(sentWordCounts);
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const readingGrade = wc ? 0.39 * (wc / sc) + 11.8 * (syl / wc) - 15.59 : 0;
  let ownedCoverage = null;
  if (Array.isArray(owned) && owned.length) {
    const lc = raw.toLowerCase();
    const hit = owned.filter((o) => o && lc.includes(String(o).toLowerCase())).length;
    ownedCoverage = hit / owned.length;
  }
  return {
    words: wc,
    sentences: sentences.length,
    avgSentenceLen: Number(avgSentenceLen.toFixed(2)),
    sentenceLenStdev: Number(sentenceLenStdev.toFixed(2)),
    readingGrade: Number(readingGrade.toFixed(2)),
    ownedCoverage: ownedCoverage == null ? null : Number(ownedCoverage.toFixed(3)),
  };
}

// robust z-score using median + MAD; falls back to stdev when MAD == 0.
function robustZ(vals) {
  const med = median(vals);
  const mad = median(vals.map((v) => Math.abs(v - med)));
  const sd = stdev(vals);
  return vals.map((v) => {
    let z = 0;
    if (mad > 0) z = (0.6745 * (v - med)) / mad;
    else if (sd > 0) z = (v - med) / sd;
    return z;
  });
}

// Flag outlier surfaces. records: [{ id, metrics }]. Advisory only. Returns the same records with
// { outlier, reasons } added. Combines a robust z-score (>3.5) with a generous absolute gap so a
// surface in a wildly different register is caught even when MAD collapses to 0.
function flagOutliers(records, opts = {}) {
  const out = records.map((r) => ({ ...r, outlier: false, reasons: [] }));
  if (out.length < 3) return out; // no baseline -> nothing is an "outlier"
  const zCut = opts.zCut == null ? 3.5 : opts.zCut;
  const gradeAbs = opts.gradeAbs == null ? 4 : opts.gradeAbs;     // grade levels
  const lenAbs = opts.lenAbs == null ? 8 : opts.lenAbs;          // words per sentence

  const grades = records.map((r) => r.metrics.readingGrade);
  const lens = records.map((r) => r.metrics.avgSentenceLen);
  const gZ = robustZ(grades);
  const lZ = robustZ(lens);
  const gMed = median(grades);
  const lMed = median(lens);
  const covs = records.map((r) => r.metrics.ownedCoverage).filter((c) => c != null);
  const covMed = covs.length ? median(covs) : null;

  out.forEach((r, i) => {
    if (Math.abs(gZ[i]) > zCut || Math.abs(grades[i] - gMed) > gradeAbs) {
      r.reasons.push(`reading-grade ${grades[i].toFixed(1)} is an outlier vs peer median ${gMed.toFixed(1)}`);
    }
    if (Math.abs(lZ[i]) > zCut || Math.abs(lens[i] - lMed) > lenAbs) {
      r.reasons.push(`avg sentence length ${lens[i].toFixed(1)} words is an outlier vs peer median ${lMed.toFixed(1)}`);
    }
    if (covMed != null && covMed > 0 && r.metrics.ownedCoverage === 0) {
      r.reasons.push(`0% owned-term coverage while peers average ${(covMed * 100).toFixed(0)}%`);
    }
    r.outlier = r.reasons.length > 0;
  });
  return out;
}

module.exports = { fingerprintText, flagOutliers, syllables, median, mean, stdev, robustZ };
