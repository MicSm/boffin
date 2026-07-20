'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');

const {
  install,
  readManifest,
  uninstall,
} = require('../lib/installer');
const { RULE_FILENAMES } = require('../lib/paths');

const execFileAsync = promisify(execFile);
const SOURCE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(SOURCE_ROOT, 'bin', 'boffinit.js');

async function makeSandbox(t) {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'boffinit-uninstall-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  return sandbox;
}

test('uninstall removes only manifest-owned files and empty directories', async (t) => {
  const target = await makeSandbox(t);
  await install({ sourceRoot: SOURCE_ROOT, target });

  const foreignRule = path.join(target, '.cursor', 'rules', 'custom-rule.mdc');
  const unknownBoffinFile = path.join(target, '.boffin', 'user-settings.json');
  const unknownPackFile = path.join(
    target,
    '.boffin',
    'packs',
    'custom',
    'user-pack.md',
  );
  await fs.writeFile(foreignRule, 'keep foreign rule');
  await fs.writeFile(unknownBoffinFile, '{"keep":true}');
  await fs.mkdir(path.dirname(unknownPackFile), { recursive: true });
  await fs.writeFile(unknownPackFile, 'keep unknown pack file');

  const result = await uninstall({ target });
  assert.equal(result.changed, true);

  for (const filename of RULE_FILENAMES) {
    await assert.rejects(
      fs.lstat(path.join(target, '.cursor', 'rules', filename)),
      { code: 'ENOENT' },
    );
  }
  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'install-manifest.json')),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'VERSION')),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    fs.lstat(path.join(
      target,
      '.boffin',
      'packs',
      'universal',
      'pack.urf.md',
    )),
    { code: 'ENOENT' },
  );

  assert.equal(await fs.readFile(foreignRule, 'utf8'), 'keep foreign rule');
  assert.equal(
    await fs.readFile(unknownBoffinFile, 'utf8'),
    '{"keep":true}',
  );
  assert.equal(
    await fs.readFile(unknownPackFile, 'utf8'),
    'keep unknown pack file',
  );

  const secondResult = await uninstall({ target });
  assert.equal(secondResult.changed, false);
});

test('uninstall dry-run leaves every managed file in place', async (t) => {
  const target = await makeSandbox(t);
  await install({ sourceRoot: SOURCE_ROOT, target });
  const manifestBefore = await fs.readFile(
    path.join(target, '.boffin', 'install-manifest.json'),
    'utf8',
  );

  const result = await uninstall({ dryRun: true, target });

  assert.equal(result.dryRun, true);
  assert.equal(
    await fs.readFile(
      path.join(target, '.boffin', 'install-manifest.json'),
      'utf8',
    ),
    manifestBefore,
  );
  assert.equal((await readManifest(target)).version, '0.3.0');

  await uninstall({ target });
  await assert.rejects(fs.lstat(path.join(target, '.boffin')), { code: 'ENOENT' });
  await assert.rejects(fs.lstat(path.join(target, '.cursor')), { code: 'ENOENT' });
});

test('uninstall dry-run on a clean target reports no installation', async (t) => {
  const target = await makeSandbox(t);

  const result = await uninstall({ dryRun: true, target });
  assert.equal(result.changed, false);
  assert.deepEqual(result.managedFiles, []);

  const { stdout } = await execFileAsync(
    process.execPath,
    [CLI, 'cursor', 'uninstall', '--dry-run', '--target', target],
    { cwd: target },
  );
  assert.match(stdout, /No boffinit installation found/);
});

test('uninstall rejects an unsafe manifest before removing files', async (t) => {
  const target = await makeSandbox(t);
  await install({ sourceRoot: SOURCE_ROOT, target });
  const manifestFile = path.join(target, '.boffin', 'install-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  manifest.managedFiles.push('important-user-file.txt');
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  const importantFile = path.join(target, 'important-user-file.txt');
  await fs.writeFile(importantFile, 'keep');

  await assert.rejects(
    uninstall({ target }),
    /Invalid boffinit manifest.*unmanaged path/,
  );
  assert.equal(await fs.readFile(importantFile, 'utf8'), 'keep');
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    '0.3.0\n',
  );
});
