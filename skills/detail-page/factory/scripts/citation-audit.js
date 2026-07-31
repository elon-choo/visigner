#!/usr/bin/env node
'use strict';

/*
 * citation audit — a machine gate for the page's own headline promise.
 *
 * The landing page promises that every figure it took from the repository is re-derivable from
 * the footnote command attached to the same item. Earlier rounds checked that by hand and every
 * time the fixer's hand-written assertion list quietly omitted the cases that failed. This script
 * removes the hand from the loop. It renders the page, forces every <details> open, takes every
 * visible reading unit, extracts figures by rule, executes every cited command verbatim from the
 * repository root, and compares. There is no allowlist and no list of expected values anywhere in
 * this file.
 *
 * ---------------------------------------------------------------------------
 * G5.4h HARDENING — the nine ways the fourth independent audit walked through this gate
 * ---------------------------------------------------------------------------
 *
 * Each of the nine is answered by a rule, not by an exception list. Where a rule leaves a residue
 * the residue is named in a comment rather than papered over.
 *
 *  C1  line-pin minting.  The old gate granted a figure when the note's path said "L<n>" and the
 *      command text contained "<n>p" — it never checked that line <n> exists or that anything was
 *      printed, so `sed -n 4096p` on a 720-line file minted the integer 4096. The channel is
 *      DELETED. It was worth 0 of 138 external figures on the page under audit, so nothing legal
 *      depended on it. An address now backs nothing at all; only output does.
 *
 *  D1  single-chip exemption.  The old gate skipped sentence attribution entirely when an item
 *      carried one chip, so an item was made LOOSER by citing less. Attribution is now uniform:
 *      the sentence must name the source, and item-level attribution is available only when there
 *      is nothing to confuse — one shape-capable chip AND one sentence in the item that makes a
 *      cardinal claim. Adding a second cardinal sentence to a one-chip item no longer buys a free
 *      figure. RESIDUE: an item with one chip and one cardinal sentence is still attributed at
 *      item level; see the report's tokensViaOutputShapeByItem counter, which names every one.
 *
 *  D3  sentence merge.  Sentence boundaries were the page's own full stops, so deleting one full
 *      stop merged a chipless claim into a cited sentence. Segmentation no longer trusts
 *      punctuation alone: a Korean declarative ending (다/요/까/죠) followed by whitespace also
 *      ends a sentence, unless what follows is the footnote marker itself. RESIDUE: a merge whose
 *      first half ends in something other than a declarative ending (a bare nominal) is not split.
 *
 *  F1-F4  Korean numerals.  A closed 14-key map could not see "스물세 곳", "사십 퍼센트", "세줄을"
 *      or "여섯,". Those were not unsupported, they were invisible. The map is replaced by a
 *      generative grammar: native cardinals composed from tens x units, Sino-Korean cardinals
 *      composed from digits x places, and four context channels (space, nominal particle,
 *      clause-final punctuation, counter welded on with the space removed). The counter nouns of
 *      the welded channel are not a list in this file — they are harvested from the page's own
 *      spaced usage at run time, so removing a space cannot hide a claim whose counter the page
 *      uses anywhere else.
 *
 *  B1  name laundering.  isAddressOccurrence refused digits welded to a name only when the token
 *      was a whole integer, so a claim of "4.6" was satisfied by the "G4.6" in a command's output.
 *      The weld test now applies to dotted runs too, and the page side and the output side agree.
 *      Quoting the whole name in the sentence still works, because then the comparison is real.
 *
 *  H1  document scope.  A figure outside every item fell back to document.body and inherited
 *      EVERY chip on the page, so the union of 33 command outputs backed it. Document scope now
 *      inherits NO chips: a figure that belongs to no item is unattached, which is what the page
 *      promises ("the footnote of the same item").
 *
 *  E1  aria-hidden.  Content hidden from assistive technology is still on the screen. The
 *      decoration exclusion is deleted; only genuinely unrendered content (display:none,
 *      visibility:hidden) is out of scope.
 *
 *  E3  inline splitting.  <span>2</span><span>1</span> reads as 21 and was audited as 2 and 1.
 *      A reading unit is no longer a tag from a list; it is the nearest ancestor that is not an
 *      inline-level box, so an inline run is read the way it renders.
 *
 *  G1  footnote spans.  Anything inside .ledger-notes__path or .ledger-notes__cmd was exempt by
 *      class name, so prose smuggled into a path span was invisible while the reader could see
 *      it. The exemption is now earned by content: a path span is exempt only while every digit
 *      run in it is inside a path literal or an L<n> pin, and a command span only while it
 *      carries no Korean prose. A span that stops looking like an address is audited like any
 *      other sentence.
 *
 * ---------------------------------------------------------------------------
 * G5.4j HARDENING — the seven surfaces the sixth independent audit walked through
 * ---------------------------------------------------------------------------
 *
 * One principle, applied seven times: a figure the reader reads is audited whatever code point it
 * is written in, whatever node carries it, and whenever it arrives. Where the gate cannot read it,
 * the answer is a failure, not a pass — the UNREADABLE verdict G5.4i introduced for unfoldable
 * digits is the precedent, and J1 and J3 extend it.
 *
 *  J1  numerals outside \p{Nd}.  The tokeniser folded decimal digits only, so a superscript "0.⁹¹"
 *      or a circled "①" put a figure on the screen that the audit never saw. The class is now
 *      \p{Nd} + \p{No} + \p{Nl}; a numeral that NFKC-folds to one ASCII digit is read as that
 *      digit, and one that does not (Arabic-Indic ٤, Roman Ⅻ, the fraction ½) fails closed.
 *
 *  J2  copy in an attribute.  alt, aria-label, title and the rest are sentences the reader
 *      receives and no text-node walk visits them. G5.4i shipped four alt strings, two copy-button
 *      labels and a language-toggle label outside the audit. Every reader-visible attribute is now
 *      its own reading unit in the scope of the item it sits in.
 *
 *  J3  copy in CSS.  ::before/::after content is painted onto the page and lives in no text node.
 *      Quoted strings are read and attr() is resolved from the element. counter() is refused
 *      rather than guessed: no DOM API returns a rendered counter, so a figure written that way is
 *      unauditable and fails.
 *
 *  J4  arrival after the read.  The DOM was read 200ms after load, so anything inserted at 201ms
 *      was never audited. The read now happens after 2000ms, and a MutationObserver armed before
 *      the page's first script reports any numeral-bearing insertion that lands AFTER the read.
 *      RESIDUE: an insertion after the whole observation window is outside what is observed; the
 *      window length is reported as a counter rather than claimed as a proof.
 *
 *  J5  section scope.  H1 stopped document scope inheriting every chip on the page, but section
 *      scope still inherited the union of every chip in the section, so a figure loose in a
 *      section was "reproduced" by whichever of that section's sources happened to print it.
 *      Section scope now reads the markers written in the UNIT's own text and nothing else. A
 *      loose figure that names no source is unattached, the same answer document scope gives.
 *
 *  J6  the unread language.  The page ships KO and EN in one DOM and hides one with CSS, so a
 *      figure in an EN-only span was never audited from page.html at all. Both states of the
 *      page's own switch are harvested from the SAME file and the units are unioned.
 *
 *  J7  the language seam.  Alternating KO/EN spans mean the inline run a reader sees differs by
 *      state: "검사 4" + "건" reads 4 in KO while "checks 4" + "7 found" reads 47 in EN, and the
 *      string 47 exists in no span and in no source line. Auditing both states with the E3
 *      inline-run rule is what reads it.
 *
 * ---------------------------------------------------------------------------
 * WHAT COUNTS AS A CLAIM — classification by where the value came from
 * ---------------------------------------------------------------------------
 *
 * EXTERNAL_MEASUREMENT  The value can only be known by reading the repository or an artifact:
 *                       a module count, a span total, a hash, a monotony score, an exit code,
 *                       a timestamp. A reader looking at the page cannot tell whether it is
 *                       true. These REQUIRE a chip in the same item and a command that prints
 *                       the value. Any miss is a failure and exits 1.
 *
 * ON_PAGE_SELF_REFERENCE  A Korean cardinal that counts something rendered in the same section
 *                       — "여섯 단계" beside six rendered steps. The reader verifies it by
 *                       looking. No chip is required, but the claim is NOT taken on trust: the
 *                       number must equal a peer group of catalog collection members actually
 *                       counted in that section's DOM. If it does not match a rendered group it
 *                       falls through to EXTERNAL_MEASUREMENT and must be cited like any other
 *                       figure. Two limits keep this class from becoming a rescue lane. An item
 *                       that cites sources is held to its citations and may not fall back on a
 *                       coincidental group. And the footnote band cannot use it at all: a note is
 *                       apparatus about content elsewhere, so nothing the reader sees "beside" it
 *                       licenses its numbers.
 *
 * PATH_ONLY             A digit inside a slash-bearing path literal (v3/scripts/...,
 *                       page-attempt-0/1/2.html). An address, not a measurement.
 *
 * IDENTIFIER            A pure-digit run welded to a preceding letter with no separator —
 *                       sha256, v2, v3. Part of a name, not a measurement. A dotted run such
 *                       as v2.1.100 is NOT covered on the page side: a version number is a
 *                       measurement and must be cited.
 *
 * The last three classes are rules, not exceptions: every member of every class is listed
 * individually in the report with the DOM or textual evidence that put it there, so a reviewer
 * can check the classification itself rather than trust it.
 *
 * ---------------------------------------------------------------------------
 * HOW AN EXTERNAL_MEASUREMENT IS SATISFIED — two channels, and only two
 * ---------------------------------------------------------------------------
 *
 * output        the cited command prints the value AS A VALUE. Matching uses a digit boundary,
 *               so a printed 84 is not satisfied by the 84 inside 384, and the occurrence must
 *               survive the same address/name tests the page side applies to itself: a digit
 *               inside a path segment, an array index (`sections[8]`), a grep -n line prefix
 *               (`36:`) or digits welded to an identifier (`v3`, `G4.6`, `gate-attempt-2`) is an
 *               address, not a measurement, and cannot back a sentence.
 * output-shape  Korean cardinals only: the value equals the number of lines the cited command
 *               actually emitted, measured from the real run. This is the "명령이 두 줄을 찍는다"
 *               case. Arabic figures may never use this channel. The line count is taken from the
 *               command THAT SENTENCE cites; item-level attribution is a fallback available only
 *               where nothing can be confused with anything else (see D1 above).
 *
 * The check is presence, not semantics: a command that prints the value somewhere passes. That
 * is a floor under the page, not a proof that the sentence around it is true.
 *
 * usage: node v3/scripts/citation-audit.js <page.html> [--out <report.json>] [--md <report.md>]
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function resolvePlaywright() {
  try {
    return require('playwright');
  } catch (error) {
    // This repository ships no node_modules; playwright is a global install on the build host.
    const globalRoot = path.join(path.dirname(path.dirname(process.execPath)), 'lib', 'node_modules');
    Module.globalPaths.push(globalRoot);
    module.paths.push(globalRoot);
    return require(path.join(globalRoot, 'playwright'));
  }
}

// ---------------------------------------------------------------------------
// Extraction rules (no page-specific value appears anywhere below)
// ---------------------------------------------------------------------------

// An item is the scope the page's headline names: the footnote command of the same item.
const ITEM_SELECTORS = [
  'li', 'details', 'figure', 'tr', 'dd', 'dt',
  '[class*="__item"]', '[class*="__card"]', '[class*="__step"]', '[class*="__row"]',
  '[class*="__plan"]', '[class*="__copy"]', '[class*="__header"]', '[class*="__footer"]',
  '[class*="__utility"]', '[class*="__legal"]', '[class*="__nav"]', '[class*="__media"]'
];

const CHIP_PATTERN = /\[E-\d+\]/g;

// ---------------------------------------------------------------------------
// Korean cardinals — a generative grammar, not a table of allowed words
// ---------------------------------------------------------------------------
//
// A cardinal is a figure. The previous version of this file recognised fourteen spellings from a
// hand-written map, which meant "스물세 곳이다", "사십 퍼센트다", "세줄을" and "여섯," produced no
// unit at all: not refused, not reported, simply invisible. A map of allowed spellings is the same
// object as a hand-kept allowlist, and the numerals of Korean are productive.
//
// So spelling is derived. Native Korean cardinals compose as tens x units (열둘, 스물세, 마흔아홉);
// Sino-Korean cardinals compose as digits x places (사십, 이십삼, 삼백). A Sino form is recognised
// only when it carries a place marker and is at least two syllables, because the bare Sino digits
// 일/이/삼/사 are homographs of very common Korean words ("일" work, "이" this, "사" buy) and the
// page writes small numbers with Arabic digits anyway. 만 is excluded for the same reason.
const NATIVE_UNITS = {
  '하나': 1, '한': 1, '둘': 2, '두': 2, '셋': 3, '세': 3, '넷': 4, '네': 4,
  '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9
};
const NATIVE_TENS = {
  '열': 10, '스물': 20, '스무': 20, '서른': 30, '마흔': 40, '쉰': 50,
  '예순': 60, '일흔': 70, '여든': 80, '아흔': 90
};
const SINO_DIGITS = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '륙': 6, '칠': 7, '팔': 8, '구': 9 };
const SINO_PLACES = { '십': 10, '백': 100, '천': 1000 };

const NATIVE_FORMS = new Map();
for (const [word, value] of Object.entries(NATIVE_UNITS)) NATIVE_FORMS.set(word, value);
for (const [word, value] of Object.entries(NATIVE_TENS)) NATIVE_FORMS.set(word, value);
for (const [tens, tensValue] of Object.entries(NATIVE_TENS)) {
  // 스무 is the adnominal of 스물 and does not take a unit ("스무 개", never "스무세").
  if (tens === '스무') continue;
  for (const [unit, unitValue] of Object.entries(NATIVE_UNITS)) {
    NATIVE_FORMS.set(tens + unit, tensValue + unitValue);
  }
}
const NATIVE_ALTERNATION = [...NATIVE_FORMS.keys()].sort((a, b) => b.length - a.length).join('|');
const SINO_DIGIT_CLASS = `[${Object.keys(SINO_DIGITS).join('')}]`;
const SINO_ALTERNATION = `(?:${SINO_DIGIT_CLASS}?천)?(?:${SINO_DIGIT_CLASS}?백)?(?:${SINO_DIGIT_CLASS}?십)?${SINO_DIGIT_CLASS}?`;
const CARDINAL_PATTERN_SOURCE = `(?<![가-힣0-9])(?:${NATIVE_ALTERNATION}|${SINO_ALTERNATION})`;

// Adnominal forms modify a following noun and never stand at the end of a clause, so they are not
// offered the clause-final channel. 하나 is excluded from it too: "어떻게 하나" is an interrogative
// ending, not the number one. Both exclusions are grammatical, not topical.
const ADNOMINAL_TAILS = ['한', '두', '세', '네'];
const isAdnominal = (form) => form === '스무' || ADNOMINAL_TAILS.some((tail) => form.endsWith(tail));

// The particle set is a grammatical class. It deliberately excludes the endings that double as
// verb morphology (은/는/이/가/을/를/로) so that ordinary prose is not read as a count.
const KOREAN_NOMINAL_SUFFIXES = '이다|이며|이고|이라|이었|였|뿐|만|씩|째|밖에';
const CLAUSE_FINAL_PATTERN = /^([,.;:!?)\]}\u2026"'\u201c\u201d\u2018\u2019]|$)/;

// Particles stripped when harvesting a counter noun from the page's own spaced usage.
const HARVEST_PARTICLES = '이며|이고|이다|에서|으로|까지|부터|보다|이|가|은|는|을|를|의|에|로|와|과|도|만|뿐|씩|째|라|랑';

function cardinalValue(form) {
  if (NATIVE_FORMS.has(form)) return NATIVE_FORMS.get(form);
  if (form.length < 2) return null;
  let total = 0;
  let current = 0;
  let hasPlace = false;
  for (const char of form) {
    if (SINO_DIGITS[char] !== undefined) { current = SINO_DIGITS[char]; continue; }
    if (SINO_PLACES[char] !== undefined) { hasPlace = true; total += (current || 1) * SINO_PLACES[char]; current = 0; continue; }
    return null;
  }
  if (!hasPlace) return null;
  return total + current;
}

// The counter nouns of Korean are an open class, so the welded-counter channel does not carry a
// list. It reads the page: every noun the page itself writes after a spaced cardinal becomes a
// counter for that page. Removing the space then cannot hide the claim. What this does NOT catch
// is a counter the page never once spells with a space; that residue is reported, not hidden.
function harvestCounterNouns(corpus) {
  const attested = new Set();
  // The Sino alternation is all-optional and therefore matches the empty string; the cardinal is
  // captured separately so that an empty cardinal cannot harvest every noun on the page.
  const scanner = new RegExp(`(${CARDINAL_PATTERN_SOURCE})\\s+([가-힣]+)`, 'g');
  const particle = new RegExp(`(?:${HARVEST_PARTICLES})$`);
  let match;
  while ((match = scanner.exec(corpus)) !== null) {
    if (!match[1] || cardinalValue(match[1]) === null) {
      scanner.lastIndex = match.index + 1;
      continue;
    }
    let word = match[2];
    let previous = null;
    while (word.length > 1 && particle.test(word) && word !== previous) {
      previous = word;
      word = word.replace(particle, '');
    }
    if (word) attested.add(word);
  }
  return attested;
}

function buildKoreanScanner(corpus) {
  const attested = harvestCounterNouns(corpus);
  const attachedAlternation = [...attested]
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const attachedPattern = attachedAlternation ? new RegExp(`^(?:${attachedAlternation})`) : null;
  const nominalPattern = new RegExp(`^(?:${KOREAN_NOMINAL_SUFFIXES})`);

  const channelFor = (form, rest) => {
    if (/^\s+\S/.test(rest)) return 'space';
    if (nominalPattern.test(rest)) return 'particle';
    if (!isAdnominal(form) && form !== '하나' && CLAUSE_FINAL_PATTERN.test(rest)) return 'clause-final';
    if (attachedPattern && attachedPattern.test(rest)) return 'welded-counter';
    return null;
  };

  const matchesIn = (text) => {
    const out = [];
    const seenPerCardinal = new Map();
    const scanner = new RegExp(CARDINAL_PATTERN_SOURCE, 'g');
    let match;
    while ((match = scanner.exec(text)) !== null) {
      const form = match[0];
      if (!form) { scanner.lastIndex += 1; continue; }
      const advance = match.index + form.length;
      const value = cardinalValue(form);
      if (value === null) { scanner.lastIndex = Math.max(advance, match.index + 1); continue; }
      const rest = text.slice(advance);
      const channel = channelFor(form, rest);
      if (!channel) { scanner.lastIndex = Math.max(advance, match.index + 1); continue; }
      const ordinal = seenPerCardinal.get(form) || 0;
      seenPerCardinal.set(form, ordinal + 1);
      out.push({
        raw: form,
        phrase: text.slice(match.index, advance + 4).trim(),
        ordinal,
        index: match.index,
        value: String(value),
        readChannel: channel
      });
      scanner.lastIndex = Math.max(advance, match.index + 1);
    }
    return out;
  };

  return { matchesIn, attested: [...attested].sort() };
}

// A figure is any maximal run that starts and ends with a digit, plus bare digits. That covers
// integers, decimals, ratios, semver, ISO timestamps, exit codes and hashes without naming one.
const TOKEN_PATTERN = /\d[\w.:+-]*\d|\d/g;

// PATH_ONLY: a slash-bearing literal made of path characters and containing at least one
// letter. "0/1" is not a path (no letter); "page-attempt-0/1/2.html" is.
const PATH_LITERAL_PATTERN = /[A-Za-z0-9_.@~-]*\/[A-Za-z0-9_.@~/#-]*/g;

// The spans those literals occupy, so that PATH_ONLY can be decided per occurrence. Deciding it
// per unit — "some path in this sentence contains these digits" — would exempt a bare 3 from any
// sentence that also happens to mention a v3/ path.
function pathLiteralSpans(text) {
  const spans = [];
  let match;
  PATH_LITERAL_PATTERN.lastIndex = 0;
  while ((match = PATH_LITERAL_PATTERN.exec(text)) !== null) {
    if (match[0] === '') { PATH_LITERAL_PATTERN.lastIndex += 1; continue; }
    if (!/[A-Za-z]/.test(match[0])) continue;
    spans.push({ literal: match[0], start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

// PATH_ONLY: every occurrence of the token lies inside a path literal.
function pathCarrier(text, token, spans) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scanner = new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`, 'g');
  let match;
  let occurrences = 0;
  let carrier = null;
  while ((match = scanner.exec(text)) !== null) {
    occurrences += 1;
    const span = spans.find((candidate) => match.index >= candidate.start
      && match.index + token.length <= candidate.end);
    if (!span) return null;
    carrier = carrier || span.literal;
  }
  return occurrences > 0 ? carrier : null;
}

// IDENTIFIER: every occurrence of a pure-digit token is glued to a preceding ASCII letter.
function isIdentifierDigits(text, token) {
  if (!/^\d+$/.test(token)) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scanner = new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`, 'g');
  let match;
  let occurrences = 0;
  while ((match = scanner.exec(text)) !== null) {
    occurrences += 1;
    if (!/[A-Za-z]/.test(text[match.index - 1] || '')) return false;
  }
  return occurrences > 0;
}

// Literal presence with a digit boundary: "84" is not satisfied by the 84 inside "384", while
// "2.0.0" is still found inside "v2.0.0". Only digits and dots block a match.
function containsToken(haystack, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`).test(haystack);
}

// ---------------------------------------------------------------------------
// Value occurrence: the output side of the comparison, held to the page's own standard
// ---------------------------------------------------------------------------
//
// Presence in the output is not yet support. Machine output is full of digits that are
// addresses and names rather than measurements, and an audit that accepts any of them lets a
// sentence be "reproduced" by a coincidence: the claim "each card carries eight lines" was
// found backed because a validator error message elsewhere in the same output said
// `sections[8]`, and a claim of "4.6 retries" was found backed by the "G4.6" in a directory
// listing. So the same classes the page side refuses to count as claims — PATH_ONLY, an index,
// IDENTIFIER — are refused here too. What is left is the value printed as a value.
const LEXEME_CHARS = /[A-Za-z0-9_./@~+-]/;

function lexemeBounds(haystack, index, length) {
  let start = index;
  let end = index + length;
  while (start > 0 && LEXEME_CHARS.test(haystack[start - 1])) start -= 1;
  while (end < haystack.length && LEXEME_CHARS.test(haystack[end])) end += 1;
  return { start, end, lexeme: haystack.slice(start, end) };
}

function lexemeAround(haystack, index, length) {
  return lexemeBounds(haystack, index, length).lexeme;
}

function isAddressOccurrence(haystack, index, token) {
  const before = haystack[index - 1] || '';
  const after = haystack[index + token.length] || '';
  // 1. a path segment: the digits sit inside a slash-bearing literal that also carries a letter.
  const lexeme = lexemeAround(haystack, index, token.length);
  if (lexeme.includes('/') && /[A-Za-z]/.test(lexeme)) return 'path segment';
  // 2. an index: name[8].
  if (before === '[' && after === ']' && /[\w\])]/.test(haystack[index - 2] || '')) return 'index';
  // 3. a line-number prefix, as grep -n and sed = print them: digits alone on the front of a
  //    line, immediately followed by a colon.
  if (after === ':' && /(^|\n)[ \t]*$/.test(haystack.slice(0, index))) return 'line-number prefix';
  // 4. digits welded to a name. G5.4h: this test used to fire only for whole integers, which is
  //    why "G4.6" in an output could back a bare claim of 4.6 while the same string on the page
  //    side was read as an address. A dotted run welded to a letter is part of a name here just as
  //    a whole integer is; the sentence can still reach it by quoting the whole name (below).
  if (/[A-Za-z_]/.test(before)) return 'identifier';
  if (before === '-' && /[A-Za-z0-9]/.test(haystack[index - 2] || '')) return 'identifier';
  return null;
}

// True when the haystack prints the token at least once as a value rather than as an address.
//
// One exception, and it is not a loophole: when the page quotes the NAME verbatim — the sentence
// itself says "GAP-06", "v2.1.100" or "g4.4-fail-closed" — then the digits inside that name in the
// output are the very thing the sentence is pointing at, and the comparison is still a real one,
// because the whole name has to match. What stays refused is the free digit: a bare 3 backed by
// "v3/" is refused unless the sentence actually said "v3".
//
// The name the sentence has to quote runs from the start of the printed lexeme through the end of
// the value inside it, so a README that prints "v2.1.100+" is still reachable by a page that
// writes "v2.1.100" — the qualifier after the version is not part of the name. Everything before
// the value must still match exactly, which is what keeps "G4.6" from backing a bare 4.6.
function printsValue(haystack, token, claimText = '') {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scanner = new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`, 'g');
  let match;
  while ((match = scanner.exec(haystack)) !== null) {
    const kind = isAddressOccurrence(haystack, match.index, token);
    if (!kind) return true;
    if (kind === 'index' || kind === 'line-number prefix') continue;
    const bounds = lexemeBounds(haystack, match.index, token.length);
    const candidates = kind === 'path segment'
      ? [bounds.lexeme.split('/').find((segment) => containsToken(segment, token)) || bounds.lexeme]
      : [bounds.lexeme, haystack.slice(bounds.start, match.index + token.length)];
    for (const name of candidates) {
      if (name && /[A-Za-z]/.test(name) && claimText.includes(name)) return true;
    }
  }
  return false;
}

// A digit the reader sees as a digit is a digit, whatever code point it is. Fullwidth "１２４７"
// renders as 1247 and makes the same claim, so it must be tokenised as 1247 and matched against
// command output as 1247. Without this the tokeniser's ASCII \d silently skips the whole run and
// the figure never enters the audit at all — a claim that is invisible rather than unbacked.
//
// G5.4j J1: the class was \p{Nd} alone, which is "decimal digit". A reader does not read a
// category — they read a numeral. "²" (U+00B2, category No) and "①" (U+2460, No) are numerals on
// the screen and were invisible to a gate that scanned only Nd, so a superscript or a circled
// digit laundered any figure. \p{No} (other number: superscripts, circled, fractions) and \p{Nl}
// (letter number: Roman numerals) join the class. The rule is unchanged — what a reader reads as
// a number is a number — only its extension is now the whole of Unicode's number property.
const UNICODE_NUMERAL = /[\p{Nd}\p{No}\p{Nl}]/gu;
// NFKC folds the compatibility numeral forms — fullwidth "１２４７" becomes 1247, "²" becomes 2,
// "①" becomes 1 — so the run is tokenised as the number the reader sees, and one code point folds
// to exactly one ASCII digit, which keeps every span offset computed on the folded text valid.
// Numerals that do NOT fold to a single ASCII digit (Arabic-Indic ٤, Devanagari ४, Roman Ⅻ, the
// fraction ½, the parenthesised ⑴) are NOT treated as absent: unreadableNumerals() reports them
// and the audit fails closed rather than skipping the figure.
function foldNumeralsToAscii(text) {
  return String(text).replace(UNICODE_NUMERAL, (numeral) => {
    const folded = numeral.normalize('NFKC');
    return /^\d$/.test(folded) ? folded : numeral;
  });
}
function unreadableNumerals(text) {
  return (String(text).match(UNICODE_NUMERAL) || [])
    .filter((numeral) => !/^\d$/.test(numeral.normalize('NFKC')));
}
// The in-page side needs the same test, so a mutation observer can tell a numeral-bearing
// insertion from a decorative one.
const NUMERAL_SOURCE = '[\\p{Nd}\\p{No}\\p{Nl}]';

function extractArabicTokens(text) {
  return [...new Set(text.match(TOKEN_PATTERN) || [])];
}

// A sentence is the span a footnote chip can plausibly belong to. Boundaries:
//   1. a line break in the rendered text;
//   2. a full stop followed by whitespace, a Hangul syllable or the end. The Hangul case matters
//      because adjacent rendered lines arrive concatenated ("...명령이다.검인도"), and the digit
//      case must NOT split, so that "v2.1.100" and "0.53" stay whole;
//   3. G5.4h: a Korean declarative ending followed by whitespace, UNLESS what follows is the
//      footnote marker of that same sentence. Boundary 2 alone was the page's own punctuation,
//      and the page chooses its own punctuation: deleting a single full stop merged an uncited
//      claim into a cited sentence and handed it that sentence's citation. A declarative ending
//      is morphology, and morphology is not free to move.
function sentencesOf(text) {
  return text
    .split(/\n+|(?<=[.!?])(?=[\s가-힣]|$)|(?<=[다요까죠])(?=\s+(?!\[E-\d+\]))/)
    .filter((part) => part.trim() !== '');
}

function chipsIn(text) {
  return [...new Set(text.match(CHIP_PATTERN) || [])].map((chip) => chip.slice(1, -1));
}

// ---------------------------------------------------------------------------
// DOM harvest
// ---------------------------------------------------------------------------

// Attributes whose value is read out to somebody. alt is read when the image is not; aria-label,
// aria-description, aria-roledescription, aria-valuetext and aria-placeholder are read by assistive
// technology; title is a tooltip; placeholder is on the screen until the field is typed into. All
// of them are copy, and G5.4i put four alt strings, two copy-button labels and a language toggle
// label on the page outside the audit's reach. J2 puts them inside it.
const READER_ATTRIBUTES = [
  'alt', 'aria-label', 'title', 'placeholder',
  'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-placeholder'
];

// J4 timing. The old gate opened every <details>, waited 200ms and read the DOM, so anything a
// script inserted at 201ms was never audited. Three windows replace the one:
//   SETTLE_MS      the legacy settle, kept so the first read is unchanged;
//   LATE_SETTLE_MS a further wait before the read, so an insertion inside it is audited normally;
//   TRIPWIRE_MS    a wait AFTER the read, during which a MutationObserver that has been running
//                  since document start reports any numeral-bearing insertion. Anything that
//                  arrives there is not audited — so it is failed, not ignored.
// RESIDUE, stated rather than hidden: an insertion after SETTLE+LATE+TRIPWIRE is outside the
// observation window entirely. The window is a measurement in the report, not a promise.
const SETTLE_MS = 200;
const LATE_SETTLE_MS = 1800;
const TRIPWIRE_MS = 1200;

async function harvest(pageFile) {
  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    // Armed before any page script runs, so an insertion scheduled by the page's own bootstrap is
    // seen from the first tick rather than from whenever the audit happens to look.
    await page.addInitScript((numeralSource) => {
      const numeral = new RegExp(numeralSource, 'u');
      window.__auditMutations = [];
      const note = (kind, text, target) => {
        const value = String(text == null ? '' : text);
        if (!numeral.test(value)) return;
        window.__auditMutations.push({
          t: Math.round(performance.now()),
          kind,
          target: target || '',
          text: value.replace(/\s+/g, ' ').trim().slice(0, 200)
        });
      };
      const arm = () => {
        if (!document.documentElement) { setTimeout(arm, 0); return; }
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            if (record.type === 'childList') {
              record.addedNodes.forEach((node) => note('inserted-node', node.textContent, node.nodeName));
            } else if (record.type === 'characterData') {
              note('text-rewritten', record.target.nodeValue, record.target.parentElement
                ? record.target.parentElement.nodeName : '#text');
            } else if (record.type === 'attributes') {
              note(`attribute:${record.attributeName}`, record.target.getAttribute(record.attributeName),
                record.target.nodeName);
            }
          }
        });
        observer.observe(document.documentElement, {
          childList: true, subtree: true, characterData: true,
          attributes: true, attributeFilter: window.__auditReaderAttributes || []
        });
        window.__auditObserver = observer;
      };
      arm();
    }, NUMERAL_SOURCE);
    await page.addInitScript((attributes) => { window.__auditReaderAttributes = attributes; }, READER_ATTRIBUTES);
    await page.goto(`file://${pageFile}`, { waitUntil: 'networkidle', timeout: 60000 });
    // A collapsed disclosure still ships its copy to the reader, so it is audited too.
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach((node) => { node.open = true; });
    });
    await page.waitForTimeout(SETTLE_MS);
    await page.waitForTimeout(LATE_SETTLE_MS);

    const harvestOnce = ({ itemSelectors, tokenSource, pathLiteralSource, readerAttributes, numeralSource, langState }) => {
      const ITEM = itemSelectors.join(',');
      const numeral = new RegExp(numeralSource, 'u');

      const isRendered = (el) => {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };

      // A reading unit is the smallest BOX a reader takes in as one statement. It used to be the
      // nearest ancestor whose tag was on a list that included SPAN, so <span>2</span><span>1</span>
      // — which renders as 21 — was audited as a 2 and a 1 and each half found its own backing.
      // Inline-level boxes are read together with their neighbours, so the unit is the nearest
      // ancestor that is not one.
      const INLINE_LEVEL = new Set([
        'inline', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table', 'contents',
        'ruby', 'ruby-base', 'ruby-text', 'ruby-base-container', 'ruby-text-container'
      ]);
      const blockOf = (el) => {
        let node = el;
        let last = el;
        while (node && node !== document.body) {
          if (!INLINE_LEVEL.has(getComputedStyle(node).display)) return node;
          last = node;
          node = node.parentElement;
        }
        return last;
      };

      // A footnote's address is exempt only while it looks like an address. The class name used to
      // be enough, which made the path span a place to hide prose the reader could still see.
      const ADDRESS_SELECTOR = '.ledger-notes__path, .ledger-notes__cmd';
      const tokenRe = new RegExp(tokenSource, 'g');
      const pathRe = new RegExp(pathLiteralSource, 'g');
      const exemptCache = new Map();
      const computeExempt = (el) => {
        const text = el.textContent || '';
        if (el.classList.contains('ledger-notes__cmd')) {
          // A command is an instrument the reader can run, not an assertion — but only while it is
          // a command. Korean prose inside it is prose.
          return !/[\uAC00-\uD7A3]/.test(text);
        }
        if (el.classList.contains('ledger-notes__path')) {
          const spans = [];
          pathRe.lastIndex = 0;
          let m;
          while ((m = pathRe.exec(text)) !== null) {
            if (m[0] === '') { pathRe.lastIndex += 1; continue; }
            if (!/[A-Za-z]/.test(m[0])) continue;
            spans.push([m.index, m.index + m[0].length]);
          }
          tokenRe.lastIndex = 0;
          let d;
          while ((d = tokenRe.exec(text)) !== null) {
            const start = d.index;
            const end = d.index + d[0].length;
            if (spans.some(([a, b]) => a <= start && end <= b)) continue;
            // an L<n> pin is address material even outside a path literal
            if (text[start - 1] === 'L' && !/[A-Za-z0-9]/.test(text[start - 2] || '')) continue;
            return false;
          }
          return true;
        }
        return false;
      };
      const isExemptAddress = (el) => {
        if (!exemptCache.has(el)) exemptCache.set(el, computeExempt(el));
        return exemptCache.get(el);
      };
      const inExemptAddress = (el) => {
        const owner = el.closest(ADDRESS_SELECTOR);
        return owner ? isExemptAddress(owner) : false;
      };

      // The rendered reading of a subtree, with the line breaks a reader actually sees and with
      // exempt address material removed.
      const textCache = new Map();
      const collectText = (root) => {
        if (textCache.has(root)) return textCache.get(root);
        const parts = [];
        let lastBlock = null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode()) !== null) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR') { parts.push('\n'); lastBlock = null; }
            continue;
          }
          const parent = node.parentElement;
          if (!parent) continue;
          if (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT') continue;
          if (!isRendered(parent)) continue;
          if (inExemptAddress(parent)) continue;
          const value = node.nodeValue || '';
          if (!value.trim()) { parts.push(' '); continue; }
          const block = blockOf(parent);
          if (lastBlock && block !== lastBlock) parts.push('\n');
          parts.push(value.replace(/\s+/g, ' '));
          lastBlock = block;
        }
        const blockText = parts.join('')
          .replace(/[ \t]*\n[ \t]*/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{2,}/g, '\n')
          .trim();
        const result = { blockText, text: blockText.replace(/\s+/g, ' ').trim() };
        textCache.set(root, result);
        return result;
      };

      const nearestItem = (el) => {
        const item = el.closest(ITEM);
        if (item) return { node: item, kind: 'item' };
        const entry = el.closest('.composition-entry');
        if (entry) return { node: entry, kind: 'section' };
        return { node: document.body, kind: 'document' };
      };

      const chipsOfText = (text) => [...new Set((text || '').match(/\[E-\d+\]/g) || [])]
        .map((chip) => chip.slice(1, -1));

      // The chips a figure may lean on.
      //
      //   item      the item's own footnotes — exactly what the headline promises.
      //   document  none (H1, G5.4h).
      //   section   J5. This was the union of every chip anywhere in the section, so a figure
      //             loose in a section inherited the merged output of every source that section
      //             cites and was "reproduced" by whichever of them happened to print it. A
      //             section is not an item; the only honest attribution left to a loose figure is
      //             a marker written beside the figure itself, so section scope now reads the
      //             UNIT's own markers and nothing else. A section-scope unit that names no source
      //             is unattached, which is the same answer document scope already gives.
      const scopeChipsFor = (scope, ownText) => {
        if (scope.kind === 'document') return [];
        if (scope.kind === 'section') return chipsOfText(ownText);
        return chipsOfText(scope.node.textContent || '');
      };
      const scopeTextFor = (scope, ownText) => {
        if (scope.kind === 'document') return '';
        if (scope.kind === 'section') return ownText;
        return collectText(scope.node).blockText;
      };
      const stampOf = (el) => {
        const entry = el.closest('[data-ledger-stamp]');
        return entry ? entry.getAttribute('data-ledger-stamp').split(' ').slice(0, 2).join(' ') : 'none';
      };

      // Peer groups rendered in a section: repeated CATALOG COLLECTION members that share a
      // class — list items, cards, steps, rows, plans. These are the only counts a reader can
      // verify by looking, so they are the only counts that license an ON_PAGE_SELF_REFERENCE.
      const isCollectionMember = (el) => el.tagName === 'LI'
        || (typeof el.className === 'string' && /__(item|card|step|row|plan)\b/.test(el.className));
      const renderedGroups = (section) => {
        if (!section) return [];
        const groups = [];
        const parents = [section, ...section.querySelectorAll('*')];
        for (const parent of parents) {
          if (parent.closest('.ledger-notes')) continue;
          const byClass = new Map();
          for (const child of parent.children) {
            if (child.tagName === 'STYLE' || child.tagName === 'SCRIPT') continue;
            if (!isRendered(child)) continue;
            if (!isCollectionMember(child)) continue;
            const key = typeof child.className === 'string' ? child.className : '';
            byClass.set(key, (byClass.get(key) || 0) + 1);
          }
          for (const [key, count] of byClass) {
            if (count < 2) continue;
            groups.push({
              count,
              container: typeof parent.className === 'string' && parent.className
                ? parent.className
                : parent.tagName.toLowerCase(),
              childClass: key || `${parent.tagName.toLowerCase()} list items`
            });
          }
        }
        return groups;
      };

      const groupCache = new Map();
      const groupsFor = (section) => {
        if (!groupCache.has(section)) groupCache.set(section, renderedGroups(section));
        return groupCache.get(section);
      };

      const units = [];
      const seen = new Set();
      let exemptAddressTextNodes = 0;
      let auditedAddressSpans = 0;
      const auditedAddressSeen = new Set();
      let ariaHiddenUnits = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode()) !== null) {
        const raw = (textNode.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!raw) continue;
        const parent = textNode.parentElement;
        if (!parent) continue;
        if (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT') continue;
        if (!isRendered(parent)) continue;
        const addressOwner = parent.closest(ADDRESS_SELECTOR);
        if (addressOwner && isExemptAddress(addressOwner)) { exemptAddressTextNodes += 1; continue; }
        if (addressOwner && !auditedAddressSeen.has(addressOwner)) {
          auditedAddressSeen.add(addressOwner);
          auditedAddressSpans += 1;
        }
        const unit = blockOf(parent);
        if (seen.has(unit)) continue;
        seen.add(unit);
        const scope = nearestItem(unit);
        const section = unit.closest('.composition-entry');
        const box = unit.getBoundingClientRect();
        const reading = collectText(unit);
        const ariaHidden = Boolean(unit.closest('[aria-hidden="true"]'));
        if (ariaHidden) ariaHiddenUnits += 1;
        units.push({
          tag: unit.tagName,
          cls: typeof unit.className === 'string' ? unit.className : '',
          text: reading.text,
          blockText: reading.blockText,
          y: Math.round(box.top + window.scrollY),
          notesBand: Boolean(unit.closest('.ledger-notes')),
          addressSpan: addressOwner ? (typeof addressOwner.className === 'string' ? addressOwner.className : 'address') : null,
          ariaHidden,
          scopeKind: scope.kind,
          scopeCls: typeof scope.node.className === 'string' ? scope.node.className : '',
          scopeChips: scopeChipsFor(scope, reading.blockText),
          scopeText: scopeTextFor(scope, reading.blockText),
          renderedGroups: groupsFor(section),
          surface: 'text',
          langState,
          section: stampOf(unit)
        });
      }

      // J2 — copy that lives in an attribute. An alt string is read out when the image is not
      // there, aria-label IS the accessible name, a title is a tooltip: all of them are sentences
      // the reader receives, and none of them was in the text walk above. Each attribute value is
      // its own reading unit, scoped like any other content to the item it sits in — so a figure
      // smuggled into alt text needs the same footnote as a figure in a paragraph.
      let attributeUnits = 0;
      for (const el of document.querySelectorAll('*')) {
        if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
        if (!isRendered(el)) continue;
        for (const attribute of readerAttributes) {
          if (!el.hasAttribute(attribute)) continue;
          const value = (el.getAttribute(attribute) || '').replace(/\s+/g, ' ').trim();
          if (!value) continue;
          const scope = nearestItem(el);
          const box = el.getBoundingClientRect();
          attributeUnits += 1;
          units.push({
            tag: el.tagName,
            cls: typeof el.className === 'string' ? el.className : '',
            text: value,
            blockText: value,
            y: Math.round(box.top + window.scrollY),
            notesBand: Boolean(el.closest('.ledger-notes')),
            addressSpan: null,
            ariaHidden: Boolean(el.closest('[aria-hidden="true"]')),
            scopeKind: scope.kind,
            scopeCls: typeof scope.node.className === 'string' ? scope.node.className : '',
            scopeChips: scopeChipsFor(scope, value),
            scopeText: scopeTextFor(scope, value),
            renderedGroups: groupsFor(el.closest('.composition-entry')),
            surface: 'attribute',
            attribute,
            langState,
            section: stampOf(el)
          });
        }
      }

      // J3 — copy that lives in CSS. ::before/::after content is painted onto the page and is
      // absent from every text node, so a figure written there was invisible to the audit while
      // being perfectly visible to the reader. The computed value is parsed: quoted strings are
      // the text, attr() is resolved from the element, and counter() is flagged rather than
      // guessed, because no DOM API returns a rendered counter and a figure this gate cannot read
      // must fail rather than pass.
      const decodeCss = (text) => text
        .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_all, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1');
      const parseGenerated = (el, raw) => {
        if (!raw || raw === 'none' || raw === 'normal') return null;
        const scanner = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(counters?)\s*\(|attr\(\s*([A-Za-z_:][-\w:.]*)[^)]*\)/g;
        let text = '';
        let unresolved = null;
        let match;
        while ((match = scanner.exec(raw)) !== null) {
          if (match[1] !== undefined) text += decodeCss(match[1]);
          else if (match[2] !== undefined) text += decodeCss(match[2]);
          else if (match[3]) unresolved = `${match[3]}()`;
          else if (match[4]) text += (el.getAttribute(match[4]) || '');
        }
        return { text: text.replace(/\s+/g, ' ').trim(), unresolved };
      };
      let generatedUnits = 0;
      for (const el of document.querySelectorAll('*')) {
        if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
        if (!isRendered(el)) continue;
        for (const pseudo of ['::before', '::after']) {
          let raw = '';
          try { raw = getComputedStyle(el, pseudo).content; } catch (error) { raw = ''; }
          const parsed = parseGenerated(el, raw);
          if (!parsed) continue;
          if (!parsed.unresolved && !numeral.test(parsed.text)) continue;
          const scope = nearestItem(el);
          const box = el.getBoundingClientRect();
          generatedUnits += 1;
          units.push({
            tag: el.tagName,
            cls: typeof el.className === 'string' ? el.className : '',
            text: parsed.text,
            blockText: parsed.text,
            y: Math.round(box.top + window.scrollY),
            notesBand: Boolean(el.closest('.ledger-notes')),
            addressSpan: null,
            ariaHidden: Boolean(el.closest('[aria-hidden="true"]')),
            scopeKind: scope.kind,
            scopeCls: typeof scope.node.className === 'string' ? scope.node.className : '',
            scopeChips: scopeChipsFor(scope, parsed.text),
            scopeText: scopeTextFor(scope, parsed.text),
            renderedGroups: groupsFor(el.closest('.composition-entry')),
            surface: 'generated-content',
            pseudo,
            generatedUnresolved: parsed.unresolved,
            langState,
            section: stampOf(el)
          });
        }
      }

      const notes = [...document.querySelectorAll('.ledger-notes__note')].map((node) => ({
        id: node.getAttribute('data-note-id'),
        claim: ((node.querySelector('.ledger-notes__claim') || {}).textContent || '').trim(),
        path: ((node.querySelector('.ledger-notes__path') || {}).textContent || '').trim(),
        reproduce: ((node.querySelector('.ledger-notes__cmd') || {}).textContent || '').trim()
      }));

      return {
        units, notes, exemptAddressTextNodes, auditedAddressSpans, ariaHiddenUnits,
        attributeUnits, generatedUnits, langState,
        harvestedAt: Math.round(performance.now())
      };
    };

    const evaluateArgs = (langState) => ({
      itemSelectors: ITEM_SELECTORS,
      tokenSource: TOKEN_PATTERN.source,
      pathLiteralSource: PATH_LITERAL_PATTERN.source,
      readerAttributes: READER_ATTRIBUTES,
      numeralSource: NUMERAL_SOURCE,
      langState
    });

    // J6/J7 — the page ships two languages in one DOM and hides one with CSS. Auditing only the
    // state the file happens to boot in leaves the other language's copy unread, so a figure in an
    // EN-only span was never audited from page.html at all, and an inline run that is innocent in
    // one state can read as a different number in the other. Both states are harvested from the
    // SAME file and the units are unioned, so neither language is a hiding place.
    const initialLang = await page.evaluate(() => document.documentElement.getAttribute('data-page-lang'));
    const passes = [await page.evaluate(harvestOnce, evaluateArgs(initialLang || 'default'))];
    const otherLang = initialLang === 'en' ? 'ko' : 'en';
    const switched = await page.evaluate((next) => {
      const toggle = document.querySelector('[data-lang-toggle]');
      if (toggle) { toggle.click(); return document.documentElement.getAttribute('data-page-lang'); }
      if (!document.documentElement.hasAttribute('data-page-lang')) return null;
      document.documentElement.setAttribute('data-page-lang', next);
      return next;
    }, otherLang);
    if (switched && switched !== initialLang) {
      await page.waitForTimeout(300);
      passes.push(await page.evaluate(harvestOnce, evaluateArgs(switched)));
    }

    const harvestEndedAt = await page.evaluate(() => Math.round(performance.now()));
    await page.waitForTimeout(TRIPWIRE_MS);
    const mutations = await page.evaluate(() => (window.__auditMutations || []).slice());

    // Union the states. A unit that reads the same in both is audited once; a unit that exists in
    // only one state survives on its own.
    const merged = new Map();
    for (const pass of passes) {
      for (const unit of pass.units) {
        const key = [unit.surface, unit.attribute || '', unit.pseudo || '', unit.tag, unit.cls,
          unit.scopeKind, unit.scopeCls, unit.scopeChips.join(','), unit.text].join(' ');
        if (!merged.has(key)) merged.set(key, unit);
      }
    }

    return {
      units: [...merged.values()],
      notes: passes[0].notes,
      exemptAddressTextNodes: passes[0].exemptAddressTextNodes,
      auditedAddressSpans: Math.max(...passes.map((pass) => pass.auditedAddressSpans)),
      ariaHiddenUnits: Math.max(...passes.map((pass) => pass.ariaHiddenUnits)),
      attributeUnits: passes.reduce((sum, pass) => sum + pass.attributeUnits, 0),
      generatedUnits: passes.reduce((sum, pass) => sum + pass.generatedUnits, 0),
      langStates: passes.map((pass) => pass.langState),
      harvestEndedAt,
      observationWindowMs: SETTLE_MS + LATE_SETTLE_MS + TRIPWIRE_MS,
      lateMutations: mutations.filter((entry) => entry.t >= harvestEndedAt),
      mutationsObserved: mutations.length
    };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: REPO_ROOT,
    shell: '/bin/sh',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 900000
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    exitCode: result.status,
    signal: result.signal || null,
    error: result.error ? result.error.message : null,
    output: `${stdout}${stderr}`,
    lineCount: `${stdout}${stderr}`.replace(/\n$/, '').split('\n').filter((line) => line.trim() !== '').length
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function auditUnit(unit, noteIndex, executions, korean) {
  // Fold before anything reads the text, so every downstream check — tokenising, path carriers,
  // occurrence spans — sees the same digits the reader sees. Nd maps 1:1 to ASCII here, so span
  // offsets computed on `bare` stay valid against the rendered unit.
  const bare = foldNumeralsToAscii(unit.text.replace(CHIP_PATTERN, ' '));
  const unreadable = unreadableNumerals(unit.text);
  const arabic = extractArabicTokens(bare);
  const cardinals = korean.matchesIn(bare);
  // J3 residue: generated content whose value comes from a CSS counter cannot be read back through
  // any DOM API, so a figure written that way is unauditable and the gate refuses it rather than
  // skipping it — the same fail-closed rule UNREADABLE already applies to unfoldable numerals.
  const unresolvedGenerated = unit.generatedUnresolved ? [unit.generatedUnresolved] : [];
  if (arabic.length === 0 && cardinals.length === 0 && unreadable.length === 0
    && unresolvedGenerated.length === 0) return null;

  const literalSpans = pathLiteralSpans(bare);
  const groupCounts = new Map();
  for (const group of unit.renderedGroups) {
    if (!groupCounts.has(String(group.count))) groupCounts.set(String(group.count), group);
  }

  const record = {
    y: unit.y,
    section: unit.section,
    tag: unit.tag,
    cls: unit.cls,
    scopeKind: unit.scopeKind,
    scopeCls: unit.scopeCls,
    addressSpan: unit.addressSpan,
    ariaHidden: unit.ariaHidden,
    surface: unit.surface || 'text',
    attribute: unit.attribute || null,
    pseudo: unit.pseudo || null,
    langState: unit.langState || null,
    chips: unit.scopeChips,
    text: bare.replace(/\s+/g, ' ').trim().slice(0, 240),
    tokens: [],
    failures: []
  };

  // Classify first: only EXTERNAL_MEASUREMENT tokens need a citation at all.
  const classify = (token, kind) => {
    // PATH_ONLY and IDENTIFIER are properties of a rendered digit run. A Korean cardinal is a
    // word, so it can never BE a path segment or part of a name, and must not inherit the
    // exemption from an unrelated path that happens to sit in the same sentence.
    if (kind === 'arabic') {
      const carrier = pathCarrier(bare, token, literalSpans);
      if (carrier) return { token, kind, klass: 'PATH_ONLY', evidence: carrier };
      if (isIdentifierDigits(bare, token)) {
        return { token, kind, klass: 'IDENTIFIER', evidence: 'digits welded to a preceding letter' };
      }
    }
    // A Korean cardinal that matches a rendered collection is only *eligible* to be a
    // self-reference. If the item also cites a command that prints the value, the citation is
    // the truer account and wins, so a coincidental group never takes credit for a figure that
    // was genuinely reproduced.
    const group = kind !== 'arabic' ? groupCounts.get(token) : undefined;
    return {
      token,
      kind,
      klass: 'EXTERNAL_MEASUREMENT',
      evidence: null,
      selfReference: group
        ? `${group.count} rendered peers of .${group.childClass} inside ${group.container}`
        : null
    };
  };

  const classified = [
    ...arabic.map((token) => classify(token, 'arabic')),
    ...cardinals.map((item) => ({
      ...classify(item.value, `korean(${item.phrase})`),
      korean: item,
      readChannel: item.readChannel
    }))
  ];
  // A self-reference stands on the DOM alone, and only where the DOM is what the reader is
  // looking at: an item with no citation of its own, outside the footnote band.
  if (unit.scopeChips.length === 0 && !unit.notesBand) {
    for (const entry of classified) {
      if (entry.klass !== 'EXTERNAL_MEASUREMENT' || !entry.selfReference) continue;
      entry.klass = 'ON_PAGE_SELF_REFERENCE';
      entry.evidence = entry.selfReference;
    }
  }
  const external = classified.filter((entry) => entry.klass === 'EXTERNAL_MEASUREMENT');

  // A digit the gate cannot read is not a digit the gate may ignore. Skipping it would let a
  // figure be laundered by writing it in a script this tokeniser does not fold.
  if (unreadable.length > 0) {
    record.verdict = 'UNREADABLE';
    record.failures.push(
      `prints numeral(s) ${[...new Set(unreadable)].map((numeral) => `"${numeral}"`).join(', ')} that this gate cannot fold to a single ASCII digit, so the figure cannot be audited`
    );
  }
  if (unresolvedGenerated.length > 0) {
    record.verdict = 'UNREADABLE';
    record.failures.push(
      `renders CSS generated content through ${unresolvedGenerated.join(', ')}, whose value no DOM API returns, so the figure cannot be audited`
    );
  }

  if (external.length === 0) {
    record.tokens = classified.map((entry) => ({ ...entry, channel: 'not-a-claim' }));
    record.verdict = 'PASS';
    return record;
  }

  const chips = unit.scopeChips;
  if (chips.length === 0) {
    record.verdict = 'UNATTACHED';
    record.failures.push(
      `prints ${external.map((entry) => `"${entry.token}"`).join(', ')} from outside the page with no footnote chip in its ${unit.scopeKind} scope`
    );
    record.tokens = classified.map((entry) => ({
      ...entry,
      channel: entry.klass === 'EXTERNAL_MEASUREMENT' ? 'none' : 'not-a-claim'
    }));
    return record;
  }

  const outputs = [];
  const shapeByChip = new Map();
  for (const chip of chips) {
    const note = noteIndex.get(chip);
    if (!note) {
      record.failures.push(`chip [${chip}] has no footnote definition on the page`);
      continue;
    }
    const execution = executions.get(chip);
    if (!execution || !execution.reproduce) {
      record.failures.push(`chip [${chip}] carries no reproduce command`);
      continue;
    }
    if (execution.run.error || execution.run.signal) {
      record.failures.push(`chip [${chip}] command could not run: ${execution.run.error || execution.run.signal}`);
      continue;
    }
    outputs.push(execution.run.output);
    shapeByChip.set(chip, String(execution.run.lineCount));
  }
  const outputUnion = outputs.join('\n');
  const shapeCapable = chips.filter((chip) => shapeByChip.has(chip));

  // Sentences of the ITEM that make a cardinal claim. Item-level attribution is only honest when
  // there is exactly one of them beside exactly one source: then nothing can be confused with
  // anything else. Two cardinal sentences sharing one chip is the "cite less, get more" shape the
  // fourth audit walked through, and it is refused.
  const itemCardinalSentences = sentencesOf(unit.scopeText || unit.blockText || unit.text)
    .filter((sentence) => korean.matchesIn(sentence).length > 0).length;

  // Which chip does a shape claim point at? The claim has to name its own source inside its own
  // sentence, and the marker has to come AFTER the cardinal, the way a footnote marker does. The
  // claim is located in the RENDERED text (which keeps the line breaks a reader sees) by counting
  // occurrences of the same cardinal, so the second "두" of an item is not attributed to the chip
  // that backs the first. If the two readings of the unit disagree on how many times that cardinal
  // occurs, the location is unknown and the channel is simply not offered.
  const shapeChipsFor = (entry) => {
    if (!entry.korean) return { owners: [], via: null };
    if (shapeCapable.length === 0) return { owners: [], via: null };
    const rendered = unit.blockText || unit.text || '';
    const renderedMatches = korean.matchesIn(rendered).filter((m) => m.raw === entry.korean.raw);
    const bareCount = cardinals.filter((m) => m.raw === entry.korean.raw).length;
    if (renderedMatches.length !== bareCount) return { owners: [], via: null };
    const here = renderedMatches[entry.korean.ordinal];
    if (!here) return { owners: [], via: null };
    let cursor = 0;
    let owner = null;
    let ownerStart = 0;
    for (const sentence of sentencesOf(rendered)) {
      const start = rendered.indexOf(sentence, cursor);
      if (start < 0) continue;
      cursor = start + sentence.length;
      if (here.index >= start && here.index < cursor) { owner = sentence; ownerStart = start; break; }
    }
    if (owner !== null) {
      const offset = here.index - ownerStart;
      const named = chipsIn(owner).filter((chip) => shapeByChip.has(chip)
        && owner.indexOf(`[${chip}]`) > offset);
      if (named.length === 1) return { owners: named, via: 'sentence' };
      if (named.length > 1) return { owners: [], via: null };
    }
    // No marker names the source inside the sentence. Item-level attribution is the fallback and
    // it is available only where it cannot be gamed.
    if (shapeCapable.length !== 1) return { owners: [], via: null };
    if (itemCardinalSentences !== 1) return { owners: [], via: null };
    return { owners: shapeCapable, via: 'item' };
  };

  for (const entry of classified) {
    if (entry.klass !== 'EXTERNAL_MEASUREMENT') {
      record.tokens.push({ ...entry, channel: 'not-a-claim' });
      continue;
    }
    if (printsValue(outputUnion, entry.token, bare)) {
      record.tokens.push({ ...entry, channel: 'output' });
      continue;
    }
    // Arabic figures may never lean on output shape: "exit 1" must not be satisfied by a
    // command that happens to print one line.
    if (entry.kind !== 'arabic') {
      const { owners, via } = shapeChipsFor(entry);
      if (owners.length === 1 && shapeByChip.get(owners[0]) === entry.token) {
        record.tokens.push({
          ...entry,
          channel: 'output-shape',
          shapeAttribution: via,
          evidence: `[${owners[0]}] printed ${entry.token} line(s), attributed by ${via}`
        });
        continue;
      }
    }
    record.tokens.push({ ...entry, channel: 'none' });
    record.failures.push(`"${entry.token}" (${entry.kind}) comes from outside the page and no cited command prints it`);
  }

  record.tokens = record.tokens.map(({ korean: _korean, ...rest }) => rest);
  record.verdict = record.failures.length ? 'OUT-OF-SCOPE' : 'PASS';
  return record;
}

function buildMarkdown(report) {
  const c = report.counters;
  const lines = [];
  lines.push('# citation-audit');
  lines.push('');
  lines.push(`- page: \`${report.page}\``);
  lines.push(`- sha256: \`${report.pageSha256}\``);
  lines.push(`- verdict: **${report.verdict}** (exit ${report.exitCode})`);
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('| measure | value |');
  lines.push('| --- | --- |');
  for (const [key, value] of Object.entries(c)) lines.push(`| ${key} | ${value} |`);
  lines.push('');
  lines.push('## Classification rules (code, not allowlist)');
  lines.push('');
  lines.push('| class | rule | tokens |');
  lines.push('| --- | --- | --- |');
  lines.push(`| EXTERNAL_MEASUREMENT | only knowable by reading the repository — requires a chip and a command that prints it | ${c.tokensExternal} |`);
  lines.push(`| ON_PAGE_SELF_REFERENCE | a Korean cardinal equal to a peer group counted in the same section's DOM | ${c.tokensSelfReference} |`);
  lines.push(`| PATH_ONLY | a digit inside a slash-bearing path literal | ${c.tokensPathOnly} |`);
  lines.push(`| IDENTIFIER | pure digits welded to a preceding letter (sha256, v3) | ${c.tokensIdentifier} |`);
  lines.push('');
  lines.push('### Korean counter nouns harvested from the page itself (welded-counter channel)');
  lines.push('');
  lines.push(`\`${report.koreanCounterNouns.join('` `') || '—'}\``);
  lines.push('');
  lines.push('### every ON_PAGE_SELF_REFERENCE, with the DOM group that licenses it');
  lines.push('');
  lines.push('| y | section | token | rendered group |');
  lines.push('| --- | --- | --- | --- |');
  for (const entry of report.classified.selfReference) {
    lines.push(`| ${entry.y} | ${entry.section} | ${entry.kind} → ${entry.token} | ${entry.evidence} |`);
  }
  lines.push('');
  lines.push('### every PATH_ONLY token, with its carrier literal');
  lines.push('');
  lines.push('| y | token | literal |');
  lines.push('| --- | --- | --- |');
  for (const entry of report.classified.pathOnly) {
    lines.push(`| ${entry.y} | ${entry.token} | \`${entry.evidence}\` |`);
  }
  lines.push('');
  lines.push('### every IDENTIFIER token, with its unit');
  lines.push('');
  lines.push('| y | token | unit |');
  lines.push('| --- | --- | --- |');
  for (const entry of report.classified.identifier) {
    lines.push(`| ${entry.y} | ${entry.token} | ${entry.text.replace(/\|/g, '\\|').slice(0, 90)} |`);
  }
  lines.push('');
  lines.push('## Structural accounting');
  lines.push('');
  lines.push('| class | rule | count |');
  lines.push('| --- | --- | --- |');
  lines.push(`| address text nodes exempt | inside a .ledger-notes__path whose every digit is a path literal or an L<n> pin, or a .ledger-notes__cmd with no Korean prose | ${c.exemptAddressTextNodes} |`);
  lines.push(`| address spans AUDITED | a footnote span that stopped looking like an address and is read as prose | ${c.auditedAddressSpans} |`);
  lines.push(`| aria-hidden units audited | hidden from assistive technology, still on the screen, still audited | ${c.ariaHiddenUnitsAudited} |`);
  lines.push('');
  lines.push('## Reading surfaces (G5.4j)');
  lines.push('');
  lines.push('| surface | rule | units |');
  lines.push('| --- | --- | --- |');
  lines.push(`| text node | the rendered reading of a block, as before | ${c.unitsFromText} |`);
  lines.push(`| attribute | every non-empty ${READER_ATTRIBUTES.join(', ')} on a rendered element, audited as its own sentence in the scope of the item it sits in | ${c.unitsFromAttributes} |`);
  lines.push(`| generated content | ::before / ::after \`content\`, with quoted strings read and attr() resolved; counter() cannot be read back and fails closed | ${c.unitsFromGeneratedContent} |`);
  lines.push(`| language states | both states of the page's own KO/EN switch are harvested from the SAME file and unioned | ${c.langStatesHarvested} |`);
  lines.push('');
  lines.push('| timing | value |');
  lines.push('| --- | --- |');
  lines.push(`| observation window | ${c.observationWindowMs}ms (settle ${SETTLE_MS} + late settle ${LATE_SETTLE_MS} + tripwire ${TRIPWIRE_MS}) |`);
  lines.push(`| DOM read finished at | ${c.domReadEndedAtMs}ms |`);
  lines.push(`| numeral-bearing mutations seen | ${c.mutationsObserved} |`);
  lines.push(`| of those, after the read — **failure** | ${c.mutationsAfterHarvest} |`);
  lines.push('');
  lines.push('> RESIDUE: an insertion later than the observation window is outside what this gate observes. The window is reported above as a measurement, not claimed as a proof.');
  lines.push('');
  lines.push('## Satisfaction channels for EXTERNAL_MEASUREMENT');
  lines.push('');
  lines.push('| channel | rule | tokens |');
  lines.push('| --- | --- | --- |');
  lines.push(`| output | the cited command prints the value as a value — digit-boundary matched, and not a path segment, index, line-number prefix or identifier suffix | ${c.tokensViaOutput} |`);
  lines.push(`| output-shape (by sentence) | Korean cardinal equal to the measured line count of the command its own sentence names | ${c.tokensViaOutputShapeBySentence} |`);
  lines.push(`| output-shape (by item) | Korean cardinal equal to the line count of the item's ONLY source, where the item makes only ONE cardinal claim | ${c.tokensViaOutputShapeByItem} |`);
  lines.push(`| none | nothing backs it — **failure** | ${c.tokensUnresolved} |`);
  lines.push('');
  lines.push('> The line-pin channel was deleted in G5.4h. It compared an integer in the command text with an "L<n>" string in the note path and never checked that the line existed, so `sed -n 4096p` on a 720-line file minted the number 4096.');
  lines.push('');
  lines.push('## Executed commands');
  lines.push('');
  lines.push('| chip | exit | lines | command |');
  lines.push('| --- | --- | --- | --- |');
  for (const execution of report.executions) {
    lines.push(`| ${execution.id} | ${execution.exitCode} | ${execution.lineCount} | \`${execution.reproduce.replace(/\|/g, '\\|')}\` |`);
  }
  lines.push('');
  lines.push('## Every unit that prints a figure');
  lines.push('');
  lines.push('| y | section | surface | lang | scope | chips | verdict | text |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const unit of report.units) {
    const surface = unit.surface === 'attribute' ? `@${unit.attribute}`
      : unit.surface === 'generated-content' ? unit.pseudo : 'text';
    lines.push(`| ${unit.y} | ${unit.section} | ${surface} | ${unit.langState || '—'} | ${unit.scopeKind} | ${unit.chips.map((chip) => `[${chip}]`).join(' ') || '—'} | ${unit.verdict} | ${unit.text.replace(/\|/g, '\\|').slice(0, 110)} |`);
  }
  if (report.failures.length) {
    lines.push('');
    lines.push('## Failures');
    lines.push('');
    for (const failure of report.failures) {
      lines.push(`- y=${failure.y} ${failure.section} [${failure.chips.join(', ') || 'no chip'}] — ${failure.reason}`);
      if (failure.text) lines.push(`  - \`${failure.text}\``);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function main(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out' || argv[index] === '--md') {
      flags[argv[index].slice(2)] = argv[index + 1];
      index += 1;
    } else {
      positionals.push(argv[index]);
    }
  }
  if (positionals.length !== 1) {
    process.stderr.write('usage: node v3/scripts/citation-audit.js <page.html> [--out report.json] [--md report.md]\n');
    return 2;
  }
  const pageFile = path.resolve(positionals[0]);
  const pageSha256 = spawnSync('shasum', ['-a', '256', pageFile], { encoding: 'utf8' })
    .stdout.trim().split(/\s+/)[0];

  const harvested = await harvest(pageFile);
  const { units, notes } = harvested;

  // The welded-counter channel reads the page's own spaced usage. The corpus is every audited
  // reading unit — the same text the gate judges, so nothing is learned from material the reader
  // cannot see.
  const korean = buildKoreanScanner(units.map((unit) => unit.text).join('\n'));

  const noteIndex = new Map();
  const collisions = [];
  for (const note of notes) {
    const signature = `${note.path}\u0000${note.reproduce}`;
    if (!noteIndex.has(note.id)) {
      noteIndex.set(note.id, { ...note, signature });
      continue;
    }
    if (noteIndex.get(note.id).signature !== signature) {
      collisions.push({ id: note.id, a: noteIndex.get(note.id).signature, b: signature });
    }
  }

  const executions = new Map();
  for (const [id, note] of noteIndex) {
    if (!note.reproduce) {
      executions.set(id, { reproduce: '', run: { exitCode: null, output: '', lineCount: 0, error: 'no reproduce command' } });
      continue;
    }
    process.stderr.write(`run ${id}: ${note.reproduce.slice(0, 90)}\n`);
    executions.set(id, { reproduce: note.reproduce, run: runCommand(note.reproduce) });
  }

  const audited = [];
  for (const unit of units) {
    const record = auditUnit(unit, noteIndex, executions, korean);
    if (record) audited.push(record);
  }

  const failures = [];
  for (const unit of audited) {
    for (const reason of unit.failures) {
      failures.push({ y: unit.y, section: unit.section, chips: unit.chips, reason, text: unit.text });
    }
  }
  const citedChips = [...new Set(audited.flatMap((unit) => unit.chips))];
  const danglingChips = citedChips.filter((chip) => !noteIndex.has(chip));
  for (const chip of danglingChips) {
    failures.push({ y: 0, section: 'none', chips: [chip], reason: `chip [${chip}] is cited but never defined`, text: '' });
  }
  for (const collision of collisions) {
    failures.push({ y: 0, section: 'none', chips: [collision.id], reason: 'one chip id resolves to two different sources', text: '' });
  }
  for (const [id, execution] of executions) {
    if (execution.reproduce && (execution.run.error || execution.run.signal)) {
      failures.push({ y: 0, section: 'none', chips: [id], reason: `cited command could not run: ${execution.run.error || execution.run.signal}`, text: '' });
    }
  }
  // J4 — a numeral that arrived after the DOM was read was not audited. Not auditing it is not the
  // same as clearing it, so it is a failure with its insertion time named.
  for (const mutation of harvested.lateMutations) {
    failures.push({
      y: 0,
      section: 'none',
      chips: [],
      reason: `a numeral-bearing ${mutation.kind} into <${(mutation.target || '?').toLowerCase()}> landed at t=${mutation.t}ms, after the DOM was read, so it was never audited`,
      text: mutation.text
    });
  }

  const allTokens = audited.flatMap((unit) => unit.tokens.map((token) => ({ ...token, y: unit.y, section: unit.section, text: unit.text })));
  const byClass = (klass) => allTokens.filter((entry) => entry.klass === klass);

  const report = {
    tool: 'v3/scripts/citation-audit.js',
    page: path.relative(REPO_ROOT, pageFile).split(path.sep).join('/'),
    pageSha256,
    koreanCounterNouns: korean.attested,
    counters: {
      readingUnits: units.length,
      exemptAddressTextNodes: harvested.exemptAddressTextNodes,
      auditedAddressSpans: harvested.auditedAddressSpans,
      ariaHiddenUnitsAudited: harvested.ariaHiddenUnits,
      langStatesHarvested: harvested.langStates.join('+'),
      unitsFromText: units.filter((unit) => unit.surface === 'text').length,
      unitsFromAttributes: units.filter((unit) => unit.surface === 'attribute').length,
      unitsFromGeneratedContent: units.filter((unit) => unit.surface === 'generated-content').length,
      observationWindowMs: harvested.observationWindowMs,
      domReadEndedAtMs: harvested.harvestEndedAt,
      mutationsObserved: harvested.mutationsObserved,
      mutationsAfterHarvest: harvested.lateMutations.length,
      auditedUnits: units.length,
      unitsPrintingFigures: audited.length,
      unitsPass: audited.filter((unit) => unit.verdict === 'PASS').length,
      unitsUnattached: audited.filter((unit) => unit.verdict === 'UNATTACHED').length,
      unitsUnreadable: audited.filter((unit) => unit.verdict === 'UNREADABLE').length,
      unitsOutOfScope: audited.filter((unit) => unit.verdict === 'OUT-OF-SCOPE').length,
      scopeItem: audited.filter((unit) => unit.scopeKind === 'item').length,
      scopeSection: audited.filter((unit) => unit.scopeKind === 'section').length,
      scopeDocument: audited.filter((unit) => unit.scopeKind === 'document').length,
      footnoteDefinitions: notes.length,
      uniqueChips: noteIndex.size,
      chipIdCollisions: collisions.length,
      danglingChips: danglingChips.length,
      commandsExecuted: [...executions.values()].filter((entry) => entry.reproduce).length,
      commandsNonZeroExit: [...executions.values()].filter((entry) => entry.reproduce && entry.run.exitCode !== 0).length,
      koreanCounterNounsAttested: korean.attested.length,
      figureTokens: allTokens.length,
      tokensExternal: byClass('EXTERNAL_MEASUREMENT').length,
      tokensSelfReference: byClass('ON_PAGE_SELF_REFERENCE').length,
      tokensPathOnly: byClass('PATH_ONLY').length,
      tokensIdentifier: byClass('IDENTIFIER').length,
      tokensViaOutput: allTokens.filter((entry) => entry.channel === 'output').length,
      tokensViaOutputShape: allTokens.filter((entry) => entry.channel === 'output-shape').length,
      tokensViaOutputShapeBySentence: allTokens.filter((entry) => entry.channel === 'output-shape' && entry.shapeAttribution === 'sentence').length,
      tokensViaOutputShapeByItem: allTokens.filter((entry) => entry.channel === 'output-shape' && entry.shapeAttribution === 'item').length,
      tokensUnresolved: allTokens.filter((entry) => entry.channel === 'none').length
    },
    classified: {
      selfReference: byClass('ON_PAGE_SELF_REFERENCE'),
      pathOnly: byClass('PATH_ONLY'),
      identifier: byClass('IDENTIFIER'),
      external: byClass('EXTERNAL_MEASUREMENT')
    },
    shapeByItem: allTokens.filter((entry) => entry.channel === 'output-shape' && entry.shapeAttribution === 'item')
      .map((entry) => ({ y: entry.y, token: entry.token, kind: entry.kind, text: entry.text })),
    executions: [...executions.entries()].map(([id, entry]) => ({
      id,
      reproduce: entry.reproduce,
      exitCode: entry.run.exitCode,
      lineCount: entry.run.lineCount
    })).sort((a, b) => a.id.localeCompare(b.id)),
    units: audited,
    failures
  };
  report.verdict = failures.length === 0 ? 'PASS' : 'FAIL';
  report.exitCode = failures.length === 0 ? 0 : 1;

  if (flags.out) fs.writeFileSync(path.resolve(flags.out), `${JSON.stringify(report, null, 2)}\n`);
  if (flags.md) fs.writeFileSync(path.resolve(flags.md), buildMarkdown(report));

  const c = report.counters;
  process.stdout.write(`citation-audit ${report.page}\n`);
  process.stdout.write(`  reading units ${c.readingUnits} (text ${c.unitsFromText} · attribute ${c.unitsFromAttributes} · generated-content ${c.unitsFromGeneratedContent}) · lang states ${c.langStatesHarvested}\n`);
  process.stdout.write(`  exempt address text nodes ${c.exemptAddressTextNodes} · address spans audited ${c.auditedAddressSpans} · aria-hidden units audited ${c.ariaHiddenUnitsAudited}\n`);
  process.stdout.write(`  observation window ${c.observationWindowMs}ms · numeral-bearing mutations ${c.mutationsObserved} (after the read ${c.mutationsAfterHarvest})\n`);
  process.stdout.write(`  units printing a figure ${c.unitsPrintingFigures} · pass ${c.unitsPass} · unattached ${c.unitsUnattached} · unreadable ${c.unitsUnreadable} · out-of-scope ${c.unitsOutOfScope}\n`);
  process.stdout.write(`  scope item ${c.scopeItem} · section ${c.scopeSection} · document ${c.scopeDocument}\n`);
  process.stdout.write(`  figures ${c.figureTokens} · external ${c.tokensExternal} · on-page self-reference ${c.tokensSelfReference} · path-only ${c.tokensPathOnly} · identifier ${c.tokensIdentifier}\n`);
  process.stdout.write(`  external backed by output ${c.tokensViaOutput} · by output shape ${c.tokensViaOutputShape} (sentence ${c.tokensViaOutputShapeBySentence}, item ${c.tokensViaOutputShapeByItem}) · unbacked ${c.tokensUnresolved}\n`);
  process.stdout.write(`  korean counter nouns harvested ${c.koreanCounterNounsAttested} · chips ${c.uniqueChips} · collisions ${c.chipIdCollisions} · dangling ${c.danglingChips} · commands run ${c.commandsExecuted} (non-zero exit ${c.commandsNonZeroExit})\n`);
  for (const failure of failures) {
    process.stdout.write(`  FAIL y=${failure.y} [${failure.chips.join(',') || 'no chip'}] ${failure.reason}\n`);
    if (failure.text) process.stdout.write(`       ${failure.text.slice(0, 150)}\n`);
  }
  process.stdout.write(`RESULT: ${report.verdict} (${failures.length} failure(s))\n`);
  return report.exitCode;
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
