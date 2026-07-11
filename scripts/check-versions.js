#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'VERSION');

const VERSION_SOURCES = [
  {
    file: 'package.json',
    readVersion(manifest) {
      return manifest.version;
    },
  },
  {
    file: 'gemini-extension.json',
    readVersion(manifest) {
      return manifest.version;
    },
  },
  {
    file: '.claude-plugin/plugin.json',
    readVersion(manifest) {
      return manifest.version;
    },
  },
  {
    file: '.claude-plugin/marketplace.json',
    readVersion(manifest) {
      return manifest.plugins?.[0]?.version;
    },
  },
  {
    file: '.codex-plugin/plugin.json',
    readVersion(manifest) {
      return manifest.version;
    },
  },
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
}

function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(readText(filePath));
}

function main() {
  const expectedVersion = readText(VERSION_FILE);
  const errors = [];

  if (!expectedVersion) {
    errors.push('VERSION must be a non-empty semver string');
  }

  for (const source of VERSION_SOURCES) {
    const actualVersion = source.readVersion(readJson(source.file));
    if (typeof actualVersion !== 'string' || actualVersion.trim() === '') {
      errors.push(`${source.file} is missing a version field`);
      continue;
    }
    if (actualVersion !== expectedVersion) {
      errors.push(
        `${source.file} version ${actualVersion} does not match VERSION ${expectedVersion}`,
      );
    }
  }

  if (errors.length > 0) {
    process.stderr.write('Version alignment check failed:\n');
    for (const error of errors) {
      process.stderr.write(`  - ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`OK: all release surfaces match VERSION ${expectedVersion}.\n`);
}

main();
