'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  findRepoRoot,
  resolveTarget,
  toPosixPath,
  validateManagedPath,
  validateOpenCodeManagedPath,
} = require('../lib/paths');

async function makeSandbox(t) {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'boffinit-paths-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  return sandbox;
}

test('findRepoRoot detects a repository from a nested directory', async (t) => {
  const sandbox = await makeSandbox(t);
  const repository = path.join(sandbox, 'repository');
  const nested = path.join(repository, 'one', 'two');
  await fs.mkdir(path.join(repository, '.git'), { recursive: true });
  await fs.mkdir(nested, { recursive: true });

  assert.equal(await findRepoRoot(nested), repository);
});

test('findRepoRoot falls back to the starting directory', async (t) => {
  const sandbox = await makeSandbox(t);
  const start = path.join(sandbox, 'not a repository');
  await fs.mkdir(start);

  assert.equal(await findRepoRoot(start), start);
});

test('explicit targets preserve spaces and resolve from cwd', async (t) => {
  const sandbox = await makeSandbox(t);
  const target = await resolveTarget(`.${path.sep}repository with spaces`, sandbox);

  assert.equal(target, path.join(sandbox, 'repository with spaces'));
});

test('managed paths use normalized POSIX separators and safe namespaces', () => {
  assert.equal(
    toPosixPath(String.raw`universal\folder with spaces\pack.urf.md`),
    'universal/folder with spaces/pack.urf.md',
  );
  assert.equal(
    validateManagedPath('.boffin/packs/folder with spaces/pack.urf.md'),
    '.boffin/packs/folder with spaces/pack.urf.md',
  );
  assert.throws(
    () => validateManagedPath(String.raw`.boffin\packs\pack.urf.md`),
    /non-POSIX/,
  );
  assert.throws(
    () => validateManagedPath('.boffin/packs/../outside.txt'),
    /non-normalized/,
  );
  assert.throws(
    () => validateManagedPath('unrelated.txt'),
    /unmanaged path/,
  );
  assert.equal(
    validateOpenCodeManagedPath('.opencode/skills/boffin/SKILL.md'),
    '.opencode/skills/boffin/SKILL.md',
  );
  assert.throws(
    () => validateOpenCodeManagedPath('.cursor/rules/boffin-pack-routing.mdc'),
    /unmanaged path/,
  );
  assert.throws(
    () => validateManagedPath('.opencode/skills/boffin/SKILL.md'),
    /unmanaged path/,
  );
});
