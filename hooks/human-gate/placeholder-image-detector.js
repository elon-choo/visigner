#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ENABLE_COMMANDS } = require('../cred-detect.js');

const CHANNELS = Object.freeze({
  MANIFEST: 'manifest-placeholder',
  HTML: 'html-marker',
  REFERENCED_SVG: 'referenced-svg-marker',
});
const CHANNEL_PRIORITY = Object.freeze({
  [CHANNELS.MANIFEST]: 1,
  [CHANNELS.HTML]: 2,
  [CHANNELS.REFERENCED_SVG]: 3,
});

function cleanDetail(value, fallback = 'unknown read error') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function attrValue(attrs, name) {
  const escaped = name.replace(/[.*+?^$()|[\]{}]/g, '\\$&');
  const match = String(attrs || '').match(new RegExp('(?:^|\\s)' + escaped + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function hasPlaceholderDataAttribute(attrs) {
  for (const match of String(attrs || '').matchAll(/\bdata-(?:visigner-)?placeholder(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? 'true').trim();
    if (/^(?:true|1|yes|placeholder)$/i.test(value)) return true;
  }
  return false;
}

function svgHasGenAssetsMarker(svg) {
  const source = String(svg || '');
  const root = source.match(/<svg\b([^>]*)>/i);
  if (!root) return false;
  const attrs = root[1];
  const aria = attrValue(attrs, 'aria-label');
  if (/\bplaceholder\b/i.test(aria)) return true;
  return /^img$/i.test(attrValue(attrs, 'role')) && /·\s*placeholder\b/i.test(source);
}

function localSourcePath(pageDir, src) {
  const raw = String(src || '').trim();
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) return null;
  const clean = raw.split(/[?#]/)[0];
  if (!clean) return null;
  try {
    return path.resolve(pageDir, decodeURIComponent(clean));
  } catch (_) {
    return path.resolve(pageDir, clean);
  }
}

function fileIdentity(file) {
  return file ? 'file:' + path.resolve(file) : null;
}

function idFrom({ id, slot, file, src, role }, fallback = 'unnamed-image') {
  return String(id || slot || (file && path.basename(file, path.extname(file))) || (src && path.basename(src, path.extname(src))) || role || fallback);
}

function fixFor(id) {
  return 'supply a real image for ' + id + '; or run: ' + ENABLE_COMMANDS.codexOAuth;
}

function manifestFilePath(rawFile, manifestDir, pageDir) {
  if (!rawFile) return null;
  if (path.isAbsolute(rawFile)) return rawFile;
  const candidates = [
    path.resolve(manifestDir, rawFile),
    path.resolve(pageDir, rawFile),
    path.resolve(process.cwd(), rawFile),
    path.join(manifestDir, path.basename(rawFile)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function detectPlaceholderImages(pagePath, { manifestPath = null } = {}) {
  const page = path.resolve(pagePath || '');
  const pageDir = path.dirname(page);
  const findings = [];
  const identities = [];
  const errors = [];
  const unknownReferences = [];
  const manifestsScanned = [];
  let html;
  try {
    html = fs.readFileSync(page, 'utf8');
  } catch (error) {
    return {
      status: 'unavailable',
      zeroNetwork: true,
      page,
      placeholderCount: 0,
      items: [],
      manifestsScanned,
      unknownReferences,
      errors: [{ source: page, error: cleanDetail(error && error.message) }],
    };
  }

  function addFinding(candidate, channel) {
    const id = idFrom(candidate);
    const keys = new Set([
      fileIdentity(candidate.file),
      id ? 'id:' + id : null,
      candidate.src ? 'src:' + candidate.src : null,
    ].filter(Boolean));
    let index = identities.findIndex((known) => [...keys].some((key) => known.has(key)));
    if (index === -1) {
      index = findings.length;
      identities.push(keys);
      const fix = fixFor(id);
      findings.push({
        id,
        slot: candidate.slot || id,
        role: candidate.role || null,
        src: candidate.src || null,
        file: candidate.file ? path.resolve(candidate.file) : null,
        sourceChannel: channel,
        'source-channel': channel,
        sourceChannels: [channel],
        fix,
        'concrete-fix': fix,
        enableCommand: ENABLE_COMMANDS.codexOAuth,
      });
      return;
    }
    const item = findings[index];
    for (const key of keys) identities[index].add(key);
    if (!item.sourceChannels.includes(channel)) item.sourceChannels.push(channel);
    if (CHANNEL_PRIORITY[channel] > CHANNEL_PRIORITY[item.sourceChannel]) {
      item.sourceChannel = channel;
      item['source-channel'] = channel;
    }
    if (!item.role && candidate.role) item.role = candidate.role;
    if (!item.src && candidate.src) item.src = candidate.src;
    if (!item.file && candidate.file) item.file = path.resolve(candidate.file);
    if ((!item.slot || item.slot === item.id) && candidate.slot) item.slot = candidate.slot;
  }

  const referencedDirs = new Set();
  function scanReferencedSvg({ src, id, slot, role }) {
    const file = localSourcePath(pageDir, src);
    if (!file || path.extname(file).toLowerCase() !== '.svg') return;
    referencedDirs.add(path.dirname(file));
    try {
      const svg = fs.readFileSync(file, 'utf8');
      if (svgHasGenAssetsMarker(svg)) {
        addFinding({ id: id || idFrom({ file, src, role }), slot, role, src, file }, CHANNELS.REFERENCED_SVG);
      }
    } catch (error) {
      unknownReferences.push({ src, file, status: 'unknown', error: cleanDetail(error && error.message) });
    }
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = attrValue(attrs, 'src');
    const file = localSourcePath(pageDir, src);
    const role = attrValue(attrs, 'alt') || null;
    const id = attrValue(attrs, 'data-slot') || attrValue(attrs, 'id') || idFrom({ file, src, role });
    if (hasPlaceholderDataAttribute(attrs)) {
      addFinding({ id, slot: attrValue(attrs, 'data-slot') || id, role, src, file }, CHANNELS.HTML);
    }
    scanReferencedSvg({ src, id, slot: attrValue(attrs, 'data-slot') || id, role });
  }

  for (const match of html.matchAll(/<object\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = attrValue(attrs, 'data');
    const role = attrValue(attrs, 'aria-label') || attrValue(attrs, 'title') || null;
    const id = attrValue(attrs, 'data-slot') || attrValue(attrs, 'id') || idFrom({ src, role });
    scanReferencedSvg({ src, id, slot: attrValue(attrs, 'data-slot') || id, role });
  }

  for (const match of html.matchAll(/<source\b([^>]*)>/gi)) {
    const attrs = match[1];
    const role = attrValue(attrs, 'aria-label') || null;
    const baseId = attrValue(attrs, 'data-slot') || attrValue(attrs, 'id') || null;
    for (const candidate of attrValue(attrs, 'srcset').split(',')) {
      const src = candidate.trim().split(/\s+/)[0];
      if (!src) continue;
      const id = baseId || idFrom({ src, role });
      scanReferencedSvg({ src, id, slot: baseId || id, role });
    }
  }

  for (const match of html.matchAll(/background-image\s*:\s*url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/gi)) {
    const src = match[1] ?? match[2] ?? match[3] ?? '';
    const id = idFrom({ src });
    scanReferencedSvg({ src, id, slot: id, role: 'CSS background image' });
  }

  let inlineIndex = 0;
  for (const match of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi)) {
    inlineIndex += 1;
    const attrs = match[1];
    const source = '<svg' + attrs + '>' + match[2] + '</svg>';
    if (!svgHasGenAssetsMarker(source) && !hasPlaceholderDataAttribute(attrs)) continue;
    const role = attrValue(attrs, 'aria-label') || null;
    const id = attrValue(attrs, 'data-slot') || attrValue(attrs, 'id') || 'inline-svg-' + inlineIndex;
    addFinding({ id, slot: attrValue(attrs, 'data-slot') || id, role, src: '#inline-svg-' + inlineIndex }, CHANNELS.HTML);
  }

  for (const svgMatch of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi)) {
    const svgAttrs = svgMatch[1];
    const role = attrValue(svgAttrs, 'aria-label') || null;
    for (const refMatch of svgMatch[2].matchAll(/<(?:use|image)\b([^>]*)>/gi)) {
      const refAttrs = refMatch[1];
      const src = attrValue(refAttrs, 'href') || attrValue(refAttrs, 'xlink:href');
      if (!src) continue;
      const id = attrValue(refAttrs, 'data-slot')
        || attrValue(svgAttrs, 'data-slot')
        || idFrom({ src, role });
      scanReferencedSvg({ src, id, slot: id, role });
    }
  }

  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    if (tag === 'img' || tag === 'svg' || !hasPlaceholderDataAttribute(attrs)) continue;
    const id = attrValue(attrs, 'data-slot') || attrValue(attrs, 'id') || 'html-marker-' + findings.length;
    addFinding({ id, slot: attrValue(attrs, 'data-slot') || id, role: attrValue(attrs, 'aria-label') || null }, CHANNELS.HTML);
  }

  const manifestCandidates = new Set();
  if (manifestPath) manifestCandidates.add(path.resolve(pageDir, manifestPath));
  manifestCandidates.add(path.join(pageDir, 'manifest.json'));
  manifestCandidates.add(path.join(pageDir, 'assets', 'manifest.json'));
  for (const dir of referencedDirs) manifestCandidates.add(path.join(dir, 'manifest.json'));

  for (const candidate of manifestCandidates) {
    if (!fs.existsSync(candidate)) {
      if (manifestPath && candidate === path.resolve(pageDir, manifestPath)) {
        errors.push({ source: candidate, error: 'optional manifest is missing' });
      }
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      manifestsScanned.push(candidate);
      const slots = Array.isArray(manifest.slots) ? manifest.slots : [];
      for (const slot of slots) {
        if (!slot || slot.placeholder !== true) continue;
        const file = manifestFilePath(slot.file, path.dirname(candidate), pageDir);
        const id = idFrom({ id: slot.id, slot: slot.slot, file, role: slot.role });
        addFinding({
          id,
          slot: slot.slot || slot.id || id,
          role: slot.role || slot.label || null,
          file,
          src: null,
        }, CHANNELS.MANIFEST);
      }
    } catch (error) {
      errors.push({ source: candidate, error: cleanDetail(error && error.message) });
    }
  }

  for (const item of findings) {
    item.sourceChannels.sort((a, b) => CHANNEL_PRIORITY[b] - CHANNEL_PRIORITY[a]);
  }
  return {
    status: errors.length || unknownReferences.length ? 'partial' : 'detected',
    zeroNetwork: true,
    page,
    placeholderCount: findings.length,
    items: findings,
    manifestsScanned,
    unknownReferences,
    errors,
  };
}

function main() {
  try {
    const report = detectPlaceholderImages(process.argv[2], { manifestPath: process.argv[3] || null });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: 'unavailable',
      zeroNetwork: true,
      page: process.argv[2] ? path.resolve(process.argv[2]) : null,
      placeholderCount: 0,
      items: [],
      manifestsScanned: [],
      unknownReferences: [],
      errors: [{ source: 'detector', error: cleanDetail(error && error.message) }],
    }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = {
  CHANNELS,
  detectPlaceholderImages,
  svgHasGenAssetsMarker,
};
