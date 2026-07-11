'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_PROFILE,
  getPluginDataDir,
  normalizeProfile,
} = require('./boffin-config');

const STATE_FILE = '.boffin-active';
const INPUT_TIMEOUT_MS = 750;
const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_STATE_BYTES = 64;

function getStatePath(options = {}) {
  const dataDir = getPluginDataDir(options);
  return dataDir ? path.join(dataDir, STATE_FILE) : null;
}

function readProfile(options = {}) {
  const statePath = getStatePath(options);
  if (!statePath) return DEFAULT_PROFILE;

  try {
    const stat = fs.statSync(statePath);
    if (!stat.isFile() || stat.size > MAX_STATE_BYTES) return DEFAULT_PROFILE;
    const value = fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '');
    return normalizeProfile(value) || DEFAULT_PROFILE;
  } catch (_) {
    return DEFAULT_PROFILE;
  }
}

function setProfile(value, options = {}) {
  const profile = normalizeProfile(value);
  if (!profile) return null;

  const statePath = getStatePath(options);
  if (!statePath) return null;

  const stateDir = path.dirname(statePath);
  fs.mkdirSync(stateDir, { recursive: true });
  const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const tempPath = path.join(stateDir, `${STATE_FILE}.${suffix}.tmp`);
  let tempExists = false;

  try {
    fs.writeFileSync(tempPath, profile, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    tempExists = true;
    fs.renameSync(tempPath, statePath);
    tempExists = false;
    return profile;
  } finally {
    if (tempExists) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {
        // Best-effort cleanup after a failed atomic replacement.
      }
    }
  }
}

function detectHost(env = process.env) {
  return env.PLUGIN_ROOT || env.PLUGIN_DATA ? 'codex' : 'claude';
}

function formatHookOutput(event, profile, context, options = {}) {
  const activeProfile = normalizeProfile(profile) || DEFAULT_PROFILE;
  const additionalContext = typeof context === 'string' ? context : String(context || '');
  const hookSpecificOutput = {
    hookEventName: event,
    additionalContext,
  };

  if (detectHost(options.env || process.env) === 'codex') {
    return JSON.stringify({
      systemMessage: `BOFFIN:${activeProfile.toUpperCase()}`,
      hookSpecificOutput,
    });
  }

  if (event === 'SubagentStart') {
    return JSON.stringify({ hookSpecificOutput });
  }

  return additionalContext;
}

function writeHookOutput(event, profile, context, options = {}) {
  const output = formatHookOutput(event, profile, context, options);
  if (!output) return false;

  try {
    fs.writeSync(1, output);
    return true;
  } catch (_) {
    return false;
  }
}

function parseHookInput(value) {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value.replace(/^\uFEFF/, ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (_) {
    return {};
  }
}

function runHook(handler, options = {}) {
  const input = options.input || process.stdin;
  const timeoutMs = options.timeoutMs || INPUT_TIMEOUT_MS;
  let raw = '';
  let overflow = false;
  let done = false;
  let timer;

  function finish(forceExit = false) {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    input.removeListener('data', onData);
    input.removeListener('end', onEnd);
    input.removeListener('error', onError);
    if (typeof input.pause === 'function') input.pause();

    try {
      handler(overflow ? {} : parseHookInput(raw));
    } catch (_) {
      // Lifecycle hooks are advisory and must never block their host.
    }

    process.exitCode = 0;
    if (forceExit) process.exit(0);
  }

  function onData(chunk) {
    if (overflow) return;
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES) {
      raw = '';
      overflow = true;
    }
  }

  function onEnd() {
    finish(false);
  }

  function onError() {
    finish(true);
  }

  if (typeof input.setEncoding === 'function') input.setEncoding('utf8');
  input.on('data', onData);
  input.on('end', onEnd);
  input.on('error', onError);
  if (typeof input.resume === 'function') input.resume();

  timer = setTimeout(() => finish(true), timeoutMs);
  timer.unref();

  if (input.readableEnded) queueMicrotask(onEnd);
}

module.exports = {
  INPUT_TIMEOUT_MS,
  MAX_INPUT_BYTES,
  STATE_FILE,
  detectHost,
  formatHookOutput,
  getStatePath,
  parseHookInput,
  readProfile,
  runHook,
  setProfile,
  writeHookOutput,
};
