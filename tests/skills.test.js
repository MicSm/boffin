'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const EXPECTED_SKILLS = ['boffin', 'boffin-review'];

function parseFrontmatter(contents) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    assert.ok(separator > 0, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1');
    assert.ok(key && value, `empty frontmatter field: ${line}`);
    fields[key] = value;
  }
  return fields;
}

test('only the two shared Boffin skills are shipped', () => {
  const directories = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(directories, [...EXPECTED_SKILLS].sort());
});

for (const skillName of EXPECTED_SKILLS) {
  test(`${skillName} has discoverable, concise skill metadata`, () => {
    const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
    const contents = fs.readFileSync(skillPath, 'utf8');
    const frontmatter = parseFrontmatter(contents);
    const lineCount = contents.split(/\r?\n/).length;

    assert.equal(frontmatter.name, skillName);
    assert.match(frontmatter.name, /^[a-z0-9-]+$/);
    assert.ok(frontmatter.name.length <= 64);
    assert.ok(frontmatter.description.length > 40);
    assert.ok(frontmatter.description.length <= 1024);
    assert.match(frontmatter.description, /^(?:Activates|Reviews)\b/);
    assert.match(frontmatter.description, /\bUse when\b/);
    assert.doesNotMatch(frontmatter.description, /\b(?:I|You)\b/);
    assert.equal(frontmatter.license, 'MIT');
    assert.ok(lineCount < 500, `${skillName} has ${lineCount} lines`);
    assert.match(contents, /installed plugin root/);
    assert.doesNotMatch(contents, /# ParselFire Core Portable Routing Contract/);
  });
}
