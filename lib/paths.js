'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const RULE_FILENAMES = Object.freeze([
  'boffin-pack-routing.mdc',
  'boffin-post-change-audit.mdc',
  'boffin-python-routing.mdc',
  'boffin-cpp-routing.mdc',
]);

const MANIFEST_PATH = '.boffin/install-manifest.json';
const VERSION_PATH = '.boffin/VERSION';

function isMissing(error) {
  return error && error.code === 'ENOENT';
}

async function findRepoRoot(startDirectory = process.cwd()) {
  const start = path.resolve(startDirectory);
  let current = start;

  while (true) {
    try {
      await fs.lstat(path.join(current, '.git'));
      return current;
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return start;
    }
    current = parent;
  }
}

async function resolveTarget(target, cwd = process.cwd()) {
  return target === undefined
    ? findRepoRoot(cwd)
    : path.resolve(cwd, target);
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function isAllowedManagedPath(value) {
  if (value === MANIFEST_PATH || value === VERSION_PATH) {
    return true;
  }

  if (value.startsWith('.boffin/packs/')) {
    return value.length > '.boffin/packs/'.length;
  }

  const rulePrefix = '.cursor/rules/';
  return value.startsWith(rulePrefix)
    && RULE_FILENAMES.includes(value.slice(rulePrefix.length));
}

function validateManagedPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('manifest managedFiles entries must be non-empty strings');
  }
  if (value.includes('\\') || path.posix.isAbsolute(value)) {
    throw new Error(`manifest contains a non-POSIX managed path: ${value}`);
  }
  if (path.posix.normalize(value) !== value) {
    throw new Error(`manifest contains a non-normalized managed path: ${value}`);
  }
  if (!isAllowedManagedPath(value)) {
    throw new Error(`manifest contains an unmanaged path: ${value}`);
  }
  return value;
}

function managedPathToAbsolute(target, managedPath) {
  validateManagedPath(managedPath);
  return path.join(path.resolve(target), ...managedPath.split('/'));
}

module.exports = {
  MANIFEST_PATH,
  RULE_FILENAMES,
  VERSION_PATH,
  findRepoRoot,
  isAllowedManagedPath,
  managedPathToAbsolute,
  resolveTarget,
  toPosixPath,
  validateManagedPath,
};
