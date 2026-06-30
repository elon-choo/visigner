// lib-banned-words.js — ONE canonical AI-slop / superlative banned-term list (en + ko), shared by
// copy-lint.js and email-lint.js so the two surfaces can't drift apart. Brings the linter floor to
// parity with the SKILL banned-defaults (references/aesthetics.md §17, SKILL.md "banned defaults").
//
// No deps. Two lists + one matcher:
//   EN_BANNED  — RegExp entries with word boundaries + inflection groups (-e/-es/-ing/-ed/-s/-ment/…)
//   KO_BANNED  — plain strings (Korean has no word boundaries) matched as case-insensitive substrings
//   findBanned(corpus, list) — returns the matched substrings; tolerant of RegExp AND string entries,
//                              and of a non-string corpus or a null/undefined list (defensive).
//
// A caller picks the list by locale (bannedFor) or passes its own resolved list (e.g. a --voice pack
// override) straight to findBanned. English entries each match ONCE per concept (one RegExp per family),
// so "transform / transforms / transforming / transformation" all report as a single slop family hit.

// ---- English AI-slop verbs / superlatives (auto-fail). Word-boundary anchored; inflection-tolerant. ----
// Each RegExp covers a whole inflection family so -ing/-ed/-s/-ment variants are caught without a stemmer.
// Hyphen-or-space variants ("game-changing" / "game changing") use a [- ] class. Longest groups first
// inside each alternation so the engine prefers the fuller match for the reported substring.
const EN_BANNED = [
  // superlatives / generic-marketing adjectives
  /\bseamless(ly)?\b/i,
  /\brevolutionar(?:y|ily)\b/i,
  /\brevolutioniz(?:es|ing|ed|e)\b/i,
  /\binnovat(?:ions|ion|ively|ive|ing|ed|es|e)\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bworld[- ]class\b/i,
  /\bgame[- ]chang(?:ers|er|ing)\b/i,
  /\bcutting[- ]edge\b/i,
  /\bnext[- ]gen(?:eration)?\b/i,
  /\bnext[- ]level\b/i,
  // slop verbs
  /\bsupercharg(?:es|ing|ed|e)\b/i,
  /\belevat(?:ions|ion|es|ing|ed|e)\b/i,
  /\bunlock(?:s|ing|ed)?\b/i,
  /\bempower(?:ment|ing|ed|s)?\b/i,
  /\btransform(?:ations|ation|ing|ed|s)?\b/i,
  /\bunleash(?:es|ing|ed)?\b/i,
  /\breimagin(?:es|ing|ed|e)\b/i,
  /\bdisrupt(?:ions|ion|ing|ed|s)?\b/i,
  // set phrases
  /\bbuild the future\b/i,
];

// ---- Korean AI-slop / superlatives. Plain substrings (no \b in Korean); matched case-insensitively. ----
// 혁신 is a prefix of 혁신적/혁신적인 so the bare stem already catches the inflected forms; 세계 최초 is
// the multi-word "world first" superlative. Kept additively alongside the originals both linters shipped.
const KO_BANNED = [
  '최고', '최상', '최강', '혁신', '혁신적', '완벽', '무조건', '궁극', '압도적', '차세대',
  '게임체인저', '단언컨대', '진정한', '신세계', '대박', '강력한', '획기적', '믿을 수 없는',
  '세계 최초', '세계최초',
];

// Return the matched substrings from `corpus` for every entry in `list`. Tolerant of:
//   - RegExp entries (English): the matched text (m[0]) is reported
//   - string entries (Korean / JSON-supplied): case-insensitive substring match, the entry is reported
//   - a non-string corpus, or a null/undefined/non-array list (returns [] / skips bad entries)
function findBanned(corpus, list) {
  const hits = [];
  const text = typeof corpus === 'string' ? corpus : String(corpus == null ? '' : corpus);
  const lc = text.toLowerCase();
  for (const entry of (Array.isArray(list) ? list : [])) {
    if (entry instanceof RegExp) {
      const m = text.match(entry);
      if (m) hits.push(m[0]);
    } else if (entry != null) {
      const s = String(entry).trim();
      if (s && lc.includes(s.toLowerCase())) hits.push(s);
    }
  }
  return hits;
}

// Pick the canonical list for a locale code ('ko' -> Korean, anything else -> English default).
function bannedFor(locale) {
  return String(locale || '').toLowerCase() === 'ko' ? KO_BANNED : EN_BANNED;
}

module.exports = { EN_BANNED, KO_BANNED, findBanned, bannedFor };
