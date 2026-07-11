'use strict';

const os = require('node:os');
const path = require('node:path');

const DEFAULT_PROFILE = 'full';
const PROFILES = Object.freeze(['lite', 'full', 'max']);
const PROFILE_SET = new Set(PROFILES);
const PROFILE_COMMAND = /^\/(?:boffin|boffin:boffin)(?:[ \t]+(lite|full|max))?$/i;

function normalizeProfile(value) {
  if (typeof value !== 'string') return null;
  const profile = value.trim().toLowerCase();
  return PROFILE_SET.has(profile) ? profile : null;
}

function parseProfileCommand(value) {
  if (typeof value !== 'string') return null;
  const command = value.replace(/^\uFEFF/, '').trim();
  const match = PROFILE_COMMAND.exec(command);
  if (!match) return null;

  const profile = normalizeProfile(match[1]);
  return profile
    ? { kind: 'set', profile }
    : { kind: 'report' };
}

function nonEmptyPath(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getPluginRoot(options = {}) {
  const env = options.env || process.env;
  return nonEmptyPath(env.PLUGIN_ROOT)
    || nonEmptyPath(env.CLAUDE_PLUGIN_ROOT)
    || path.resolve(__dirname, '..');
}

function getPluginDataDir(options = {}) {
  const env = options.env || process.env;
  const pluginData = nonEmptyPath(env.PLUGIN_DATA)
    || nonEmptyPath(env.CLAUDE_PLUGIN_DATA);
  if (pluginData) return pluginData;

  // Installed plugins must never write into their immutable install root or
  // silently substitute a user-level location for the host's writable data.
  if (nonEmptyPath(env.PLUGIN_ROOT) || nonEmptyPath(env.CLAUDE_PLUGIN_ROOT)) {
    return null;
  }

  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();
  if (platform === 'win32') {
    const base = nonEmptyPath(env.LOCALAPPDATA)
      || nonEmptyPath(env.APPDATA)
      || path.join(homeDir, 'AppData', 'Local');
    return path.join(base, 'Boffin');
  }
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Boffin');
  }

  const base = nonEmptyPath(env.XDG_STATE_HOME)
    || path.join(homeDir, '.local', 'state');
  return path.join(base, 'boffin');
}

module.exports = {
  DEFAULT_PROFILE,
  PROFILES,
  getPluginDataDir,
  getPluginRoot,
  normalizeProfile,
  parseProfileCommand,
};
