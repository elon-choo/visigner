'use strict';

const fs = require('fs');

const PLACEHOLDER_PATTERNS = [
  /\bplaceholder\b/gi,
  /\bskeleton\b/gi,
  /\blorem(?:\s+ipsum)?\b/gi,
  /\bslot(?:\s+ready)?\b/gi,
  /\b(?:image|photo)\s+(?:here|missing|placeholder)\b/gi,
  /(?:사진|이미지)\s*(?:대체|자리|없음)/g,
  /(?:대체\s*(?:사진|이미지)|실물\s*없음|비어\s*있|슬롯|준비\s*중)/g,
];

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : ' ';
    }
    return named[entity.toLowerCase()] || ' ';
  });
}

function attrValue(attrs, name) {
  const match = String(attrs || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function declarationValue(declarations, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(declarations).match(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;}]+)`, 'i'));
  return match ? match[1].replace(/!important/gi, '').trim() : '';
}

function zeroCssValue(value) {
  return /^[-+]?0(?:\.0+)?(?:px|rem|em|%|vh|vw|vmin|vmax)?$/i.test(String(value).trim());
}

function collapsedClipPath(value) {
  const normalized = String(value).trim().toLowerCase();
  if (/^circle\(\s*0(?:\.0+)?(?:px|rem|em|%)?(?:\s+at\s+[^)]*)?\)$/.test(normalized)) return true;
  const inset = normalized.match(/^inset\(([^)]*)\)/);
  if (!inset) return false;
  const rawValues = inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/).filter(Boolean);
  if (!rawValues.length || rawValues.some((item) => !/^[\d.]+%$/.test(item))) return false;
  const values = rawValues.map((item) => Number.parseFloat(item));
  const [top, right = top, bottom = top, left = right] = values.length === 3
    ? [values[0], values[1], values[2], values[1]]
    : values;
  return Number.isFinite(top) && Number.isFinite(right) && Number.isFinite(bottom) && Number.isFinite(left)
    && (top + bottom >= 100 || left + right >= 100);
}

// Covers common display/off-screen/clip/zero-area hiding; transforms and collapsed <details> remain for render + human review.
function declarationsHideVisually(declarations) {
  const css = String(declarations);
  if (/\bdisplay\s*:\s*none\b/i.test(css) || /\bvisibility\s*:\s*hidden\b/i.test(css)) return true;

  const opacity = Number.parseFloat(declarationValue(css, 'opacity'));
  if (Number.isFinite(opacity) && opacity === 0) return true;
  if (zeroCssValue(declarationValue(css, 'font-size'))) return true;

  const position = declarationValue(css, 'position').toLowerCase();
  const largeNegative = (value, allowUnitless = false) => {
    const match = String(value).match(/^(-[\d.]+)(px|em|rem|%|vw|vh)?$/i);
    return Boolean(match && Number(match[1]) <= -1000 && (allowUnitless || match[2]));
  };
  if (position === 'absolute' || position === 'fixed') {
    for (const offset of ['left', 'top', 'right', 'bottom']) {
      if (largeNegative(declarationValue(css, offset))) return true;
    }
  }
  if (largeNegative(declarationValue(css, 'text-indent'), true)) return true;

  const clip = declarationValue(css, 'clip').match(/^rect\(([^)]*)\)$/i);
  if (clip) {
    const values = clip[1].split(/[\s,]+/).filter(Boolean);
    if (values.length >= 4 && values.slice(0, 4).every(zeroCssValue)) return true;
  }
  if (collapsedClipPath(declarationValue(css, 'clip-path'))) return true;

  const collapsedDimension = zeroCssValue(declarationValue(css, 'height'))
    || zeroCssValue(declarationValue(css, 'width'));
  const clippedOverflow = ['overflow', 'overflow-x', 'overflow-y']
    .some((property) => declarationValue(css, property).toLowerCase() === 'hidden');
  return collapsedDimension && clippedOverflow;
}

function hiddenAttrs(attrs) {
  return /(?:^|\s)hidden(?:\s|=|$)/i.test(attrs)
    || /\baria-hidden\s*=\s*["']?true/i.test(attrs)
    || declarationsHideVisually(attrValue(attrs, 'style'));
}

function splitSelectors(selectorList) {
  const selectors = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    if (quote) {
      if (char === quote && selectorList[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

function selectorSubject(selector) {
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (quote) {
      if (char === quote && selector[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (parenDepth === 0 && bracketDepth === 0 && /[>+~]/.test(char)) start = index + 1;
    else if (parenDepth === 0 && bracketDepth === 0 && /\s/.test(char)) {
      let next = index;
      while (next + 1 < selector.length && /\s/.test(selector[next + 1])) next += 1;
      if (next + 1 < selector.length && !/[>+~]/.test(selector[next + 1])) start = next + 1;
      index = next;
    }
  }
  return selector.slice(start).trim();
}

function classDeclarations(source) {
  const rules = [];
  const css = [...String(source).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1].replace(/\/\*[\s\S]*?\*\//g, ' '))
    .join('\n');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = rule[2];
    for (const selector of splitSelectors(rule[1])) {
      const subject = selectorSubject(selector);
      if (/[:\[#]/.test(subject)) continue;
      const requiredClasses = [...new Set(
        [...subject.matchAll(/\.([a-z_][\w-]*)/gi)].map((classMatch) => classMatch[1]),
      )];
      if (requiredClasses.length) rules.push({ requiredClasses, declarations });
    }
  }
  return rules;
}

function declarationsForClasses(rules, classNames) {
  const present = new Set(classNames);
  return rules
    .filter((rule) => rule.requiredClasses.every((name) => present.has(name)))
    .map((rule) => rule.declarations)
    .join(';');
}

function visibilityFilteredSource(source, styleSource = source) {
  const input = String(source);
  const declarationRules = classDeclarations(styleSource);
  const alwaysHidden = new Set(['head', 'script', 'style', 'template', 'noscript']);
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const stack = [];
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi;
  let cursor = 0;
  let output = '';
  let match;

  while ((match = tokens.exec(input))) {
    if (!(stack.length && stack[stack.length - 1].hidden)) output += input.slice(cursor, match.index);
    const token = match[0];
    cursor = tokens.lastIndex;
    if (/^<!/i.test(token)) continue;

    const parsed = token.match(/^<\s*(\/?)\s*([a-z][\w-]*)([\s\S]*?)>$/i);
    if (!parsed) continue;
    const closing = parsed[1] === '/';
    const tag = parsed[2].toLowerCase();
    const attrs = parsed[3] || '';

    if (closing) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index].tag !== tag) index -= 1;
      const entry = index >= 0 ? stack[index] : null;
      if (index >= 0) stack.splice(index);
      if (entry && !entry.hidden) output += token;
      continue;
    }

    const parentHidden = Boolean(stack.length && stack[stack.length - 1].hidden);
    const classNames = attrValue(attrs, 'class').split(/\s+/).filter(Boolean);
    const matchedDeclarations = declarationsForClasses(declarationRules, classNames);
    const hiddenControl = tag === 'input' && attrValue(attrs, 'type').toLowerCase() === 'hidden';
    const ownHidden = alwaysHidden.has(tag)
      || hiddenAttrs(attrs)
      || hiddenControl
      || declarationsHideVisually(matchedDeclarations);
    const hidden = parentHidden || ownHidden;
    if (!hidden) output += token;

    const selfClosing = /\/\s*>$/.test(token) || voidElements.has(tag);
    if (!selfClosing) stack.push({ tag, hidden });
  }

  if (!(stack.length && stack[stack.length - 1].hidden)) output += input.slice(cursor);
  return output;
}

function textFromMarkup(source) {
  return decodeEntities(
    visibilityFilteredSource(source)
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function tinyAttrs(attrs) {
  const width = Number(attrValue(attrs, 'width'));
  const height = Number(attrValue(attrs, 'height'));
  const style = attrValue(attrs, 'style');
  const cssWidth = Number((style.match(/\bwidth\s*:\s*([\d.]+)px/i) || [])[1]);
  const cssHeight = Number((style.match(/\bheight\s*:\s*([\d.]+)px/i) || [])[1]);
  return (Number.isFinite(width) && width > 0 && width <= 4)
    || (Number.isFinite(height) && height > 0 && height <= 4)
    || (Number.isFinite(cssWidth) && cssWidth > 0 && cssWidth <= 4)
    || (Number.isFinite(cssHeight) && cssHeight > 0 && cssHeight <= 4);
}

function meaningfulMediaCount(source) {
  let count = 0;
  let match;
  const imgPattern = /<img\b([^>]*)>/gi;
  while ((match = imgPattern.exec(source))) {
    const attrs = match[1];
    if (!hiddenAttrs(attrs) && !tinyAttrs(attrs) && attrValue(attrs, 'src').trim()) count += 1;
  }
  const videoPattern = /<(?:video|source)\b([^>]*)>/gi;
  while ((match = videoPattern.exec(source))) {
    const attrs = match[1];
    if (!hiddenAttrs(attrs) && attrValue(attrs, 'src').trim()) count += 1;
  }
  const svgPattern = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi;
  while ((match = svgPattern.exec(source))) {
    const attrs = match[1];
    const primitives = (match[2].match(/<(?:path|rect|circle|ellipse|polygon|polyline|line|image|text)\b/gi) || []).length;
    if (!hiddenAttrs(attrs) && !tinyAttrs(attrs) && primitives >= 2) count += 1;
  }
  return count;
}

function emptyVisualShellCount(source, styleSource = source) {
  const declarationRules = classDeclarations(styleSource);
  let count = 0;
  for (const element of source.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = element[1].toLowerCase();
    const attrs = element[2];
    if (!['div', 'figure', 'aside', 'section', 'article'].includes(tag) || hiddenAttrs(attrs)) continue;
    const classNames = attrValue(attrs, 'class').split(/\s+/).filter(Boolean);
    const declarations = `${declarationsForClasses(declarationRules, classNames)};${attrValue(attrs, 'style')}`;
    const heights = [...declarations.matchAll(/\b(?:min-)?height\s*:\s*([\d.]+)px/gi)]
      .map((match) => Number(match[1]));
    const large = heights.some((height) => height >= 96) || /\baspect-ratio\s*:/i.test(declarations);
    const painted = /\b(?:background(?:-color|-image)?|box-shadow|border(?:-[\w-]+)?)\s*:\s*(?!none\b|transparent\b|0(?:px)?(?:\s|;|$))/i.test(declarations);
    if (large && painted) count += 1;
  }
  return count;
}

function placeholderHits(text) {
  return PLACEHOLDER_PATTERNS.reduce((total, pattern) => total + (text.match(pattern) || []).length, 0);
}

function substantiveBlockCount(source) {
  let count = 0;
  const blockPattern = /<(p|li|blockquote|figcaption|td|dd|cite)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of source.matchAll(blockPattern)) {
    if (textFromMarkup(match[2]).replace(/\s/g, '').length >= 35) count += 1;
  }
  return count;
}

function sourceMetrics(source) {
  const bodyMatch = String(source).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : String(source);
  const visibleBody = visibilityFilteredSource(body, source);
  const text = textFromMarkup(visibleBody);
  const sections = (visibleBody.match(/<(?:section|article)\b/gi) || []).length;
  const substantiveBlocks = substantiveBlockCount(visibleBody);
  const meaningfulMedia = meaningfulMediaCount(visibleBody);
  const interactiveEvidence = Math.min(3, (visibleBody.match(/<(?:button|input|select|textarea)\b/gi) || []).length);
  const emptyVisualShells = emptyVisualShellCount(visibleBody, source);
  return {
    visibleChars: text.replace(/\s/g, '').length,
    sections,
    substantiveBlocks,
    meaningfulMedia,
    interactiveEvidence,
    evidenceUnits: substantiveBlocks + meaningfulMedia + interactiveEvidence,
    placeholderHits: placeholderHits(text),
    emptyVisualShells,
  };
}

function assessTaste(source, grade) {
  const metrics = sourceMetrics(source);
  const mechanicalScore = Number(grade && grade.mechanicalScore && grade.mechanicalScore.score);
  const mechanicalLetter = grade && grade.mechanicalScore && grade.mechanicalScore.letter
    ? grade.mechanicalScore.letter
    : '?';
  const machinePassed = Boolean(grade && grade.s2Pass === true && Number.isFinite(mechanicalScore));
  const reasons = [];

  if (machinePassed) {
    if (grade.mechanicalScore && grade.mechanicalScore.incomplete === true) reasons.push('mechanical-measurement-incomplete');
    if (metrics.visibleChars < 120 && metrics.evidenceUnits < 3) reasons.push('near-empty-visible-content');
    if (
      metrics.sections >= 4
      && metrics.visibleChars < 250
      && metrics.evidenceUnits < 4
      && (metrics.meaningfulMedia === 0 || metrics.placeholderHits >= 2 || metrics.emptyVisualShells >= 2)
    ) reasons.push('thin-content-density');
    if (
      metrics.sections >= 4
      && metrics.placeholderHits >= 2
      && metrics.emptyVisualShells >= 2
      && metrics.evidenceUnits < 8
    ) reasons.push('placeholder-dominant-shell');
    if (metrics.emptyVisualShells >= 3 && metrics.meaningfulMedia === 0 && metrics.evidenceUnits < 4) {
      reasons.push('empty-visual-shells');
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  const tasteSuspect = machinePassed && uniqueReasons.length > 0;
  return {
    machinePassed,
    tasteSuspect,
    humanGateRequired: tasteSuspect,
    tasteSignals: uniqueReasons,
    tasteCaveat: tasteSuspect
      ? `Machine lint passed, but ${uniqueReasons.join(', ')} suggests a machine-passed-but-taste-suspect page. Human visual review is required; ${mechanicalScore}/${mechanicalLetter} is not taste approval.`
      : 'No empty/placeholder-dominance signal was found; machine score still does not replace human taste review.',
    tasteMetrics: metrics,
  };
}

function assessTasteFile(target, grade) {
  try {
    return assessTaste(fs.readFileSync(target, 'utf8'), grade);
  } catch (error) {
    return {
      machinePassed: false,
      tasteSuspect: false,
      humanGateRequired: false,
      tasteSignals: ['taste-analysis-unavailable'],
      tasteCaveat: `Taste analysis unavailable: ${error.message}`,
      tasteMetrics: null,
    };
  }
}

module.exports = { assessTaste, assessTasteFile, sourceMetrics };
