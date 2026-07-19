#!/usr/bin/env node
'use strict';

// Positive recipe-conformance gate. Unlike the visual reproduction oracle, this
// module only inspects the supplied recipe and the supplied self-contained build.

const fs = require('fs');
const path = require('path');

const NEAR_RGB_DISTANCE = 18;
const SCORE_WEIGHTS = { palette: 0.42, type: 0.25, spacing: 0.18, signature: 0.15 };

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, low = 0, high = 100) {
  return Math.max(low, Math.min(high, value));
}

function markdownText(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

function tokenBlock(markdown) {
  const match = String(markdown).match(/^##\s+1\b[^\n]*\n([\s\S]*?)(?=^##\s+2\b|(?![\s\S]))/m);
  return match ? match[1] : '';
}

function markdownSubsection(block, number) {
  const escaped = number.replace('.', '\\.');
  const matcher = new RegExp(`^###\\s+${escaped}\\b[^\\n]*\\n([\\s\\S]*?)(?=^###\\s+1\\.|^##\\s+2\\b|(?![\\s\\S]))`, 'm');
  const match = String(block || '').match(matcher);
  return match ? match[1] : '';
}

function numberedBlock(markdown, number) {
  const matcher = new RegExp(`^##\\s+${number}\\b[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+${Number(number) + 1}\\b|(?![\\s\\S]))`, 'm');
  const match = String(markdown).match(matcher);
  return match ? match[1] : '';
}

function parseHexColor(value) {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((char) => char + char).join('');
  if (hex.length === 6) hex += 'ff';
  if (hex.length !== 8) return null;
  const number = Number.parseInt(hex, 16);
  return {
    hex: `#${hex}`,
    r: (number >>> 24) & 255,
    g: (number >>> 16) & 255,
    b: (number >>> 8) & 255,
    a: number & 255,
  };
}

function colorKey(color) {
  return `${color.r},${color.g},${color.b},${color.a}`;
}

function displayHex(color) {
  const hex = color.hex.slice(1);
  return color.a === 255 ? `#${hex.slice(0, 6)}` : `#${hex}`;
}

function colorDistance(left, right) {
  return Math.sqrt(((left.r - right.r) ** 2) + ((left.g - right.g) ** 2) + ((left.b - right.b) ** 2));
}

function colorImportance(line) {
  const text = markdownText(line).toLowerCase();
  if (/\b60\b/.test(text) || /\bground\b/.test(text)) return 14;
  if (/\b30\b/.test(text) || /\bpanel\b/.test(text)) return 7;
  if (/\b10\b/.test(text) || /\baccent\b/.test(text) || /\bcta\b/.test(text)) return 4;
  if (/\bprimary\b/.test(text) || /\btext\b/.test(text)) return 2;
  return 1;
}

function colorsFromText(text, { score = true } = {}) {
  const colors = new Map();
  for (const line of String(text || '').split('\n')) {
    for (const match of line.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
      const color = parseHexColor(match[0]);
      if (!color) continue;
      const key = colorKey(color);
      const current = colors.get(key);
      const importance = colorImportance(line);
      colors.set(key, {
        ...color,
        display: displayHex(color),
        importance: Math.max(current ? current.importance : 0, importance),
        sources: [...(current ? current.sources : []), markdownText(line)],
        score,
      });
    }
  }
  return [...colors.values()];
}

function parseRecipeColors(colorSection) {
  // A mechanical recipe may list a large named CSS inventory after this marker.
  // The role-labelled and computed tables before it are the values it commits a
  // builder to employ; the inventory remains visible as non-scoring evidence.
  const inventoryMarker = /^\*\*Named (?:computed )?color variables:/mi;
  const markerMatch = inventoryMarker.exec(colorSection);
  const committedText = markerMatch ? colorSection.slice(0, markerMatch.index) : colorSection;
  const inventoryText = markerMatch ? colorSection.slice(markerMatch.index) : '';
  return {
    committed: colorsFromText(committedText),
    inventory: colorsFromText(inventoryText, { score: false }),
  };
}

function parseNumber(value) {
  const parsed = Number(String(value).replace(/\*|`/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function roleName(value) {
  const lower = markdownText(value).toLowerCase();
  if (/display|hero|h1|headline/.test(lower)) return 'display';
  if (/mono|code|label/.test(lower)) return 'mono';
  if (/body|large body|statement/.test(lower)) return 'body';
  return null;
}

function typeCategory(family) {
  const value = String(family || '').toLowerCase();
  if (/(mono|code|consolas|menlo)/.test(value)) return 'mono';
  if (/(domaine|georgia|palatino|iowan|garamond|times|serif)/.test(value)) return 'serif';
  if (value) return 'sans';
  return null;
}

function parseRecipeType(typeSection) {
  const roles = new Map();
  const add = (role, family, weight, source) => {
    if (!role || !family) return;
    const parsedWeight = parseNumber(weight);
    const current = roles.get(role);
    if (!current || (parsedWeight !== null && current.weight === null)) {
      roles.set(role, {
        role,
        family: markdownText(family),
        familyLower: markdownText(family).toLowerCase(),
        category: typeCategory(family),
        weight: parsedWeight,
        source: markdownText(source),
      });
    }
  };

  for (const match of String(typeSection || '').matchAll(/\*\*(Display|Body|Mono):\*\*[^\n]*?resolvedFamily\s+`([^`]+)`;\s*fontWeight\s+`([^`]+)`/gi)) {
    add(roleName(match[1]), match[2], match[3], match[0]);
  }

  for (const line of String(typeSection || '').split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map(markdownText);
    if (cells.length < 3 || /^(role|[-: ]+)$/i.test(cells[0])) continue;
    const role = roleName(cells[0]);
    if (role) add(role, cells[1], cells[2], line);
  }

  // Recipes without a role table sometimes state the display family in prose.
  if (!roles.has('display')) {
    const match = String(typeSection || '').match(/(?:display|hero[^\n]{0,60}h1)[^\n]{0,120}?`([^`]+)`[^\n]{0,90}?(?:weight\s*`?)(\d{2,3})/i);
    if (match) add('display', match[1], match[2], match[0]);
  }
  return [...roles.values()];
}

function lengthValues(text, { allowLarge = false } = {}) {
  const values = [];
  const pattern = /(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(px|rem)\b/gi;
  for (const match of String(text || '').matchAll(pattern)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const px = match[2].toLowerCase() === 'rem' ? amount * 16 : amount;
    if (px < 0 || (!allowLarge && px > 256)) continue;
    values.push(px);
  }
  return values;
}

function addLength(map, value, weight = 1) {
  const key = String(round(value));
  map.set(key, { value: round(value), weight: Math.max(map.get(key)?.weight || 0, weight) });
}

function parseRecipeSpacing(spacingSection) {
  const values = new Map();
  for (const line of String(spacingSection || '').split('\n')) {
    const countMatch = line.match(/count\s+(\d+)/i);
    const weight = countMatch ? Math.max(1, Math.log2(Number(countMatch[1]) + 1)) : 1;
    for (const value of lengthValues(line)) addLength(values, value, weight);
    const range = line.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)px/i);
    if (range) {
      addLength(values, Number(range[1]), weight);
      addLength(values, Number(range[2]), weight);
    }
  }
  for (const codeSpan of String(spacingSection || '').matchAll(/`([^`]*\/[^`]*)`/g)) {
    for (const number of codeSpan[1].matchAll(/\b\d+(?:\.\d+)?\b/g)) {
      const value = Number(number[0]);
      if (value > 0 && value <= 256) addLength(values, value, 2);
    }
  }
  const baseMatch = String(spacingSection || '').match(/base (?:unit|scale)\s*=\s*\*?\*?(\d+(?:\.\d+)?)px/i);
  return {
    // Fractional one-off measurements are observed layout geometry, not a
    // repeatable spacing scale. Do not make them required scale tokens.
    values: [...values.values()].filter((entry) => entry.value > 0 && Number.isInteger(entry.value)),
    base: baseMatch ? Number(baseMatch[1]) : null,
  };
}

function parseRecipeRadii(radiusSection) {
  const values = new Map();
  for (const line of String(radiusSection || '').split('\n')) {
    const countMatch = line.match(/count\s+(\d+)/i);
    const weight = countMatch ? Math.max(1, Math.log2(Number(countMatch[1]) + 1)) : 1;
    for (const value of lengthValues(line, { allowLarge: true })) {
      if (value > 0 && (value <= 64 || value >= 999)) addLength(values, value, weight);
    }
  }
  return [...values.values()];
}

function signatureBlock(markdown) {
  return numberedBlock(markdown, 3);
}

function parseSignature(markdown) {
  const block = signatureBlock(markdown);
  const names = [];
  for (const match of block.matchAll(/^\s*\d+\.\s+\*\*Name:\*\*\s*(.+?)(?:\s+\[tile[^\]]*\])?\s*$/gmi)) {
    names.push(markdownText(match[1]));
  }
  return { block, names };
}

function parseRecipe(markdown) {
  const tokens = tokenBlock(markdown);
  const colorSection = markdownSubsection(tokens, '1.1');
  const typeSection = markdownSubsection(tokens, '1.2');
  const spacingSection = markdownSubsection(tokens, '1.3');
  const radiusSection = markdownSubsection(tokens, '1.4');
  return {
    colors: parseRecipeColors(colorSection),
    types: parseRecipeType(typeSection),
    spacing: parseRecipeSpacing(spacingSection),
    radii: parseRecipeRadii(radiusSection),
    signature: parseSignature(markdown),
  };
}

function extractCss(html) {
  const source = String(html || '');
  const blocks = [];
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) blocks.push(match[1]);
  for (const match of source.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) blocks.push(`.__inline__ { ${match[2]} }`);
  return blocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseCssRules(css) {
  const rules = [];
  for (const match of String(css || '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: match[1].trim(), declarations: match[2].trim() });
  }
  return rules;
}

function cssDeclarations(text) {
  const values = [];
  for (const match of String(text || '').matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    values.push({ property: match[1].toLowerCase(), value: match[2].trim() });
  }
  return values;
}

function parseCssColorValues(css) {
  const colors = new Map();
  const add = (color) => {
    const key = colorKey(color);
    if (!colors.has(key)) colors.set(key, { ...color, display: displayHex(color) });
  };
  for (const match of String(css || '').matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    const color = parseHexColor(match[0]);
    if (color) add(color);
  }
  for (const match of String(css || '').matchAll(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[ ,/]\s*(\d+(?:\.\d+)?)\s*[ ,/]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+%?))?\s*\)/gi)) {
    const alphaText = match[4];
    const alpha = alphaText === undefined ? 255 : (alphaText.endsWith('%') ? Number(alphaText.slice(0, -1)) * 2.55 : Number(alphaText) * 255);
    const color = {
      r: Math.round(Number(match[1])), g: Math.round(Number(match[2])), b: Math.round(Number(match[3])), a: Math.round(alpha),
    };
    if ([color.r, color.g, color.b, color.a].every((value) => Number.isFinite(value) && value >= 0 && value <= 255)) {
      color.hex = `#${[color.r, color.g, color.b, color.a].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      add(color);
    }
  }
  return [...colors.values()];
}

function roleRules(rules, role) {
  const selector = role === 'display'
    ? /\bh1\b|hero|display|headline/i
    : role === 'mono'
      ? /mono|code|pre|label/i
      : /\bbody\b|\bp\b|lede|copy|text/i;
  const matched = rules.filter((rule) => selector.test(rule.selector));
  const global = rules.filter((rule) => /(^|[,\s])body\b/i.test(rule.selector));
  return [...new Set([...matched, ...global])];
}

function familyScore(expected, ruleText) {
  const text = String(ruleText || '').toLowerCase();
  if (text.includes(expected.familyLower)) return { score: 100, match: 'exact' };
  const category = expected.category;
  if (!category) return { score: 0, match: 'missing' };
  const categoryPattern = category === 'serif'
    ? /(?:^|[,\s])serif(?:$|[,\s;])|georgia|palatino|iowan|garamond|times/i
    : category === 'mono'
      ? /(monospace|mono|consolas|menlo|courier)/i
      : /(sans-serif|ui-sans|system-ui|inter|helvetica|arial)/i;
  if (categoryPattern.test(text)) return { score: 50, match: `generic-${category}-fallback` };
  return { score: 0, match: 'missing' };
}

function weightScore(expected, ruleText) {
  if (expected.weight === null) return { score: 0, match: 'recipe-weight-unparsed' };
  const values = [];
  for (const match of String(ruleText || '').matchAll(/font-weight\s*:\s*(\d{2,3})/gi)) values.push(Number(match[1]));
  for (const match of String(ruleText || '').matchAll(/font\s*:\s*(?:italic\s+)?(\d{2,3})\b/gi)) values.push(Number(match[1]));
  if (values.includes(expected.weight)) return { score: 100, match: 'exact' };
  if (values.some((value) => Math.abs(value - expected.weight) <= 50)) return { score: 50, match: 'near' };
  return { score: 0, match: 'missing' };
}

function scorePalette(recipeColors, buildColors) {
  if (!recipeColors.length) {
    return { score: 0, evidence: { dimension: 'palette', status: 'unavailable', detail: 'No hex colors were parsed from the recipe TOKEN block.' } };
  }
  let total = 0;
  let employed = 0;
  const found = [];
  const missing = [];
  for (const recipeColor of recipeColors) {
    total += recipeColor.importance;
    let exact = buildColors.find((candidate) => colorKey(candidate) === colorKey(recipeColor));
    if (exact) {
      employed += recipeColor.importance;
      found.push({ recipe: recipeColor.display, match: 'exact', build: exact.display });
      continue;
    }
    let nearest = null;
    for (const candidate of buildColors) {
      if (Math.abs(candidate.a - recipeColor.a) > 32) continue;
      const distance = colorDistance(recipeColor, candidate);
      if (!nearest || distance < nearest.distance) nearest = { candidate, distance };
    }
    if (nearest && nearest.distance <= NEAR_RGB_DISTANCE) {
      employed += recipeColor.importance * 0.65;
      found.push({ recipe: recipeColor.display, match: 'near', build: nearest.candidate.display, rgbDistance: round(nearest.distance) });
    } else {
      missing.push(recipeColor.display);
    }
  }
  return {
    score: round(total ? (employed / total) * 100 : 0),
    evidence: {
      dimension: 'palette',
      status: found.length ? 'checked' : 'not-employed',
      found,
      missing,
      detail: `Scored ${recipeColors.length} role/table color commitments; near matches use RGB distance <= ${NEAR_RGB_DISTANCE} and receive partial credit.`,
    },
  };
}

function scoreType(expectedRoles, rules) {
  if (!expectedRoles.length) {
    return { score: 0, evidence: { dimension: 'type', status: 'unavailable', detail: 'No display/body/mono role could be parsed from the recipe TOKEN block.' }, displayFamilyScore: 0 };
  }
  const weights = { display: 0.6, body: 0.25, mono: 0.15 };
  const totalWeight = expectedRoles.reduce((sum, role) => sum + (weights[role.role] || 0.15), 0);
  let total = 0;
  let displayFamilyScore = 0;
  const roles = [];
  for (const expected of expectedRoles) {
    const matchedRules = roleRules(rules, expected.role);
    const text = matchedRules.map((rule) => rule.declarations).join('\n');
    const family = familyScore(expected, text);
    const weight = weightScore(expected, text);
    const score = round((family.score * 0.7) + (weight.score * 0.3));
    if (expected.role === 'display') displayFamilyScore = family.score;
    total += score * (weights[expected.role] || 0.15);
    roles.push({
      role: expected.role,
      recipeFamily: expected.family,
      recipeWeight: expected.weight,
      familyMatch: family.match,
      weightMatch: weight.match,
      score,
    });
  }
  return {
    score: round(totalWeight ? total / totalWeight : 0),
    displayFamilyScore,
    evidence: {
      dimension: 'type',
      status: 'checked',
      roles,
      detail: 'A generic serif/sans/mono substitute is recorded as a low-confidence fallback, not an exact family match.',
    },
  };
}

function cssSpacingValues(rules) {
  const values = new Set();
  const spacingProperty = /^(?:margin(?:-[\w]+)?|padding(?:-[\w]+)?|gap|row-gap|column-gap|inset(?:-[\w]+)?|top|right|bottom|left)$/;
  for (const rule of rules) {
    for (const declaration of cssDeclarations(rule.declarations)) {
      if (!spacingProperty.test(declaration.property)) continue;
      for (const value of lengthValues(declaration.value)) values.add(round(value));
    }
  }
  return [...values];
}

function cssRadiusValues(rules) {
  const values = new Set();
  let hasPercentPill = false;
  for (const rule of rules) {
    for (const declaration of cssDeclarations(rule.declarations)) {
      if (!(/^(?:border-)?radius$|^border-(?:top|bottom)-(?:left|right)-radius$/.test(declaration.property) || /^--[\w-]*radius[\w-]*$/.test(declaration.property))) continue;
      for (const value of lengthValues(declaration.value, { allowLarge: true })) values.add(round(value));
      if (/\b50%\b/.test(declaration.value)) hasPercentPill = true;
    }
  }
  return { values: [...values], hasPercentPill };
}

function lengthMatch(value, candidates) {
  if (value >= 999) return candidates.some((candidate) => candidate >= 999);
  return candidates.some((candidate) => Math.abs(candidate - value) <= 0.1);
}

function weightedLengthScore(expected, actual) {
  if (!expected.length) return { score: 0, found: [], missing: [] };
  const total = expected.reduce((sum, entry) => sum + entry.weight, 0);
  const found = [];
  const missing = [];
  let employed = 0;
  for (const entry of expected) {
    if (lengthMatch(entry.value, actual)) {
      employed += entry.weight;
      found.push(`${entry.value}px`);
    } else {
      missing.push(`${entry.value}px`);
    }
  }
  return { score: total ? (employed / total) * 100 : 0, found, missing };
}

function scoreSpacing(recipeSpacing, recipeRadii, rules) {
  const actualSpacing = cssSpacingValues(rules);
  const spacing = weightedLengthScore(recipeSpacing.values, actualSpacing);
  const actualRadii = cssRadiusValues(rules);
  const radii = weightedLengthScore(recipeRadii, actualRadii.values);
  const score = recipeRadii.length
    ? (spacing.score * 0.8) + (radii.score * 0.2)
    : spacing.score;
  return {
    score: round(score),
    evidence: {
      dimension: 'spacing',
      status: recipeSpacing.values.length ? 'checked' : 'unavailable',
      found: spacing.found,
      missing: spacing.missing,
      radius: {
        found: radii.found,
        missing: radii.missing,
        detail: 'Radius values are parsed and contribute 20% of the spacing-scale dimension because the required report has no separate radius score.',
      },
      detail: recipeSpacing.base
        ? `Recipe declares a ${recipeSpacing.base}px base; this checks literal spacing values in margin, padding, gap, inset, and positional declarations.`
        : 'This checks literal spacing values in margin, padding, gap, inset, and positional declarations.',
    },
  };
}

function classOrIdentifierPresent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:class|id)\\s*=\\s*["'][^"']*\\b${escaped}\\b`, 'i').test(html) || new RegExp(`\\.${escaped}\\b`, 'i').test(html);
}

function hasTwoColumnHero(rules) {
  return rules.some((rule) => /hero|headline|display/i.test(rule.selector) && /grid-template-columns\s*:/i.test(rule.declarations));
}

function hasPanelCluster(html) {
  const classHits = (String(html).match(/class\s*=\s*["'][^"']*\bpanel\b[^"']*["']/gi) || []).length;
  return classHits >= 3;
}

function signatureFeatures(signatureText, html, rules, displayFamilyScore) {
  const text = markdownText(signatureText).toLowerCase();
  const features = [];
  const add = (name, relevant, present) => { if (relevant) features.push({ name, present }); };
  add('hero region', /\bhero\b/.test(text), classOrIdentifierPresent(html, 'hero'));
  add('left/right split', /\bleft\b[\s\S]{0,120}\bright\b|two-column|split/.test(text), hasTwoColumnHero(rules));
  add('cube geometry', /\bcube\b|geometric (?:panel|cluster)/.test(text), classOrIdentifierPresent(html, 'cube'));
  add('panel cluster', /\bpanel(?:s)?\b|square panels/.test(text), hasPanelCluster(html));
  add('announcement/pill', /announcement|\bpill\b/.test(text), classOrIdentifierPresent(html, 'announcement') || classOrIdentifierPresent(html, 'eyebrow'));
  add('grid construction', /\bgrid\b/.test(text), /display\s*:\s*grid/i.test(rules.map((rule) => rule.declarations).join('\n')));
  add('serif display', /\bserif\b/.test(text), displayFamilyScore > 0);
  return features;
}

function scoreSignature(signature, html, rules, displayFamilyScore) {
  if (!signature.names.length) {
    return { score: 0, evidence: { dimension: 'signature', status: 'unavailable', detail: 'No named signature was parsed from the recipe.' } };
  }
  const features = signatureFeatures(signature.block, html, rules, displayFamilyScore);
  if (!features.length) {
    return {
      score: 0,
      evidence: {
        dimension: 'signature',
        status: 'low-confidence',
        names: signature.names,
        detail: 'The signature has no deterministically checkable inline-CSS/HTML anchors, so this oracle does not invent a pass.',
      },
    };
  }
  const found = features.filter((feature) => feature.present).map((feature) => feature.name);
  const missing = features.filter((feature) => !feature.present).map((feature) => feature.name);
  return {
    // Source inspection cannot prove visual composition. Keep this dimension
    // deliberately capped below a full pass even when every textual anchor is present.
    score: round((found.length / features.length) * 80),
    evidence: {
      dimension: 'signature',
      status: 'low-confidence',
      names: signature.names,
      found,
      missing,
      detail: 'Heuristic source anchors only; this does not assert visual fidelity and is capped at 80 without rendered comparison.',
    },
  };
}

function scoreConformance({ recipe, build }) {
  const parsedRecipe = typeof recipe === 'string' ? parseRecipe(recipe) : recipe;
  const html = String(build || '');
  const css = extractCss(html);
  const rules = parseCssRules(css);
  const palette = scorePalette(parsedRecipe.colors.committed, parseCssColorValues(css));
  const type = scoreType(parsedRecipe.types, rules);
  const spacing = scoreSpacing(parsedRecipe.spacing, parsedRecipe.radii, rules);
  const signature = scoreSignature(parsedRecipe.signature, html, rules, type.displayFamilyScore);
  const dimensions = {
    palette: palette.score,
    type: type.score,
    spacing: spacing.score,
    signature: signature.score,
  };
  const overall = round(Object.entries(SCORE_WEIGHTS).reduce((sum, [dimension, weight]) => sum + (dimensions[dimension] * weight), 0));
  return {
    overall,
    dimensions,
    evidence: [
      palette.evidence,
      type.evidence,
      spacing.evidence,
      signature.evidence,
      {
        dimension: 'palette-inventory',
        status: 'non-scoring',
        values: parsedRecipe.colors.inventory.map((color) => color.display),
        detail: 'Named color-inventory values were parsed but not used as conformance commitments.',
      },
    ],
  };
}

function parseArgs(argv) {
  const args = { build: null, recipe: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--build' || arg === '--recipe') {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      args[arg.slice(2)] = value;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.build || !args.recipe) {
    throw new Error('usage: node scripts/conformance-check.js --build <html> --recipe <recipe.md>');
  }
  return args;
}

function readInput(file, option, extension) {
  const absolute = path.resolve(file);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch (error) {
    throw new Error(`cannot read --${option} ${absolute}: ${error.message}`);
  }
  if (!stat.isFile()) throw new Error(`--${option} must be a file: ${absolute}`);
  if (extension && !extension.test(absolute)) throw new Error(`--${option} must be a ${extension.source} file`);
  return fs.readFileSync(absolute, 'utf8');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  return scoreConformance({
    recipe: readInput(args.recipe, 'recipe', /\.recipe\.md$|\.md$/i),
    build: readInput(args.build, 'build', /\.html?$/i),
  });
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(main(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  NEAR_RGB_DISTANCE,
  extractCss,
  main,
  parseArgs,
  parseRecipe,
  scoreConformance,
};
