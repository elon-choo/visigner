#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  ENABLE_COMMANDS,
  detectImageCredentialsInProcess,
} = require('../cred-detect.js');
const {
  detectPlaceholderImages,
} = require('./placeholder-image-detector.js');

const CREDENTIAL_KEYS = Object.freeze(['codexOAuth', 'openaiApiKey', 'geminiApiKey']);
const KEEP_NOTE = 'or knowingly keep the SVG stand-ins';

function cleanDetail(value, fallback = 'asset-gap probe unavailable') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function safeCredentialResult(env, detector) {
  try {
    const result = detector({ env });
    if (!result || typeof result !== 'object') throw new Error('credential detector returned no report');
    return result;
  } catch (error) {
    return {
      doctorStatus: 'unavailable-safe-fallback',
      zeroNetwork: true,
      credentials: Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, {
        present: null,
        status: 'unknown',
        enableCommand: ENABLE_COMMANDS[key],
      }])),
      present: [],
      absent: [],
      missingFixes: { ...ENABLE_COMMANDS },
      preferredCredential: null,
      imageGenerationBlocked: false,
      placeholderFallback: {
        available: true,
        active: true,
        output: 'on-brand SVG placeholder',
        pageRemainsRenderable: true,
      },
      error: cleanDetail(error && error.message),
    };
  }
}

function safePlaceholderResult(pagePath, manifestPath, detector) {
  try {
    const result = detector(pagePath, { manifestPath });
    if (!result || typeof result !== 'object') throw new Error('placeholder detector returned no report');
    return result;
  } catch (error) {
    return {
      status: 'unavailable',
      zeroNetwork: true,
      page: path.resolve(pagePath || ''),
      placeholderCount: 0,
      items: [],
      manifestsScanned: [],
      unknownReferences: [],
      errors: [{ source: 'placeholder-image-detector', error: cleanDetail(error && error.message) }],
    };
  }
}

function surfaceAssetGaps(pagePath, {
  env = process.env,
  manifestPath = null,
  credentialDetector = detectImageCredentialsInProcess,
  placeholderDetector = detectPlaceholderImages,
} = {}) {
  const page = path.resolve(pagePath || '');
  const credential = safeCredentialResult(env, credentialDetector);
  const placeholders = safePlaceholderResult(page, manifestPath, placeholderDetector);
  const present = CREDENTIAL_KEYS.filter((key) => credential.credentials?.[key]?.present === true);
  const noCredential = present.length === 0;
  const placeholderCount = Number.isInteger(placeholders.placeholderCount) ? placeholders.placeholderCount : 0;
  const fixes = CREDENTIAL_KEYS
    .filter((key) => credential.credentials?.[key]?.present !== true)
    .map((key) => ENABLE_COMMANDS[key]);
  const items = noCredential && placeholderCount > 0
    ? [{
        gap: `${placeholderCount} images are placeholders because no image credential is configured`,
        fix: fixes,
        note: KEEP_NOTE,
      }]
    : [];
  const errors = [
    ...(credential.error ? [{ source: 'cred-detect', error: cleanDetail(credential.error) }] : []),
    ...((placeholders.errors || []).map((entry) => ({
      source: entry.source || 'placeholder-image-detector',
      error: cleanDetail(entry.error),
    }))),
  ];

  return {
    status: items.length
      ? 'human-action-recommended'
      : errors.length
        ? 'unavailable-safe-fallback'
        : 'no-credential-asset-gap',
    zeroNetwork: true,
    advisoryOnly: true,
    page,
    gapCount: items.length,
    items,
    placeholderCount,
    placeholderIds: (placeholders.items || []).map((item) => item.id || item.slot).filter(Boolean),
    credentialState: {
      doctorStatus: credential.doctorStatus || 'unknown',
      present,
      absent: CREDENTIAL_KEYS.filter((key) => credential.credentials?.[key]?.present === false),
      preferredCredential: credential.preferredCredential || null,
    },
    imageGenerationBlocked: false,
    placeholderFallback: {
      available: credential.placeholderFallback?.available !== false,
      active: noCredential,
      output: credential.placeholderFallback?.output || 'on-brand SVG placeholder',
      pageRemainsRenderable: credential.placeholderFallback?.pageRemainsRenderable !== false,
    },
    errors,
  };
}

function main() {
  try {
    process.stdout.write(JSON.stringify(surfaceAssetGaps(process.argv[2], {
      manifestPath: process.argv[3] || null,
    }), null, 2) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: 'unavailable-safe-fallback',
      zeroNetwork: true,
      advisoryOnly: true,
      page: process.argv[2] ? path.resolve(process.argv[2]) : null,
      gapCount: 0,
      items: [],
      placeholderCount: 0,
      placeholderIds: [],
      credentialState: { doctorStatus: 'unknown', present: [], absent: [], preferredCredential: null },
      imageGenerationBlocked: false,
      placeholderFallback: { available: true, active: true, output: 'on-brand SVG placeholder', pageRemainsRenderable: true },
      errors: [{ source: 'asset-gap-surfacer', error: cleanDetail(error && error.message) }],
    }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = {
  KEEP_NOTE,
  surfaceAssetGaps,
};
