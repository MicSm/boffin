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
  install,
  installOpenCode,
  readManifest,
  readOpenCodeManifest,
  uninstall,
  uninstallOpenCode,
  updateOpenCode,
} = require('../lib/installer');
const { JSONC_SKIP_NOTE } = require('../lib/opencode-templates');

const execFileAsync = promisify(execFile);
const SOURCE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(SOURCE_ROOT, 'bin', 'boffinit.js');

async function makeSandbox(t, prefix = 'boffinit-opencode-') {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  return sandbox;
}

function frontmatterName(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'expected YAML frontmatter');
  const nameLine = match[1].split(/\r?\n/).find((line) => line.startsWith('name:'));
  assert.ok(nameLine, 'expected name in frontmatter');
  return nameLine.slice('name:'.length).trim();
}

test('opencode install creates managed layout and instructions entry', async (t) => {
  const target = await makeSandbox(t);
  const installedAt = new Date('2026-07-20T12:00:00.000Z');

  const result = await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => installedAt,
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.notes, []);

  const agents = await fs.readFile(path.join(target, '.boffin', 'AGENTS.md'), 'utf8');
  assert.match(agents, /BOFFIN-MANAGED:/);
  assert.match(agents, /Boffin install root:/);
  assert.match(agents, /Resolve contract `packs\/\.\.\.` paths against `\.boffin\/packs\/\.\.\.`/);
  const agentsBody = agents.split(/\r?\n\r?\n/).slice(1).join('\n\n');
  assert.match(agentsBody, /\.boffin\/packs\//);
  assert.doesNotMatch(agentsBody, /(^|[^\w./-])packs\//m);

  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'profile'), 'utf8'),
    'full\n',
  );
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );

  const skill = await fs.readFile(
    path.join(target, '.opencode', 'skills', 'boffin', 'SKILL.md'),
    'utf8',
  );
  const reviewSkill = await fs.readFile(
    path.join(target, '.opencode', 'skills', 'boffin-review', 'SKILL.md'),
    'utf8',
  );
  assert.equal(frontmatterName(skill), 'boffin');
  assert.equal(frontmatterName(reviewSkill), 'boffin-review');

  await fs.lstat(path.join(target, '.opencode', 'commands', 'boffin.md'));
  await fs.lstat(path.join(target, '.opencode', 'commands', 'boffin-review.md'));

  const config = JSON.parse(await fs.readFile(path.join(target, 'opencode.json'), 'utf8'));
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.deepEqual(
    config.instructions.filter((entry) => entry === '.boffin/AGENTS.md'
      || entry === './.boffin/AGENTS.md'),
    ['.boffin/AGENTS.md'],
  );
  assert.equal(
    config.instructions.filter((entry) => entry === '.boffin/AGENTS.md').length,
    1,
  );

  const manifest = await readOpenCodeManifest(target);
  assert.equal(manifest.installMethod, 'opencode');
  assert.equal(manifest.version, PACKAGE_VERSION);
  assert.equal(manifest.installedAt, installedAt.toISOString());
  assert.deepEqual(manifest.opencodeConfig, {
    path: 'opencode.json',
    created: true,
    instruction: '.boffin/AGENTS.md',
  });
});

test('opencode update keeps a changed profile and stays idempotent', async (t) => {
  const target = await makeSandbox(t);
  await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  await fs.writeFile(path.join(target, '.boffin', 'profile'), 'max\n');
  const firstManifest = await fs.readFile(
    path.join(target, '.boffin', 'opencode-manifest.json'),
    'utf8',
  );
  const firstConfig = await fs.readFile(path.join(target, 'opencode.json'), 'utf8');

  await updateOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T00:00:00.000Z'),
  });
  await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-21T00:00:00.000Z'),
  });

  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'profile'), 'utf8'),
    'max\n',
  );
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'opencode-manifest.json'), 'utf8'),
    firstManifest,
  );
  assert.equal(await fs.readFile(path.join(target, 'opencode.json'), 'utf8'), firstConfig);

  const config = JSON.parse(firstConfig);
  assert.equal(
    config.instructions.filter((entry) => entry === '.boffin/AGENTS.md').length,
    1,
  );
});

test('opencode.jsonc-only project skips config and still installs host files', async (t) => {
  const target = await makeSandbox(t);
  await fs.writeFile(path.join(target, 'opencode.jsonc'), '{\n  // comment\n}\n');

  const result = await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T12:00:00.000Z'),
  });

  assert.deepEqual(result.notes, [JSONC_SKIP_NOTE]);
  await assert.rejects(fs.lstat(path.join(target, 'opencode.json')), { code: 'ENOENT' });
  await fs.lstat(path.join(target, '.opencode', 'skills', 'boffin', 'SKILL.md'));
  await fs.lstat(path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'));
  const manifest = await readOpenCodeManifest(target);
  assert.equal(manifest.opencodeConfig, null);
});

test('non-array instructions skips config step and still installs', async (t) => {
  const target = await makeSandbox(t);
  await fs.writeFile(
    path.join(target, 'opencode.json'),
    `${JSON.stringify({ instructions: 'already-a-string' }, null, 2)}\n`,
  );

  const result = await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T12:00:00.000Z'),
  });

  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /instructions/);
  assert.equal(
    await fs.readFile(path.join(target, 'opencode.json'), 'utf8'),
    `${JSON.stringify({ instructions: 'already-a-string' }, null, 2)}\n`,
  );
  await fs.lstat(path.join(target, '.opencode', 'commands', 'boffin.md'));
});

test('opencode uninstall reverses instruction entry and leaves foreign files', async (t) => {
  const target = await makeSandbox(t);
  await fs.writeFile(
    path.join(target, 'opencode.json'),
    `${JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      model: 'keep-me',
      instructions: ['user.md'],
    }, null, 2)}\n`,
  );
  await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T12:00:00.000Z'),
  });
  await fs.writeFile(path.join(target, '.opencode', 'commands', 'custom.md'), 'keep');

  const result = await uninstallOpenCode({ target });
  assert.equal(result.changed, true);

  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'opencode-manifest.json')),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    fs.lstat(path.join(target, '.opencode', 'skills', 'boffin', 'SKILL.md')),
    { code: 'ENOENT' },
  );
  await assert.rejects(fs.lstat(path.join(target, '.boffin', 'AGENTS.md')), { code: 'ENOENT' });
  await assert.rejects(fs.lstat(path.join(target, '.boffin', 'profile')), { code: 'ENOENT' });
  await assert.rejects(fs.lstat(path.join(target, '.boffin')), { code: 'ENOENT' });

  assert.equal(
    await fs.readFile(path.join(target, '.opencode', 'commands', 'custom.md'), 'utf8'),
    'keep',
  );
  const config = JSON.parse(await fs.readFile(path.join(target, 'opencode.json'), 'utf8'));
  assert.equal(config.model, 'keep-me');
  assert.deepEqual(config.instructions, ['user.md']);
});

test('cursor then opencode coexist; cursor uninstall keeps shared packs', async (t) => {
  const target = await makeSandbox(t);
  await install({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T10:00:00.000Z'),
  });
  const cursorManifestBefore = await fs.readFile(
    path.join(target, '.boffin', 'install-manifest.json'),
    'utf8',
  );

  await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T11:00:00.000Z'),
  });

  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'install-manifest.json'), 'utf8'),
    cursorManifestBefore,
  );
  assert.equal((await readManifest(target)).installMethod, 'cursor');
  assert.equal((await readOpenCodeManifest(target)).installMethod, 'opencode');

  await uninstall({ target });

  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'install-manifest.json')),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    fs.lstat(path.join(target, '.cursor', 'rules', 'boffin-pack-routing.mdc')),
    { code: 'ENOENT' },
  );
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );
  await fs.lstat(path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'));
  await fs.lstat(path.join(target, '.boffin', 'opencode-manifest.json'));

  await uninstallOpenCode({ target });
  await assert.rejects(fs.lstat(path.join(target, '.boffin')), { code: 'ENOENT' });
  await assert.rejects(fs.lstat(path.join(target, '.opencode')), { code: 'ENOENT' });
});

test('opencode then cursor: opencode uninstall keeps shared packs', async (t) => {
  const target = await makeSandbox(t);
  await installOpenCode({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T10:00:00.000Z'),
  });
  await install({
    target,
    sourceRoot: SOURCE_ROOT,
    now: () => new Date('2026-07-20T11:00:00.000Z'),
  });

  await uninstallOpenCode({ target });

  await assert.rejects(
    fs.lstat(path.join(target, '.boffin', 'opencode-manifest.json')),
    { code: 'ENOENT' },
  );
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );
  await fs.lstat(path.join(target, '.cursor', 'rules', 'boffin-pack-routing.mdc'));
  assert.equal((await readManifest(target)).installMethod, 'cursor');

  await uninstall({ target });
  await assert.rejects(fs.lstat(path.join(target, '.boffin')), { code: 'ENOENT' });
});

test('a corrupt opencode manifest still lets cursor uninstall keep shared packs', async (t) => {
  const target = await makeSandbox(t);
  await install({ target, sourceRoot: SOURCE_ROOT });
  await installOpenCode({ target, sourceRoot: SOURCE_ROOT });
  await fs.writeFile(
    path.join(target, '.boffin', 'opencode-manifest.json'),
    'not valid json',
  );

  const result = await uninstall({ target });
  assert.equal(result.changed, true);

  await assert.rejects(
    fs.lstat(path.join(target, '.cursor', 'rules', 'boffin-pack-routing.mdc')),
    { code: 'ENOENT' },
  );
  await fs.lstat(path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'));
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );
});

test('a corrupt cursor manifest still lets opencode uninstall keep shared packs', async (t) => {
  const target = await makeSandbox(t);
  await installOpenCode({ target, sourceRoot: SOURCE_ROOT });
  await install({ target, sourceRoot: SOURCE_ROOT });
  await fs.writeFile(
    path.join(target, '.boffin', 'install-manifest.json'),
    'not valid json',
  );

  const result = await uninstallOpenCode({ target });
  assert.equal(result.changed, true);

  await assert.rejects(
    fs.lstat(path.join(target, '.opencode', 'skills', 'boffin', 'SKILL.md')),
    { code: 'ENOENT' },
  );
  await fs.lstat(path.join(target, '.boffin', 'packs', 'universal', 'pack.urf.md'));
  assert.equal(
    await fs.readFile(path.join(target, '.boffin', 'VERSION'), 'utf8'),
    `${PACKAGE_VERSION}\n`,
  );
});

test('opencode dry-run on clean target does not claim uninstall success', async (t) => {
  const target = await makeSandbox(t);

  const result = await uninstallOpenCode({ dryRun: true, target });
  assert.equal(result.changed, false);
  assert.deepEqual(result.managedFiles, []);

  const { stdout } = await execFileAsync(
    process.execPath,
    [CLI, 'opencode', 'uninstall', '--dry-run', '--target', target],
    { cwd: target },
  );
  assert.match(stdout, /No boffinit installation found/);
});

test('CLI installs opencode and documents both hosts', async (t) => {
  const target = await makeSandbox(t, 'boffinit oc-cli ');
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [CLI, 'opencode', '--target', target],
    { cwd: path.dirname(target) },
  );

  assert.equal(stderr, '');
  assert.match(stdout, /Installed boffinit 0\.2\.0/);
  await fs.lstat(path.join(target, '.opencode', 'skills', 'boffin', 'SKILL.md'));

  const help = await execFileAsync(process.execPath, [CLI, '--help']);
  assert.match(help.stdout, /cursor\|opencode/);

  await assert.rejects(
    execFileAsync(process.execPath, [CLI, 'gemini']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /cursor.*opencode|opencode.*cursor/i);
      return true;
    },
  );
});
