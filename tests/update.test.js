'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  install,
  readManifest,
  update,
} = require('../lib/installer');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const OLD_INSTALLED_AT = '2025-12-01T10:00:00.000Z';

async function makeSandbox(t) {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'boffinit-update-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  return sandbox;
}

async function writeOlderInstallFixture(target) {
  const oldPack = path.join(
    target,
    '.boffin',
    'packs',
    'legacy',
    'removed.urf.md',
  );
  const unknownPack = path.join(
    target,
    '.boffin',
    'packs',
    'custom',
    'user-note.txt',
  );
  const oldRule = path.join(
    target,
    '.cursor',
    'rules',
    'boffin-pack-routing.mdc',
  );
  await fs.mkdir(path.dirname(oldPack), { recursive: true });
  await fs.mkdir(path.dirname(unknownPack), { recursive: true });
  await fs.mkdir(path.dirname(oldRule), { recursive: true });
  await fs.writeFile(oldPack, 'obsolete managed pack');
  await fs.writeFile(unknownPack, 'keep this user file');
  await fs.writeFile(oldRule, 'old generated rule');
  await fs.writeFile(path.join(target, '.boffin', 'VERSION'), '0.1.0\n');

  const manifest = {
    schemaVersion: 1,
    version: '0.1.0',
    installMethod: 'cursor',
    installedAt: OLD_INSTALLED_AT,
    managedFiles: [
      '.boffin/VERSION',
      '.boffin/install-manifest.json',
      '.boffin/packs/legacy/removed.urf.md',
      '.cursor/rules/boffin-pack-routing.mdc',
    ],
  };
  await fs.writeFile(
    path.join(target, '.boffin', 'install-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

test('update migrates an older version fixture and preserves unknown pack files', async (t) => {
  const target = await makeSandbox(t);
  await writeOlderInstallFixture(target);

  await update({ sourceRoot: SOURCE_ROOT, target });

  await assert.rejects(
    fs.lstat(path.join(
      target,
      '.boffin',
      'packs',
      'legacy',
      'removed.urf.md',
    )),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'packs', 'legacy')),
    { code: 'ENOENT' },
  );
  assert.equal(
    await fs.readFile(
      path.join(target, '.boffin', 'packs', 'custom', 'user-note.txt'),
      'utf8',
    ),
    'keep this user file',
  );
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    '0.2.0\n',
  );

  const manifest = await readManifest(target);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.installedAt, OLD_INSTALLED_AT);
  assert.ok(!manifest.managedFiles.includes(
    '.boffin/packs/legacy/removed.urf.md',
  ));
});

test('update requires an existing valid manifest', async (t) => {
  const target = await makeSandbox(t);

  await assert.rejects(
    update({ sourceRoot: SOURCE_ROOT, target }),
    /run "boffinit cursor install/,
  );

  await fs.mkdir(path.join(target, '.boffin'), { recursive: true });
  await fs.writeFile(
    path.join(target, '.boffin', 'install-manifest.json'),
    '{"schemaVersion": 999}',
  );
  await assert.rejects(
    update({ sourceRoot: SOURCE_ROOT, target }),
    /Invalid boffinit manifest.*unsupported schemaVersion/,
  );
});

test('failed replacement construction leaves an existing install unchanged', async (t) => {
  const sandbox = await makeSandbox(t);
  const target = path.join(sandbox, 'target');
  await install({ sourceRoot: SOURCE_ROOT, target });
  const manifestFile = path.join(target, '.boffin', 'install-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  manifest.managedFiles = manifest.managedFiles.filter(
    (file) => file !== '.boffin/packs/universal/pack.urf.md',
  );
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const beforeManifest = await fs.readFile(manifestFile, 'utf8');
  const beforePack = await fs.readFile(
    path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'),
    'utf8',
  );

  await assert.rejects(
    update({ sourceRoot: SOURCE_ROOT, target }),
    /unknown file already exists/,
  );
  assert.equal(
    await fs.readFile(manifestFile, 'utf8'),
    beforeManifest,
  );
  assert.equal(
    await fs.readFile(
      path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'),
      'utf8',
    ),
    beforePack,
  );
  assert.ok(
    (await fs.readdir(path.join(target, '.boffin')))
      .every((entry) => !entry.startsWith('.boffinit-tmp-')),
  );
});
