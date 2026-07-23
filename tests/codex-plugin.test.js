'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function resolvePluginAsset(relativePath) {
  assert.match(relativePath, /^\.\//);
  const resolved = path.resolve(ROOT, relativePath.slice(2));
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`));
  return resolved;
}

test('Codex manifest resolves shared assets and conservative metadata', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(manifest.name, 'boffin');
  assert.equal(manifest.version, '0.3.1');
  assert.equal(manifest.repository, 'https://github.com/MicSm/boffin');
  assert.equal(manifest.homepage, 'https://github.com/MicSm/boffin');
  assert.equal(manifest.license, 'MIT');
  assert.ok(fs.statSync(resolvePluginAsset(manifest.skills)).isDirectory());
  assert.ok(fs.statSync(resolvePluginAsset(manifest.hooks)).isFile());

  assert.deepEqual(
    Object.keys(manifest.interface).sort(),
    [
      'capabilities',
      'category',
      'defaultPrompt',
      'developerName',
      'displayName',
      'longDescription',
      'shortDescription',
      'websiteURL',
    ].sort(),
  );
  assert.equal(manifest.interface.displayName, 'Boffin');
  assert.equal(manifest.interface.category, 'Productivity');
  assert.equal(manifest.interface.websiteURL, 'https://github.com/MicSm/boffin');
  assert.ok(manifest.interface.defaultPrompt.length >= 1);
});

test('Codex hook manifest uses only currently supported command hooks', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
  );
  const wrapper = JSON.parse(fs.readFileSync(resolvePluginAsset(manifest.hooks), 'utf8'));

  for (const groups of Object.values(wrapper.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        assert.equal(hook.type, 'command');
        assert.equal(typeof hook.command, 'string');
        assert.equal(typeof hook.commandWindows, 'string');
      }
    }
  }
});
