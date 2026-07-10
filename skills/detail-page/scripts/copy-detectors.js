// Ported/adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft
// Reimplemented ideas: shipped placeholder copy, em-dash-flood, scroll-cue,
// duplicate-cta-intent, and generic-cta detection; with KR commerce guards added.
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

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

// "제목을 입력하세요" is a shipped placeholder in a heading and a perfectly good form hint in a
// <label> or a .hint span. The phrase alone cannot tell them apart, so the ancestor context does:
// anything inside a form control, or under an element whose class reads as a hint, is form UI.
const FORM_CONTEXT_TAGS = new Set(['form', 'label', 'fieldset', 'legend', 'option', 'button', 'select']);
const HINT_CLASS_RE = /\b(hint|help|helper|placeholder|guide|caption|desc|description|tip|note)\b/i;
const CODE_CLASS_RE = /\b(code|syntax|highlight|hljs|monospace|mono|kbd|pre)\b/i;
const BUTTONISH_CLASS_RE =
  /(?:^|[\s_-])(?:btn|button|cta|call-to-action|action|primary|secondary|submit|apply|purchase|buy|start|hero-cta)(?:$|[\s_-])/i;
const NON_SCROLL_ARROW_CLASS_RE = /\b(dropdown|select|accordion|collapse|carousel|swiper|menu|nav|tab|pagination)\b/i;

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
const CTA_LABEL_MAX = 60;

const CTA_INTENT_SETS = [
  { intent: 'apply', labels: ['신청하기', '지금 신청', '신청', '지원하기'] },
  { intent: 'purchase', labels: ['구매하기', '지금 구매', '결제하기', '주문하기'] },
  { intent: 'start', labels: ['시작하기', '지금 시작', '무료로 시작', '무료 체험'] },
];

const GENERIC_CTA_LABELS = new Set([
  'learn more',
  'click here',
  '더 알아보기',
  '자세히 보기',
  '신청',
  '바로가기',
]);
const SPECIFIC_CONVERSION_RE =
  /(신청|지원|구매|결제|주문|시작|체험|상담|문의|예약|가입|구독|다운로드|trial|demo|quote|consult|buy|purchase|order|book|reserve|subscribe|download|sign\s*up|get\s*started|start)/i;
const DOWN_ARROW_RE = /[↓⌄▼∨]/;
const SCROLL_CUE_MAX = 48;
const BRACKETED_SCAFFOLD_RE = /^\[[^\]]+\]$/;

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
    // Named dash entities: without these, `&mdash;` slipped past em-dash-flood while the numeric
    // `&#8212;` was caught — the same character, two verdicts.
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => entityCodePoint(n, 16))
    .replace(/&#(\d+);/g, (_, n) => entityCodePoint(n, 10));
}

const compactSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const snippet = (s, n) => compactSpace(s).slice(0, n || 180);

function stripHtmlCommentsPreserveLines(source) {
  return String(source || '').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

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

function parseAttrs(attrText) {
  const attrs = {};
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrText || ''))) {
    attrs[m[1].toLowerCase()] = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : true));
  }
  return attrs;
}

function attrsOfToken(token) {
  const m = /^<\s*[a-z][\w:-]*\b([^>]*)\/?\s*>$/i.exec(token);
  return parseAttrs(m ? m[1] : '');
}

function visibleTextNodes(html) {
  const source = stripHtmlCommentsPreserveLines(html);
  const offsets = newlineOffsets(source);
  const nodes = [];
  const stack = [];
  const tokenRe = /<\/?([a-z][\w:-]*)\b[^>]*>|([^<]+)/gi;
  let m;
  let nextId = 1;

  while ((m = tokenRe.exec(source))) {
    const tag = m[1] && m[1].toLowerCase();
    if (tag) {
      const token = m[0];
      if (/^<\//.test(token)) {
        const idx = stack.findLastIndex((e) => e.tag === tag);
        if (idx !== -1) stack.splice(idx);
      } else if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) {
        const attrs = attrsOfToken(token);
        stack.push({
          tag,
          attrs,
          cls: String(attrs.class || ''),
          id: nextId++,
          line: lineNumberAt(offsets, m.index),
        });
      }
      continue;
    }

    if (stack.some((e) => SKIP_TEXT_TAGS.has(e.tag))) continue;
    const text = compactSpace(decodeEntities(m[2]));
    if (!text) continue;
    const inFormUi =
      stack.some((e) => FORM_CONTEXT_TAGS.has(e.tag)) || stack.some((e) => HINT_CLASS_RE.test(e.cls));
    const ancestors = stack.map((e) => ({
      tag: e.tag,
      attrs: e.attrs,
      cls: e.cls,
      id: e.id,
      line: e.line,
    }));
    nodes.push({ text, line: lineNumberAt(offsets, m.index), inFormUi, ancestors });
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

function hasCodeContext(node) {
  return (node.ancestors || []).some((e) => CODE_CLASS_RE.test(e.cls));
}

function stripUrls(text) {
  return String(text || '')
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ');
}

function normalizeCtaLabel(text) {
  return compactSpace(decodeEntities(text))
    .normalize('NFKC')
    .replace(/^[\s→›»↗↓⌄▼∨]+/, '')
    .replace(/[\s→›»↗↓⌄▼∨]+$/, '')
    .trim();
}

function labelKey(text) {
  return normalizeCtaLabel(text).toLocaleLowerCase('en-US');
}

function hasRoleButton(entry) {
  return String(entry && entry.attrs && entry.attrs.role || '').toLowerCase() === 'button';
}

function isButtonishAnchor(entry) {
  return entry && entry.tag === 'a' && BUTTONISH_CLASS_RE.test(entry.cls || '');
}

function ctaAncestor(node) {
  const ancestors = node.ancestors || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const entry = ancestors[i];
    if (entry.tag === 'button' || hasRoleButton(entry) || isButtonishAnchor(entry)) return entry;
  }
  return null;
}

function inputSubmitSurfaces(html) {
  const source = stripHtmlCommentsPreserveLines(html);
  const offsets = newlineOffsets(source);
  const out = [];
  const re = /<input\b[^>]*>/gi;
  let m;

  while ((m = re.exec(source))) {
    const attrs = attrsOfToken(m[0]);
    if (String(attrs.type || '').toLowerCase() !== 'submit') continue;
    const label = normalizeCtaLabel(attrs.value || attrs['aria-label'] || attrs.title || '');
    if (!label || label.length > CTA_LABEL_MAX) continue;
    out.push({
      key: `input:${m.index}`,
      tag: 'input',
      line: lineNumberAt(offsets, m.index),
      label,
      labelKey: labelKey(label),
      cls: String(attrs.class || ''),
    });
  }

  return out;
}

function ctaSurfaces(html) {
  const byKey = new Map();

  for (const node of visibleTextNodes(html)) {
    const surface = ctaAncestor(node);
    if (!surface) continue;
    const key = `${surface.tag}:${surface.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        tag: surface.tag,
        line: surface.line || node.line,
        cls: surface.cls || '',
        parts: [],
      });
    }
    byKey.get(key).parts.push(node.text);
  }

  const surfaces = [];
  for (const surface of byKey.values()) {
    const label = normalizeCtaLabel(surface.parts.join(' '));
    if (!label || label.length > CTA_LABEL_MAX) continue;
    surfaces.push({
      key: surface.key,
      tag: surface.tag,
      line: surface.line,
      label,
      labelKey: labelKey(label),
      cls: surface.cls,
    });
  }

  surfaces.push(...inputSubmitSurfaces(html));
  return surfaces.sort((a, b) => a.line - b.line || String(a.key).localeCompare(String(b.key)));
}

// A flood, not a habit. Three em dashes spread across a long Korean interview is an editorial voice;
// three inside one paragraph, or six across the page, is the model's tic. A page-wide threshold of 3
// fired on legitimate editorial copy, so concentration decides.
const EM_DASH_PER_NODE = 3;
const EM_DASH_PER_PAGE = 6;

function detectEmDashFlood(ctx) {
  const nodes = visibleTextNodes(ctx && ctx.cleanHtml);
  const hits = [];
  let count = 0;
  let concentrated = false;

  for (const node of nodes) {
    if (hasCodeContext(node)) continue;
    if (BRACKETED_SCAFFOLD_RE.test(node.text)) continue;
    const text = stripUrls(node.text);
    const nodeCount = (text.match(/—/g) || []).length;
    if (!nodeCount) continue;
    count += nodeCount;
    if (nodeCount >= EM_DASH_PER_NODE) concentrated = true;
    hits.push({ line: node.line, count: nodeCount, snippet: snippet(text) });
  }

  if (!concentrated && count < EM_DASH_PER_PAGE) return null;
  return {
    tell: 'em-dash-flood',
    severity: 'medium',
    evidence: {
      count,
      concentrated,
      threshold: concentrated ? `${EM_DASH_PER_NODE}+ in one text node` : `${EM_DASH_PER_PAGE}+ across the page`,
      snippets: hits.slice(0, 8),
      rationale: 'visible UI copy floods em dashes; URL and code contexts excluded, named entities decoded',
    },
  };
}

function isNonScrollArrowContext(node) {
  return (node.ancestors || []).some((e) => NON_SCROLL_ARROW_CLASS_RE.test(e.cls || ''));
}

// Korean scroll cues are inflected — "스크롤하여 더 알아보기", "아래로 스크롤하세요" — so an anchored
// `^스크롤$` match misses almost every real one. But a bare stem match would fire on spec copy like
// "무한 스크롤 지원". The arrow decides: with a down arrow present, a scroll stem anywhere in the short
// node is a cue; without one, the node must BE the cue phrase and nothing else.
const SCROLL_STEM_RE = /(스크롤|아래로|\bscroll\b)/i;
const SCROLL_CUE_PHRASE_RE =
  /^(?:스크롤(?:하여|해서|하세요|해\s*주세요)?|아래로(?:\s*스크롤(?:하세요)?)?|아래로\s*내려(?:보세요)?|scroll(?:\s+down|\s+to\s+explore)?)$/i;

function scrollCueKind(text, node) {
  const raw = compactSpace(text);
  if (!raw || raw.length > SCROLL_CUE_MAX) return null;
  const hasArrow = DOWN_ARROW_RE.test(raw);
  const withoutArrows = compactSpace(raw.replace(DOWN_ARROW_RE, ''));

  // "더 보기" is a load-more button. Only an arrow turns it into a scroll affordance — and not
  // inside an accordion or carousel, where the arrow is the widget's own chevron.
  if (/^더\s*보기$/.test(withoutArrows)) {
    return hasArrow && !isNonScrollArrowContext(node) ? 'load-more-arrow-cue' : null;
  }

  if (hasArrow) {
    if (!withoutArrows) return isNonScrollArrowContext(node) ? null : 'arrow-only';
    if (SCROLL_STEM_RE.test(withoutArrows)) {
      return /\bscroll\b/i.test(withoutArrows) ? 'en-scroll-copy' : 'kr-scroll-copy';
    }
    return null;
  }

  if (SCROLL_CUE_PHRASE_RE.test(withoutArrows)) {
    return /\bscroll\b/i.test(withoutArrows) ? 'en-scroll-copy' : 'kr-scroll-copy';
  }
  return null;
}

function detectScrollCue(ctx) {
  const hits = [];
  for (const node of visibleTextNodes(ctx && ctx.cleanHtml)) {
    if (hasCodeContext(node)) continue;
    const kind = scrollCueKind(node.text, node);
    if (kind) hits.push({ kind, line: node.line, match: node.text, snippet: snippet(node.text) });
  }
  if (!hits.length) return null;
  return {
    tell: 'scroll-cue',
    severity: 'medium',
    evidence: {
      count: hits.length,
      snippets: hits.slice(0, 8),
      rationale: 'short visible microcopy labels scrolling or uses a standalone down-arrow cue; plain 더 보기 is ignored',
    },
  };
}

function detectDuplicateCtaIntent(ctx) {
  const surfaces = ctaSurfaces(ctx && ctx.cleanHtml);

  for (const set of CTA_INTENT_SETS) {
    const labels = new Set(set.labels.map(labelKey));
    const found = new Map();
    for (const surface of surfaces) {
      if (!labels.has(surface.labelKey)) continue;
      if (!found.has(surface.labelKey)) found.set(surface.labelKey, surface);
    }
    if (found.size < 2) continue;
    const examples = [...found.values()].slice(0, 4);
    return {
      tell: 'duplicate-cta-intent',
      severity: 'medium',
      evidence: {
        intent: set.intent,
        labels: examples.map((s) => s.label),
        snippets: examples.map((s) => ({ line: s.line, label: s.label, tag: s.tag })),
        rationale: 'same CTA intent appears under two or more different surface labels; repeated identical labels are ignored',
      },
    };
  }

  return null;
}

function isGenericCta(surface) {
  return GENERIC_CTA_LABELS.has(surface.labelKey);
}

function isSpecificConversionCta(surface) {
  return !isGenericCta(surface) && SPECIFIC_CONVERSION_RE.test(surface.label);
}

// Primary heuristic: without layout metrics, a generic CTA is treated as primary only when it is
// the only CTA surface, or when generic CTA surfaces dominate a page that has no specific conversion
// CTA. A specific conversion CTA anywhere on the page suppresses a neighboring/secondary "자세히 보기".
// ctaSurfaces reads text nodes, so a Korean commerce page whose real conversion button is an image
// ("무료 상담 신청하기" baked into a JPG, or carried on aria-label) looked like it had no specific CTA
// at all — and the secondary "자세히 보기" link got blamed as the primary. Read the accessible name
// of CTA-ish elements too, and let a specific one there suppress the tell.
const CTA_TAG_RE = /<(?:button|a|input)\b[^>]*>/gi;

function hasSpecificCtaInAccessibleNames(html) {
  const source = String(html || '');
  for (const m of source.matchAll(CTA_TAG_RE)) {
    const attrs = attrsOfToken(m[0].replace(/\/?>$/, '>'));
    const cls = String(attrs.class || '');
    const isCtaish =
      /^<button/i.test(m[0]) ||
      /type\s*=\s*["']?submit/i.test(m[0]) ||
      attrs.role === 'button' ||
      BUTTONISH_CLASS_RE.test(cls);
    if (!isCtaish) continue;
    for (const name of [attrs['aria-label'], attrs.value, attrs.title]) {
      if (typeof name === 'string' && SPECIFIC_CONVERSION_RE.test(name)) return true;
    }
  }
  // An <img alt="..."> sitting inside a button/link is that control's accessible name.
  for (const m of source.matchAll(/<(?:button|a)\b[^>]*>([\s\S]{0,600}?)<\/(?:button|a)>/gi)) {
    for (const img of m[1].matchAll(/<img\b[^>]*\balt\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const alt = img[2] != null ? img[2] : img[3];
      if (alt && SPECIFIC_CONVERSION_RE.test(alt)) return true;
    }
  }
  return false;
}

function detectGenericCta(ctx) {
  const html = ctx && ctx.cleanHtml;
  const surfaces = ctaSurfaces(html);
  const generic = surfaces.filter(isGenericCta);
  if (!generic.length) return null;
  if (surfaces.some(isSpecificConversionCta)) return null;
  if (hasSpecificCtaInAccessibleNames(html)) return null;

  const byLabel = new Map();
  for (const surface of generic) {
    const item = byLabel.get(surface.labelKey) || { label: surface.label, count: 0, first: surface };
    item.count += 1;
    byLabel.set(surface.labelKey, item);
  }
  const dominant = [...byLabel.values()].sort((a, b) => b.count - a.count || a.first.line - b.first.line)[0];
  const primary = surfaces.length === 1 || generic.length === surfaces.length || dominant.count >= 2;
  if (!primary) return null;

  return {
    tell: 'generic-cta',
    severity: 'medium',
    evidence: {
      label: dominant.label,
      count: dominant.count,
      snippets: generic.slice(0, 8).map((s) => ({ line: s.line, label: s.label, tag: s.tag })),
      primaryHeuristic: 'only CTA, repeated/dominant generic CTA, or all CTA surfaces generic; specific conversion CTAs suppress',
    },
  };
}

module.exports = {
  detectPlaceholderShipped,
  detectEmDashFlood,
  detectScrollCue,
  detectDuplicateCtaIntent,
  detectGenericCta,
  // exported for tests: the tiering is the contract, not an implementation detail
  UNAMBIGUOUS,
  AMBIGUOUS,
  GUIDANCE_RE,
};
