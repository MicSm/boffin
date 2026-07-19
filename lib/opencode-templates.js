'use strict';

const BOFFIN_SKILL = `---
name: boffin
description: Activates Boffin's routed architectural guardrails for coding, debugging, refactoring, and design. Use when the user invokes Boffin, types /boffin, or asks to apply ParselFire Core guidance. Optional profile argument lite, full, or max.
license: MIT
compatibility: opencode
---

# Boffin

Treat Boffin as active for the coding task.

1. Read \`.boffin/AGENTS.md\` at the project install root. It is the complete, authoritative behavior contract; do not reconstruct it from this skill.
2. Load pack indexes and leaves that contract routes for the task's actual mechanics. Resolve every \`packs/...\` path against \`.boffin/packs/...\`, not against the working directory and not relative to this skill file.
3. Follow its focused-change or review/refactor workflow, including external checks and the post-change review.

Profile: read \`.boffin/profile\` if present (\`lite\`, \`full\`, or \`max\`; default \`full\`). If the user passes lite|full|max (via /boffin args or chat), write that value to \`.boffin/profile\` and use it. Profiles change ambition and cleanup pressure only; they never weaken S00-S03, EXCLUDES, trust boundaries, data-loss prevention, security, or accessibility. There is no off profile.
`;

const BOFFIN_REVIEW_SKILL = `---
name: boffin-review
description: Reviews code, diffs, cleanup proposals, and refactors against Boffin's staged architectural guardrails. Use for Boffin review, architecture audit, compliance review, cleanup review, or open-ended refactor assessment.
license: MIT
compatibility: opencode
---

# Boffin Review

Read \`.boffin/AGENTS.md\` at the project install root. It is authoritative; this skill only activates its review path.

Preserve the user's request mode: a review or audit does not authorize edits. Scope the review to the requested files or changes, route through the relevant pack leaves under \`.boffin/packs/\`, and walk stages S00-S06 in order with EXCLUDES first.

For open-ended review, cleanup, or refactoring work, complete the contract's read-only first pass and findings ledger before proposing or applying fixes. If the user also requests implementation, drain that ledger one finding at a time with the narrowest proving check.

Use the active profile from \`.boffin/profile\` (lite|full|max) only to vary ambition and cleanup pressure. Never use it to lower the correctness or safety floor.
`;

const BOFFIN_COMMAND = `---
description: Activate Boffin architectural guardrails (optional: lite|full|max)
agent: build
---

Activate Boffin for this session.

1. If \`$ARGUMENTS\` is lite, full, or max, write that value to \`.boffin/profile\`. If \`$ARGUMENTS\` is empty, keep the existing \`.boffin/profile\` or default to full.
2. Load skill \`boffin\` (or equivalently follow \`.boffin/AGENTS.md\` with packs under \`.boffin/packs/\`).
3. Confirm the active profile in one short line, then continue with the user's task under that contract.
`;

const BOFFIN_REVIEW_COMMAND = `---
description: Run a Boffin architecture review / audit (read-only unless user asks to implement)
agent: plan
---

Run a Boffin review.

1. Load skill \`boffin-review\` (contract at \`.boffin/AGENTS.md\`, packs under \`.boffin/packs/\`).
2. Stay read-only unless the user explicitly asks to implement fixes.
3. For open-ended review/refactor, produce the findings ledger first (Pass 1), then wait for direction before Pass 2.
`;

const OPENCODE_MANAGED_FILES = Object.freeze([
  '.opencode/skills/boffin/SKILL.md',
  '.opencode/skills/boffin-review/SKILL.md',
  '.opencode/commands/boffin.md',
  '.opencode/commands/boffin-review.md',
]);

const JSONC_SKIP_NOTE =
  'Note: found opencode.jsonc; boffinit did not modify it. Add ".boffin/AGENTS.md" to its "instructions" array, or re-run with --inject-root-agents.';

module.exports = {
  BOFFIN_COMMAND,
  BOFFIN_REVIEW_COMMAND,
  BOFFIN_REVIEW_SKILL,
  BOFFIN_SKILL,
  JSONC_SKIP_NOTE,
  OPENCODE_MANAGED_FILES,
};
