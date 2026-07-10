// Ported/adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft
// Reimplemented idea: shipped placeholder copy detection, with KR service placeholders added.
//
// This tell is severity-tiered, and the tiering is load-bearing. A red-team pass showed the naive
// "any placeholder word -> high" rule fires on legitimate Korean commerce copy: 홍길동 is the
// standard Korean example name (and a novel's protagonist), 010-0000-0000 appears in "이 형식으로
// 입력하세요" guidance, and TODO survives inside a normal 97-character Korean paragraph. Every one of
// those would have flipped a real page's s2Pass to false via the high-severity -> highCount path.
//
// So:
//   UNAMBIGUOUS terms (Lorem ipsum, 제목을 입력하세요 …) fire on their own, at severity high.
//   AMBIGUOUS terms  (홍길동, TODO, John Doe, 010-0000-0000 …) fire only when TWO DISTINCT kinds
//                    co-occur on the page, and then only at severity medium.
//   Any match inside guidance copy ("… 형식으로", "예시:", "for example") is discarded outright.
//
// `XXX` was dropped: it collides with clothing sizes and roman numerals, and carries no signal the
// other markers don't already give.
'use strict';

const SKIP_TEXT_TAGS = new Set([
  'head',
  'title',
  'meta',
  'link',
  'script',
  'style',
  'template',
  'pre',
  'code',
  'kbd',
  'samp',
  'textarea',
]);

// "제목을 입력하세요" is a shipped placeholder in a heading and a perfectly good form hint in a
// <label> or a .hint span. The phrase alone cannot tell them apart, so the ancestor context does:
// anything inside a form control, or under an element whose class reads as a hint, is form UI.
const FORM_CONTEXT_TAGS = new Set(['form', 'label', 'fieldset', 'legend', 'option', 'button', 'select']);
const HINT_CLASS_RE = /\b(hint|help|helper|placeholder|guide|caption|desc|description|tip|note)\b/i;

// A node that teaches the reader a FORMAT is not a node that shipped a placeholder. Kept narrow on
// purpose: 참고 / 같이 / 처럼 are ordinary Korean, and skipping their whole node hid real
// placeholders ("아래를 참고하여 내용을 입력하세요" went undetected). Only format-teaching words remain,
// and the guard now applies to the ambiguous tier only.
const GUIDANCE_RE = /(형식|포맷|양식|예시|샘플|for example|e\.g\.|example of|such as)/i;

// Fire on their own. These have no innocent reading in shipped body copy.
const UNAMBIGUOUS = [
  { label: 'lorem-ipsum', re: /\bLorem\s+ipsum\b/i },
  { label: 'kr-enter-content', re: /내용을 입력(?:하세요|해주세요)?/ },
  { label: 'kr-here-text', re: /여기에 텍스트/ },
  { label: 'kr-enter-title', re: /제목을 입력(?:하세요|해주세요)?/ },
  { label: 'kr-enter-name', re: /이름을 입력(?:하세요|해주세요)?/ },
  { label: 'kr-enter-description', re: /설명을 입력(?:하세요|해주세요)?/ },
];

// Need a second, distinct co-occurring kind before they count. Each has a plausible innocent use.
const AMBIGUOUS = [
  // TODO/FIXME only as a leading marker — "TODO:", "[TODO]", "TODO 후기 채우기" — never mid-sentence.
  { label: 'todo-marker', re: /^\s*\[?\s*(?:TODO|FIXME)\b/ },
  { label: 'placeholder-copy', re: /\bPlaceholder\b/ },
  { label: 'john-jane-doe', re: /\b(?:John|Jane)\s+Doe\b/ },
  { label: '555-test-phone', re: /\b555[-\s]?01\d{2}\b/ },
  {
    label: 'example-dot-com-email',
    re: /\b(?:test|user|name|email|hello|john(?:\.doe)?|jane(?:\.doe)?|foo|bar|placeholder|contact|info)@example\.com\b/i,
  },
  { label: 'kr-placeholder-name', re: /홍길동/ },
  { label: 'kr-zero-phone', re: /\b(?:000|010)-0000-0000\b/ },
];

// A KR "입력하세요" phrase buried in a long paragraph is prose about forms, not a shipped placeholder.
const SHORT_NODE_LABELS = new Set([
  'kr-enter-title',
  'kr-enter-name',
  'kr-enter-description',
  'kr-enter-content',
  'placeholder-copy',
]);
const SHORT_NODE_MAX = 60;

function entityCodePoint(raw, radix) {
  const n = parseInt(raw, radix);
  return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => entityCodePoint(n, 16))
    .replace(/&#(\d+);/g, (_, n) => entityCodePoint(n, 10));
}

const compactSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const snippet = (s, n) => compactSpace(s).slice(0, n || 180);

// Precompute newline offsets once, then binary-search. The previous per-node
// `source.slice(0, index).split('\n')` was O(n^2): 8k text nodes took 930ms and a 60k-node page
// never finished. This module ships in the public npm detector, so it is fed untrusted pages.
function newlineOffsets(source) {
  const offsets = [];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) offsets.push(i);
  return offsets;
}

function lineNumberAt(offsets, index) {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] < index) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
}

function classOf(token) {
  const m = /\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(token);
  return m ? m[2] || m[3] || m[4] || '' : '';
}

function visibleTextNodes(html) {
  const source = String(html || '');
  const offsets = newlineOffsets(source);
  const nodes = [];
  const stack = [];
  const tokenRe = /<\/?([a-z][\w:-]*)\b[^>]*>|([^<]+)/gi;
  let m;

  while ((m = tokenRe.exec(source))) {
    const tag = m[1] && m[1].toLowerCase();
    if (tag) {
      const token = m[0];
      if (/^<\//.test(token)) {
        const idx = stack.findLastIndex((e) => e.tag === tag);
        if (idx !== -1) stack.splice(idx);
      } else if (!/\/>$/.test(token)) {
        stack.push({ tag, cls: classOf(token) });
      }
      continue;
    }

    if (stack.some((e) => SKIP_TEXT_TAGS.has(e.tag))) continue;
    const text = compactSpace(decodeEntities(m[2]));
    if (!text) continue;
    const inFormUi =
      stack.some((e) => FORM_CONTEXT_TAGS.has(e.tag)) || stack.some((e) => HINT_CLASS_RE.test(e.cls));
    nodes.push({ text, line: lineNumberAt(offsets, m.index), inFormUi });
  }

  return nodes;
}

function collect(nodes, patterns, { skipGuidance, skipFormUi }) {
  const hits = [];
  const kinds = new Set();

  for (const node of nodes) {
    if (skipFormUi && node.inFormUi) continue;
    if (skipGuidance && GUIDANCE_RE.test(node.text)) continue;
    for (const { label, re } of patterns) {
      const match = node.text.match(re);
      if (!match) continue;
      if (SHORT_NODE_LABELS.has(label) && node.text.length > SHORT_NODE_MAX) continue;
      kinds.add(label);
      hits.push({ kind: label, line: node.line, match: match[0].trim(), snippet: snippet(node.text) });
    }
  }

  return { hits, kinds };
}

function detectPlaceholderShipped(ctx) {
  const nodes = visibleTextNodes(ctx && ctx.cleanHtml);
  // The unambiguous tier is guarded by CONTEXT (is this form UI?), the ambiguous tier by INTENT
  // (is this teaching a format?). Swapping the two guards is what produced both a false positive
  // on shipped form hints and a false negative on "아래를 참고하여 내용을 입력하세요".
  const strong = collect(nodes, UNAMBIGUOUS, { skipFormUi: true, skipGuidance: false });
  const weak = collect(nodes, AMBIGUOUS, { skipFormUi: true, skipGuidance: true });

  // One unambiguous placeholder is enough. Otherwise two distinct ambiguous kinds must co-occur —
  // a page carrying both 홍길동 and 010-0000-0000 is a template; a novel excerpt naming 홍길동 is not.
  const confirmed = strong.kinds.size > 0;
  const corroborated = weak.kinds.size >= 2;
  if (!confirmed && !corroborated) return null;

  const hits = confirmed ? [...strong.hits, ...weak.hits] : weak.hits;
  return {
    tell: 'placeholder-shipped',
    severity: confirmed ? 'high' : 'medium',
    evidence: {
      count: hits.length,
      kinds: [...new Set(hits.map((h) => h.kind))],
      tier: confirmed ? 'unambiguous' : 'corroborated-ambiguous',
      snippets: hits.slice(0, 8),
      rationale:
        'visible shipped copy contains placeholder terms; head/title/pre/code/textarea and guidance copy are skipped',
    },
  };
}

module.exports = {
  detectPlaceholderShipped,
  // exported for tests: the tiering is the contract, not an implementation detail
  UNAMBIGUOUS,
  AMBIGUOUS,
  GUIDANCE_RE,
};
