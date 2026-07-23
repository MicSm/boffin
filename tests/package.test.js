'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const EXPECTED_FILES = [
  'bin/',
  'lib/',
  'packs/',
  'hooks/',
  'skills/',
  'AGENTS.md',
  'CREDITS',
  'VERSION',
  'LICENSE',
  '.cursor/rules/boffin-pack-routing.mdc',
  '.cursor/rules/boffin-post-change-audit.mdc',
  '.cursor/rules/boffin-python-routing.mdc',
  '.cursor/rules/boffin-cpp-routing.mdc',
];

test('package metadata exposes the frozen dependency-free CLI contract', async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  );

  assert.equal(packageJson.name, 'boffinit');
  assert.equal(packageJson.version, '0.3.1');
  assert.equal(packageJson.type, 'commonjs');
  assert.equal(packageJson.engines.node, '>=18');
  assert.deepEqual(packageJson.bin, { boffinit: 'bin/boffinit.js' });
  assert.deepEqual(packageJson.files, EXPECTED_FILES);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
});

test('npm tarball includes installer material and excludes marketplace manifests', () => {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', 'npm pack --dry-run --json']
    : ['pack', '--dry-run', '--json'];
  const result = spawnSync(
    command,
    args,
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    },
  );

  assert.equal(
    result.status,
    0,
    `npm pack failed:\n${result.stderr || result.stdout}`,
  );
  const report = JSON.parse(result.stdout);
  const files = report[0].files.map((entry) => entry.path.replace(/\\/g, '/'));

  assert.ok(files.includes('bin/boffinit.js'));
  assert.ok(files.includes('lib/installer.js'));
  assert.ok(files.includes('AGENTS.md'));
  assert.ok(files.includes('CREDITS'));
  assert.ok(files.includes('VERSION'));
  assert.ok(files.includes('LICENSE'));
  assert.ok(files.some((file) => file.startsWith('packs/')));
  assert.ok(files.some((file) => file.startsWith('hooks/')));

  const cursorRules = files
    .filter((file) => file.startsWith('.cursor/rules/'))
    .sort();
  assert.deepEqual(cursorRules, EXPECTED_FILES
    .filter((file) => file.startsWith('.cursor/rules/'))
    .sort());

  assert.ok(!files.includes('gemini-extension.json'));
  assert.ok(!files.some((file) => file.startsWith('.claude-plugin/')));
  assert.ok(!files.some((file) => file.startsWith('.codex-plugin/')));
  assert.ok(!files.some((file) => file.startsWith('scripts/')));
  assert.ok(!files.some((file) => file.startsWith('docs/')));
  assert.ok(!files.includes('CONTRIBUTING.md'));
});
