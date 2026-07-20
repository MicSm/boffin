'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');

const {
  PACKAGE_VERSION,
  generateManagedRule,
  install,
  readManifest,
} = require('../lib/installer');
const { RULE_FILENAMES } = require('../lib/paths');

const execFileAsync = promisify(execFile);
const SOURCE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(SOURCE_ROOT, 'bin', 'boffinit.js');

async function makeSandbox(t, prefix = 'boffinit-install-') {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  return sandbox;
}

test('clean install writes packs, version, generated rules, and manifest', async (t) => {
  const target = await makeSandbox(t);
  const installedAt = new Date('2026-07-11T12:00:00.000Z');

  await install({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => installedAt,
  });

  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );
  assert.equal(
    await fs.readFile(
      path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'),
      'utf8',
    ).then((content) => content.startsWith('# Universal Pack Index')),
    true,
  );

  const manifest = await readManifest(target);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, PACKAGE_VERSION);
  assert.equal(manifest.installMethod, 'cursor');
  assert.equal(manifest.installedAt, installedAt.toISOString());
  assert.ok(manifest.managedFiles.includes('.boffin/install-manifest.json'));
  assert.ok(manifest.managedFiles.every((file) => !file.includes('\\')));

  for (const filename of RULE_FILENAMES) {
    const managedPath = `.cursor/rules/${filename}`;
    assert.ok(manifest.managedFiles.includes(managedPath));
    const generated = await fs.readFile(
      path.join(target, '.cursor', 'rules', filename),
      'utf8',
    );
    assert.match(generated, /^---\r?\n# BOFFIN-MANAGED:/);
  }

  const routingRule = await fs.readFile(
    path.join(target, '.cursor', 'rules', 'boffin-pack-routing.mdc'),
    'utf8',
  );
  assert.match(routingRule, /`\.boffin\/packs\/universal\/pack\.urf\.md`/);
  assert.doesNotMatch(routingRule, /(^|[^\w./-])packs\//m);
});

test('reinstall is idempotent and does not double-transform rules', async (t) => {
  const target = await makeSandbox(t);
  await install({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  await fs.writeFile(path.join(target, '.boffin', 'user-note.txt'), 'keep me');
  const firstManifest = await readManifest(target);

  await install({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-11T00:00:00.000Z'),
  });

  const secondManifest = await readManifest(target);
  assert.deepEqual(secondManifest, firstManifest);
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'user-note.txt'), 'utf8'),
    'keep me',
  );

  const generated = await fs.readFile(
    path.join(target, '.cursor', 'rules', 'boffin-pack-routing.mdc'),
    'utf8',
  );
  assert.equal((generated.match(/BOFFIN-MANAGED/g) || []).length, 1);
  assert.doesNotMatch(generated, /\.boffin\/\.boffin\/packs\//);
  assert.equal(generateManagedRule(generated), generated);
});

test('dry-run reports an install without creating the target', async (t) => {
  const sandbox = await makeSandbox(t);
  const target = path.join(sandbox, 'not-created');

  const result = await install({
    dryRun: true,
    sourceRoot: SOURCE_ROOT,
    target,
  });

  assert.equal(result.dryRun, true);
  await assert.rejects(fs.lstat(target), { code: 'ENOENT' });
});

test('CLI handles a target path containing spaces', async (t) => {
  const sandbox = await makeSandbox(t, 'boffinit cli ');
  const target = path.join(sandbox, 'repository with spaces');

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [CLI, 'cursor', '--target', target],
    { cwd: sandbox },
  );

  assert.match(stdout, /Installed boffinit 0\.3\.0/);
  assert.equal(stderr, '');
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    '0.3.0\n',
  );
});

test('CLI defaults to install at the detected repository root', async (t) => {
  const sandbox = await makeSandbox(t);
  const repository = path.join(sandbox, 'repository');
  const nested = path.join(repository, 'nested', 'directory');
  await fs.mkdir(path.join(repository, '.git'), { recursive: true });
  await fs.mkdir(nested, { recursive: true });

  const { stdout } = await execFileAsync(
    process.execPath,
    [CLI, 'cursor', '--dry-run'],
    { cwd: nested },
  );

  assert.match(stdout, /Would install boffinit 0\.3\.0/);
  assert.ok(stdout.includes(repository));
  await assert.rejects(
    fs.lstat(path.join(repository, '.boffin')),
    { code: 'ENOENT' },
  );
});

test('CLI reports invalid actions with a nonzero exit', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [CLI, 'cursor', 'invalid-action']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /boffinit: Unknown action/);
      assert.match(error.stderr, /--help/);
      return true;
    },
  );
});

test('CLI exposes help and version without touching a repository', async () => {
  const help = await execFileAsync(process.execPath, [CLI, '--help']);
  const version = await execFileAsync(process.execPath, [CLI, '--version']);

  assert.match(help.stdout, /Usage: boffinit <cursor\|opencode>/);
  assert.equal(version.stdout, '0.3.0\n');
});
