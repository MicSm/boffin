'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  DEFAULT_PROFILE,
  PROFILES,
  getPluginDataDir,
  normalizeProfile,
  parseProfileCommand,
} = require('../hooks/boffin-config');
const {
  STATE_FILE,
  getStatePath,
  readProfile,
  setProfile,
} = require('../hooks/boffin-runtime');
const {
  PROFILE_OVERLAYS,
  buildInstructions,
  loadCanonicalContract,
} = require('../hooks/boffin-instructions');

const ROOT = path.resolve(__dirname, '..');
const HOOKS = path.join(ROOT, 'hooks');
const PLUGIN_ENV_KEYS = [
  'PLUGIN_ROOT',
  'PLUGIN_DATA',
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_PLUGIN_DATA',
];

function makeTemp(t, prefix = 'boffin-hooks-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function cleanEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of PLUGIN_ENV_KEYS) delete env[key];
  return { ...env, ...overrides };
}

function runHook(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(HOOKS, script)], {
    encoding: 'utf8',
    env: cleanEnv(env),
    input,
    timeout: 4000,
  });
}

function makeRelocatedPlugin(t, contract = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')) {
  const pluginRoot = path.join(makeTemp(t, 'boffin-plugin-'), 'relocated');
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'AGENTS.md'), contract, 'utf8');
  return pluginRoot;
}

test('profiles normalize without an off state and commands match exactly', () => {
  assert.deepEqual(PROFILES, ['lite', 'full', 'max']);
  assert.equal(DEFAULT_PROFILE, 'full');
  assert.equal(normalizeProfile(' LITE '), 'lite');
  assert.equal(normalizeProfile('Full'), 'full');
  assert.equal(normalizeProfile('max'), 'max');
  assert.equal(normalizeProfile('off'), null);
  assert.equal(normalizeProfile('review'), null);
  assert.equal(normalizeProfile(null), null);

  assert.deepEqual(parseProfileCommand('/boffin'), { kind: 'report' });
  assert.deepEqual(parseProfileCommand('/boffin lite'), { kind: 'set', profile: 'lite' });
  assert.deepEqual(parseProfileCommand('/BOFFIN MAX'), { kind: 'set', profile: 'max' });
  assert.deepEqual(parseProfileCommand('/boffin:boffin full'), { kind: 'set', profile: 'full' });

  for (const text of [
    '/boffin off',
    '/boffin max now',
    '/boffin-review',
    '@boffin lite',
    'please use /boffin max',
    'switch to boffin lite',
    '/boffin\nlite',
    'normal mode',
    'stop boffin',
  ]) {
    assert.equal(parseProfileCommand(text), null, text);
  }
});

test('profile persistence validates data and replaces it atomically', (t) => {
  const temp = makeTemp(t);
  const pluginData = path.join(temp, 'plugin-data');
  const fallbackData = path.join(temp, 'claude-data');
  const options = {
    env: {
      PLUGIN_DATA: pluginData,
      CLAUDE_PLUGIN_DATA: fallbackData,
    },
  };
  const statePath = path.join(pluginData, STATE_FILE);

  assert.equal(getStatePath(options), statePath);
  assert.equal(readProfile(options), 'full');
  assert.equal(setProfile(' MAX ', options), 'max');
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'max');
  assert.equal(readProfile(options), 'max');

  assert.equal(setProfile('off', options), null);
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'max');

  fs.writeFileSync(statePath, 'off', 'utf8');
  assert.equal(readProfile(options), 'full');
  fs.writeFileSync(statePath, '\uFEFFlite', 'utf8');
  assert.equal(readProfile(options), 'lite');
  fs.writeFileSync(statePath, '{not-profile}', 'utf8');
  assert.equal(readProfile(options), 'full');
  fs.rmSync(statePath);
  assert.equal(readProfile(options), 'full');

  assert.deepEqual(
    fs.readdirSync(pluginData).filter((name) => name.endsWith('.tmp')),
    [],
  );
});

test('plugin data precedence avoids user fallback for installed plugins', (t) => {
  const temp = makeTemp(t);
  const codexData = path.join(temp, 'codex');
  const claudeData = path.join(temp, 'claude');
  assert.equal(
    getPluginDataDir({ env: { PLUGIN_DATA: codexData, CLAUDE_PLUGIN_DATA: claudeData } }),
    codexData,
  );
  assert.equal(
    getPluginDataDir({ env: { CLAUDE_PLUGIN_DATA: claudeData } }),
    claudeData,
  );
  assert.equal(
    getPluginDataDir({
      env: { PLUGIN_ROOT: path.join(temp, 'installed') },
      homeDir: path.join(temp, 'home'),
      platform: 'linux',
    }),
    null,
  );
  assert.equal(
    getPluginDataDir({
      env: { XDG_STATE_HOME: path.join(temp, 'state') },
      homeDir: path.join(temp, 'home'),
      platform: 'linux',
    }),
    path.join(temp, 'state', 'boffin'),
  );
});

test('instructions load the complete canonical contract from a relocated root', (t) => {
  const canonical = [
    '# Relocated Boffin Contract',
    'S00 S01 S02 S03',
    'EXCLUDES',
    'trust-boundary validation',
    'data-loss prevention',
    'security',
    'accessibility',
    '',
  ].join('\n');
  const pluginRoot = makeRelocatedPlugin(t, canonical);

  assert.equal(loadCanonicalContract(pluginRoot), canonical);
  for (const profile of PROFILES) {
    const instructions = buildInstructions(profile, {
      env: { PLUGIN_ROOT: pluginRoot },
    });
    assert.ok(instructions.endsWith(canonical));
    assert.match(instructions, new RegExp(`profile: ${profile}`));
    assert.ok(instructions.includes(PROFILE_OVERLAYS[profile]));
    assert.ok(instructions.includes(`Boffin install root: ${pluginRoot}`));
    assert.ok(instructions.includes('Resolve every such packs/ path'));
  }
});

test('all profiles retain the early-stage and safety invariants', () => {
  const canonical = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  const required = [
    'S00',
    'S01',
    'S02',
    'S03',
    'EXCLUDES',
    'trust-boundary validation',
    'data-loss prevention',
    'security',
    'accessibility',
  ];

  for (const profile of PROFILES) {
    const instructions = buildInstructions(profile, { pluginRoot: ROOT });
    assert.ok(instructions.endsWith(canonical));
    assert.ok(instructions.includes(`Boffin install root: ${ROOT}`));
    for (const invariant of required) {
      assert.ok(instructions.includes(invariant), `${profile}: ${invariant}`);
    }
  }
});

test('Claude and Codex receive their required SessionStart and SubagentStart shapes', (t) => {
  const pluginRoot = makeRelocatedPlugin(t);
  const temp = makeTemp(t);
  const codexData = path.join(temp, 'codex-data');
  const claudeData = path.join(temp, 'claude-data');
  const codexEnv = {
    PLUGIN_ROOT: pluginRoot,
    PLUGIN_DATA: codexData,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: codexData,
  };
  const claudeEnv = {
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: claudeData,
  };

  let result = runHook('boffin-activate.js', codexEnv, JSON.stringify({ source: 'startup' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(codexData, STATE_FILE), 'utf8'), 'full');
  let output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'BOFFIN:FULL');
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /BOFFIN ACTIVE — profile: full/);
  assert.equal(output.additionalContext, undefined);

  result = runHook('boffin-activate.js', claudeEnv, JSON.stringify({ source: 'startup' }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^BOFFIN ACTIVE — profile: full/);

  result = runHook('boffin-subagent.js', claudeEnv, JSON.stringify({ agent_type: 'Explore' }));
  assert.equal(result.status, 0, result.stderr);
  output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(output.hookSpecificOutput.additionalContext, /Canonical Boffin contract/);

  result = runHook('boffin-subagent.js', codexEnv, JSON.stringify({ agent_type: 'Explore' }));
  assert.equal(result.status, 0, result.stderr);
  output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'BOFFIN:FULL');
  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
});

test('mode tracker switches and reports only exact commands', (t) => {
  const pluginRoot = makeRelocatedPlugin(t);
  const pluginData = path.join(makeTemp(t), 'plugin-data');
  const env = {
    PLUGIN_ROOT: pluginRoot,
    PLUGIN_DATA: pluginData,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: pluginData,
  };
  const statePath = path.join(pluginData, STATE_FILE);

  let result = runHook(
    'boffin-mode-tracker.js',
    env,
    JSON.stringify({ prompt: '/boffin lite' }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'lite');
  let output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'BOFFIN:LITE');
  assert.match(output.hookSpecificOutput.additionalContext, /profile changed to lite/);
  assert.match(output.hookSpecificOutput.additionalContext, /Canonical Boffin contract/);

  result = runHook(
    'boffin-mode-tracker.js',
    env,
    JSON.stringify({ prompt: 'Please use /boffin max for this request.' }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'lite');

  result = runHook(
    'boffin-mode-tracker.js',
    env,
    JSON.stringify({ prompt: '/boffin off' }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'lite');

  result = runHook('boffin-mode-tracker.js', env, JSON.stringify({ prompt: '/boffin' }));
  assert.equal(result.status, 0, result.stderr);
  output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'BOFFIN:LITE');
  assert.match(output.hookSpecificOutput.additionalContext, /profile active: lite/);

  result = runHook(
    'boffin-mode-tracker.js',
    env,
    JSON.stringify({ prompt: '/boffin:boffin max' }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'max');
  output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'BOFFIN:MAX');
});

test('invalid or BOM-prefixed stdin never fails a handler', (t) => {
  const pluginRoot = makeRelocatedPlugin(t);
  const pluginData = path.join(makeTemp(t), 'plugin-data');
  const env = {
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: pluginData,
  };

  for (const script of [
    'boffin-activate.js',
    'boffin-mode-tracker.js',
    'boffin-subagent.js',
  ]) {
    const result = runHook(script, env, '\uFEFF{not-json');
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test('stdin timeout fallback exits without waiting for EOF', async (t) => {
  const pluginRoot = makeRelocatedPlugin(t);
  const pluginData = path.join(makeTemp(t), 'plugin-data');
  const child = spawn(process.execPath, [path.join(HOOKS, 'boffin-mode-tracker.js')], {
    env: cleanEnv({
      PLUGIN_ROOT: pluginRoot,
      PLUGIN_DATA: pluginData,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: pluginData,
    }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => {
    if (!child.killed) child.kill();
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.write(JSON.stringify({ prompt: '/boffin lite' }));

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('hook did not exit after stdin timeout')), 3000);
    child.once('close', (status) => {
      clearTimeout(timer);
      resolve(status);
    });
  });

  assert.equal(code, 0, stderr);
  assert.equal(JSON.parse(stdout).systemMessage, 'BOFFIN:LITE');
  assert.equal(fs.readFileSync(path.join(pluginData, STATE_FILE), 'utf8'), 'lite');
});
