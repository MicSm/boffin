'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function resolvePluginAsset(relativePath) {
  assert.match(relativePath, /^\.\//);
  const resolved = path.resolve(ROOT, relativePath.slice(2));
  assert.ok(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `${relativePath} escapes the plugin root`,
  );
  return resolved;
}

test('Claude manifest discovers the shared skills and hooks', () => {
  const manifest = readJson('.claude-plugin/plugin.json');
  assert.equal(manifest.name, 'boffin');
  assert.equal(manifest.displayName, 'Boffin');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.repository, 'https://github.com/MicSm/boffin');
  assert.equal(manifest.license, 'MIT');

  const skillsPath = resolvePluginAsset(manifest.skills);
  const hooksPath = resolvePluginAsset(manifest.hooks);
  assert.ok(fs.statSync(skillsPath).isDirectory());
  assert.ok(fs.statSync(hooksPath).isFile());
  assert.ok(fs.existsSync(path.join(skillsPath, 'boffin', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(skillsPath, 'boffin-review', 'SKILL.md')));
});

test('Claude marketplace exposes Boffin from the repository root', () => {
  const marketplace = readJson('.claude-plugin/marketplace.json');
  assert.equal(marketplace.name, 'boffin');
  assert.equal(marketplace.owner.name, 'MicSm');
  assert.equal(marketplace.plugins.length, 1);

  const plugin = marketplace.plugins[0];
  assert.equal(plugin.name, 'boffin');
  assert.equal(plugin.version, '0.2.0');
  assert.equal(plugin.source, './');
  assert.equal(plugin.category, 'productivity');
  assert.equal(resolvePluginAsset(plugin.source), ROOT);
});

test('shared hook declarations use command handlers on both platforms', () => {
  const wrapper = readJson('hooks/claude-codex-hooks.json');
  assert.deepEqual(
    Object.keys(wrapper.hooks).sort(),
    ['SessionStart', 'SubagentStart', 'UserPromptSubmit'].sort(),
  );

  for (const [event, groups] of Object.entries(wrapper.hooks)) {
    assert.ok(Array.isArray(groups) && groups.length > 0, event);
    for (const group of groups) {
      assert.ok(Array.isArray(group.hooks) && group.hooks.length > 0, event);
      for (const hook of group.hooks) {
        assert.equal(hook.type, 'command');
        assert.match(hook.command, /^node /);
        assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
        assert.match(hook.commandWindows, /\$env:CLAUDE_PLUGIN_ROOT/);
        assert.equal(hook.timeout, 5);
        assert.ok(hook.statusMessage);
        assert.ok(!hook.command.includes(ROOT));
        assert.ok(!hook.commandWindows.includes(ROOT));
      }
    }
  }
});
