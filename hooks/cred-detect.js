#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const IMAGE_SERVICE = path.join(PLUGIN_ROOT, 'skills', 'design-core', 'scripts', 'image-service.js');
const ENABLE_COMMANDS = Object.freeze({
  codexOAuth: 'codex login',
  openaiApiKey: 'export OPENAI_API_KEY=sk-...',
  geminiApiKey: 'export GEMINI_API_KEY=...',
});

function cleanDetail(value, fallback = 'image-service doctor unavailable') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1600);
}

function credentialRecord(label, present, enableCommand) {
  return {
    label,
    present,
    status: present === true ? 'present' : present === false ? 'absent' : 'unknown',
    enableCommand,
  };
}

function parseDoctorOutput(output) {
  const text = String(output || '');
  const oauth = text.match(/ChatGPT login[^\n]*:\s*(PRESENT|absent)\b/i);
  const openai = text.match(/OPENAI_API_KEY[^\n]*:\s*(set|not set)\b/i);
  const gemini = text.match(/GEMINI_API_KEY[^\n]*:\s*(set|not set)\b/i);
  if (!oauth || !openai || !gemini) throw new Error('image-service doctor output did not contain all credential states');
  return {
    codexOAuth: /^present$/i.test(oauth[1]),
    openaiApiKey: /^set$/i.test(openai[1]),
    geminiApiKey: /^set$/i.test(gemini[1]),
  };
}

function formatResult(states, doctorOutput, doctorStatus = 'detected', error = null) {
  const credentials = {
    codexOAuth: credentialRecord('ChatGPT/codex OAuth', states.codexOAuth, ENABLE_COMMANDS.codexOAuth),
    openaiApiKey: credentialRecord('OPENAI_API_KEY', states.openaiApiKey, ENABLE_COMMANDS.openaiApiKey),
    geminiApiKey: credentialRecord('GEMINI_API_KEY', states.geminiApiKey, ENABLE_COMMANDS.geminiApiKey),
  };
  const present = Object.entries(credentials).filter(([, value]) => value.present === true).map(([key]) => key);
  const absent = Object.entries(credentials).filter(([, value]) => value.present === false).map(([key]) => key);
  const unconfirmed = Object.entries(credentials).filter(([, value]) => value.present !== true).map(([key]) => key);
  const missingFixes = Object.fromEntries(unconfirmed.map((key) => [key, credentials[key].enableCommand]));
  const noCredential = present.length === 0;
  const preferredCredential = credentials.codexOAuth.present
    ? 'codexOAuth'
    : credentials.openaiApiKey.present
      ? 'openaiApiKey'
      : credentials.geminiApiKey.present
        ? 'geminiApiKey'
        : null;
  const lines = [
    'imageCredentialPreflight: fired',
    `doctorStatus: ${doctorStatus}`,
    `codexOAuth: ${credentials.codexOAuth.status}`,
    ...(!credentials.codexOAuth.present ? [`codexOAuthEnable: ${ENABLE_COMMANDS.codexOAuth}`] : []),
    `openaiApiKey: ${credentials.openaiApiKey.status}`,
    ...(!credentials.openaiApiKey.present ? [`openaiApiKeyEnable: ${ENABLE_COMMANDS.openaiApiKey}`] : []),
    `geminiApiKey: ${credentials.geminiApiKey.status}`,
    ...(!credentials.geminiApiKey.present ? [`geminiApiKeyEnable: ${ENABLE_COMMANDS.geminiApiKey}`] : []),
    `preferredCredential: ${preferredCredential || 'none'}`,
    'imageGenerationBlocked: false',
    `placeholderFallback: ${noCredential || doctorStatus !== 'detected' ? 'active' : 'available'}`,
    error ? `doctorError: ${error}` : null,
  ].filter(Boolean);
  const guidance = unconfirmed.map((key) => credentials[key].enableCommand).join(' | ');
  const systemMessage = doctorStatus !== 'detected'
    ? `IMAGE AUTH CHECK COULD NOT COMPLETE — credential states are unknown. Available enables: ${guidance}. ON-BRAND SVG PLACEHOLDER FALLBACK REMAINS ACTIVE; image output is not blocked.`
    : noCredential
    ? `IMAGE AUTH CHECK — no credential detected. Enable one with: ${guidance}. ON-BRAND SVG PLACEHOLDER FALLBACK REMAINS ACTIVE; image output is not blocked.`
    : `IMAGE AUTH CHECK — present: ${present.join(', ')}; missing enables: ${guidance || 'none'}. Placeholder fallback remains available; image output is not blocked.`;

  return {
    trigger: 'first-image-needing-task',
    doctorCommand: `node "${IMAGE_SERVICE}" --doctor`,
    doctorStatus,
    zeroNetwork: true,
    credentials,
    present,
    absent,
    missingFixes,
    preferredCredential,
    imageGenerationBlocked: false,
    placeholderFallback: {
      available: true,
      active: noCredential || doctorStatus !== 'detected',
      output: 'on-brand SVG placeholder',
      pageRemainsRenderable: true,
    },
    systemMessage,
    additionalContext: lines.join('\n'),
    doctorOutput,
    ...(error ? { error } : {}),
  };
}

function doctorFallback(detail, doctorOutput = '') {
  return formatResult(
    { codexOAuth: null, openaiApiKey: null, geminiApiKey: null },
    doctorOutput,
    'unavailable-safe-fallback',
    cleanDetail(detail),
  );
}

function envHasValue(env, key) {
  try {
    const value = env && env[key];
    return value !== undefined && value !== null && String(value).length > 0;
  } catch (_) {
    return false;
  }
}

function codexAuthPathForEnv(env) {
  const codexHome = envHasValue(env, 'CODEX_HOME') ? String(env.CODEX_HOME) : null;
  if (codexHome) return path.join(codexHome, 'auth.json');
  const home = envHasValue(env, 'HOME') ? String(env.HOME) : os.homedir();
  return path.join(home, '.codex', 'auth.json');
}

function hasChatGPTAuthInProcess(env) {
  try {
    const authPath = codexAuthPathForEnv(env);
    if (!fs.existsSync(authPath)) return false;
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    return Boolean(auth && auth.tokens && auth.tokens.access_token);
  } catch (_) {
    return false;
  }
}

function detectImageCredentialsInProcess({ env = process.env } = {}) {
  try {
    return {
      ...formatResult({
        codexOAuth: hasChatGPTAuthInProcess(env),
        openaiApiKey: envHasValue(env, 'OPENAI_API_KEY'),
        geminiApiKey: envHasValue(env, 'GEMINI_API_KEY'),
      }, '', 'detected'),
      detectionMode: 'in-process',
    };
  } catch (error) {
    return {
      ...doctorFallback(`in-process credential probe failed safely: ${error && error.message}`),
      detectionMode: 'in-process',
    };
  }
}

function detectImageCredentials({ env = process.env, runner = spawnSync } = {}) {
  let result;
  try {
    result = runner(process.execPath, [IMAGE_SERVICE, '--doctor'], {
      cwd: PLUGIN_ROOT,
      env: { ...env },
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    return doctorFallback(error && error.message);
  }
  const output = String(result && result.stdout || '');
  if (!result || result.error || result.status !== 0) {
    return doctorFallback(
      result && result.error && result.error.message
        ? result.error.message
        : result && (result.stderr || result.stdout)
          ? result.stderr || result.stdout
          : `image-service doctor exited ${result ? result.status : 'without a result'}`,
      output,
    );
  }
  try {
    return formatResult(parseDoctorOutput(output), output);
  } catch (error) {
    return doctorFallback(error.message, output);
  }
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(detectImageCredentials())}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(doctorFallback(error && error.message))}\n`);
  }
}

if (require.main === module) main();

module.exports = {
  ENABLE_COMMANDS,
  IMAGE_SERVICE,
  codexAuthPathForEnv,
  detectImageCredentials,
  detectImageCredentialsInProcess,
  parseDoctorOutput,
};
