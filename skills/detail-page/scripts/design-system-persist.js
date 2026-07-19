'use strict';

// Persist a small, explicit design-system contract that can be reused across
// sessions and selectively overridden by individual pages.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DESIGN_SYSTEMS_DIR = path.join(__dirname, '..', 'references', 'design-systems');
const MASTER_KEYS = Object.freeze(['palette', 'type-pairing', 'spacing-scale', 'signature-element']);
const MASTER_FLAG_KEYS = Object.freeze({
  '--palette': 'palette',
  '--type-pairing': 'type-pairing',
  '--spacing-scale': 'spacing-scale',
  '--signature-element': 'signature-element',
});
const JSON_KEY_ALIASES = Object.freeze({
  palette: 'palette',
  typePairing: 'type-pairing',
  'type-pairing': 'type-pairing',
  spacingScale: 'spacing-scale',
  'spacing-scale': 'spacing-scale',
  signatureElement: 'signature-element',
  'signature-element': 'signature-element',
});

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InputError(`${label} must be a non-empty string.`);
  }
  if (/\u0000/u.test(value)) {
    throw new InputError(`${label} must not contain a null byte.`);
  }
  return value.trim();
}

function validateSegment(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new InputError(`Invalid ${label}: value must not be empty.`);
  }
  if (/\u0000|[\u0001-\u001F\u007F]/u.test(value)) {
    throw new InputError(`Invalid ${label} ${JSON.stringify(value)}: control characters are not allowed.`);
  }
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new InputError(`Invalid ${label} ${JSON.stringify(value)}: absolute paths are not allowed.`);
  }
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new InputError(`Invalid ${label} ${JSON.stringify(value)}: path separators and traversal are not allowed.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new InputError(`Invalid ${label} ${JSON.stringify(value)}: use lowercase letters, numbers, and single hyphens only.`);
  }
  return value;
}

function masterKeyFor(value) {
  const key = JSON_KEY_ALIASES[value];
  if (!key) {
    throw new InputError(`Invalid MASTER override key ${JSON.stringify(value)}. Allowed keys: ${MASTER_KEYS.join(', ')}.`);
  }
  return key;
}

function normalizeMaster(source) {
  const master = {};
  for (const [sourceKey, value] of Object.entries(source || {})) {
    const key = JSON_KEY_ALIASES[sourceKey];
    if (key) master[key] = value;
  }

  for (const key of MASTER_KEYS) {
    master[key] = requiredText(master[key], `MASTER ${key}`);
  }
  return master;
}

function normalizeOverrides(source) {
  if (!isPlainObject(source)) {
    throw new InputError('page.overrides must be a JSON object with one or more MASTER keys.');
  }
  const overrides = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = masterKeyFor(rawKey);
    overrides[key] = requiredText(rawValue, `override ${key}`);
  }
  if (!Object.keys(overrides).length) {
    throw new InputError('page.overrides must name at least one MASTER key.');
  }
  return overrides;
}

function normalizeConfig(config) {
  if (!isPlainObject(config)) throw new InputError('Design-system input must be a JSON object.');

  const slug = validateSegment(config.slug, 'slug');
  const masterSource = isPlainObject(config.master) ? config.master : config;
  const masterProvided = Object.keys(masterSource || {})
    .some((key) => JSON_KEY_ALIASES[key] !== undefined && masterSource[key] !== undefined);
  const hasPage = config.page !== undefined && config.page !== null;
  // Page-only mode: keep an existing MASTER untouched and only add a page.
  // Triggered explicitly (--page-only) or implicitly when a page is given
  // without any master values.
  const pageOnly = config.pageOnly === true || (hasPage && !masterProvided);
  const force = config.force === true;

  if (pageOnly && !hasPage) {
    throw new InputError('page-only persist requires page name and overrides.');
  }
  const master = pageOnly ? null : normalizeMaster(masterSource);

  if (!hasPage) {
    return { slug, master, page: null, force, pageOnly: false };
  }
  if (!isPlainObject(config.page)) {
    throw new InputError('page must be an object with name and overrides.');
  }

  return {
    slug,
    master,
    page: {
      name: validateSegment(config.page.name, 'page name'),
      overrides: normalizeOverrides(config.page.overrides),
    },
    force,
    pageOnly,
  };
}

function renderMaster(slug, master) {
  return [
    `# Design system MASTER: ${slug}`,
    '',
    '> This file is the locked global contract for this design system. Page files may only change keys listed in their `master_overrides` header.',
    '',
    '## Locked global tokens',
    '',
    ...MASTER_KEYS.map((key) => `- **${key}:** ${master[key]}`),
    '',
  ].join('\n');
}

function renderPage(page, overrides) {
  const overrideKeys = Object.keys(overrides).sort((left, right) => MASTER_KEYS.indexOf(left) - MASTER_KEYS.indexOf(right));
  return [
    '---',
    'master: ../MASTER.md',
    'master_overrides:',
    ...overrideKeys.map((key) => `  - ${key}`),
    '---',
    '',
    `# Page override: ${page}`,
    '',
    '> The header above is the complete list of MASTER keys this page overrides. Every other MASTER key remains locked.',
    '',
    '## Override values',
    '',
    ...overrideKeys.map((key) => `### ${key}\n\n${overrides[key]}\n`),
  ].join('\n');
}

function existingSkip(paths) {
  if (fs.existsSync(paths.masterPath)) {
    return `SKIP: MASTER already exists at ${paths.masterPath}; re-run with --force to overwrite it.`;
  }
  if (paths.pagePath && fs.existsSync(paths.pagePath)) {
    return `SKIP: page override already exists at ${paths.pagePath}; re-run with --force to overwrite it.`;
  }
  return null;
}

function persistDesignSystem(config, designSystemsDir = DEFAULT_DESIGN_SYSTEMS_DIR) {
  const normalized = normalizeConfig(config);
  const systemDir = path.join(designSystemsDir, normalized.slug);
  const masterPath = path.join(systemDir, 'MASTER.md');
  const pagePath = normalized.page ? path.join(systemDir, 'pages', `${normalized.page.name}.md`) : null;
  const paths = { systemDir, masterPath, pagePath };

  if (normalized.pageOnly) {
    if (!fs.existsSync(masterPath)) {
      throw new InputError(`page-only persist requires an existing MASTER at ${masterPath}; provide master values to create it.`);
    }
    if (!normalized.force && fs.existsSync(pagePath)) {
      return { status: 'skipped', message: `SKIP: page override already exists at ${pagePath}; re-run with --force to overwrite it.`, paths };
    }
    const pageOnlyExisted = fs.existsSync(pagePath);
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, renderPage(normalized.page.name, normalized.page.overrides), 'utf8');
    return {
      status: 'written',
      message: [
        `KEPT MASTER: ${masterPath}`,
        `${pageOnlyExisted ? 'OVERWROTE' : 'CREATED'} PAGE: ${pagePath}`,
      ].join('\n'),
      paths,
    };
  }

  const skip = !normalized.force && existingSkip(paths);

  if (skip) {
    return { status: 'skipped', message: skip, paths };
  }

  const masterExisted = fs.existsSync(masterPath);
  const pageExisted = pagePath ? fs.existsSync(pagePath) : false;
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(masterPath, renderMaster(normalized.slug, normalized.master), 'utf8');
  if (pagePath) {
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, renderPage(normalized.page.name, normalized.page.overrides), 'utf8');
  }

  const messages = [
    `${masterExisted ? 'OVERWROTE' : 'CREATED'} MASTER: ${masterPath}`,
  ];
  if (pagePath) messages.push(`${pageExisted ? 'OVERWROTE' : 'CREATED'} PAGE: ${pagePath}`);
  return { status: 'written', message: messages.join('\n'), paths };
}

function parseOverride(argument) {
  const separator = argument.indexOf('=');
  if (separator < 1) {
    throw new InputError('--override must use key=value (for example, --override palette="night palette").');
  }
  return {
    key: masterKeyFor(argument.slice(0, separator)),
    value: argument.slice(separator + 1),
  };
}

function valueAfter(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new InputError(`${flag} requires a value.`);
  }
  return value;
}

function readJsonInput(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new InputError(`Could not read JSON input ${filePath}: ${error.message}`);
  }
  if (!isPlainObject(parsed)) throw new InputError('JSON input must be an object.');
  return parsed;
}

function parseCli(argv) {
  const flags = { master: {}, overrides: {}, force: false, pageOnly: false };
  let inputPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--force') {
      flags.force = true;
    } else if (flag === '--page-only') {
      flags.pageOnly = true;
    } else if (flag === '--help' || flag === '-h') {
      return { help: true };
    } else if (flag === '--slug' || flag === '--page' || flag === '--input') {
      const value = valueAfter(argv, index, flag);
      index += 1;
      if (flag === '--slug') flags.slug = value;
      if (flag === '--page') flags.page = value;
      if (flag === '--input') inputPath = value;
    } else if (Object.prototype.hasOwnProperty.call(MASTER_FLAG_KEYS, flag)) {
      flags.master[MASTER_FLAG_KEYS[flag]] = valueAfter(argv, index, flag);
      index += 1;
    } else if (flag === '--override') {
      const override = parseOverride(valueAfter(argv, index, flag));
      flags.overrides[override.key] = override.value;
      index += 1;
    } else {
      throw new InputError(`Unknown argument ${JSON.stringify(flag)}. Use --help for usage.`);
    }
  }

  const input = inputPath ? readJsonInput(inputPath) : {};
  const inputMaster = isPlainObject(input.master) ? input.master : input;
  const inputPage = isPlainObject(input.page) ? input.page : null;
  const pageName = flags.page === undefined ? inputPage && inputPage.name : flags.page;
  const inputOverrides = inputPage ? inputPage.overrides : undefined;
  const overrides = Object.keys(flags.overrides).length
    ? { ...(isPlainObject(inputOverrides) ? inputOverrides : {}), ...flags.overrides }
    : inputOverrides;

  return {
    slug: flags.slug === undefined ? input.slug : flags.slug,
    master: { ...inputMaster, ...flags.master },
    page: pageName === undefined || pageName === null ? null : { name: pageName, overrides },
    force: flags.force,
    pageOnly: flags.pageOnly || input.pageOnly === true,
  };
}

function usage() {
  return [
    'Usage:',
    '  node design-system-persist.js --slug <slug> --palette <value> --type-pairing <value> --spacing-scale <value> --signature-element <value> [--page <page> --override <MASTER-key=value>] [--force]',
    '  node design-system-persist.js --slug <slug> --page <page> --override <MASTER-key=value> [--page-only]   (existing MASTER is kept as-is)',
    '  node design-system-persist.js --input <design-system.json> [--force]',
    '',
    'JSON shape: { "slug": "...", "master": { "palette": "...", "typePairing": "...", "spacingScale": "...", "signatureElement": "..." }, "page": { "name": "...", "overrides": { "palette": "..." } } }',
  ].join('\n');
}

function runCli(argv = process.argv.slice(2)) {
  try {
    const config = parseCli(argv);
    if (config.help) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    const result = persistDesignSystem(config);
    process.stdout.write(`${result.message}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`ERROR: ${message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  DEFAULT_DESIGN_SYSTEMS_DIR,
  MASTER_KEYS,
  InputError,
  parseCli,
  persistDesignSystem,
  renderMaster,
  renderPage,
  runCli,
  validateSegment,
};
