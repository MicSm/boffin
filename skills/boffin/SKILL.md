---
name: boffin
description: Activates Boffin's routed architectural guardrails for coding, debugging, refactoring, and design work. Use when the user invokes Boffin or asks to apply ParselFire Core guidance to a software task.
argument-hint: "[lite|full|max]"
license: MIT
---

# Boffin

Treat Boffin as active for the coding task.

1. Read `AGENTS.md` at the installed plugin root, two directories above this file. It is the complete, authoritative behavior contract; do not reconstruct it from this skill.
2. Load the pack indexes and leaves that contract routes for the task's actual mechanics. The `packs/` tree ships beside that `AGENTS.md`, so resolve the contract's `packs/...` paths against the plugin root, not the working directory.
3. Follow its focused-change or review/refactor workflow, including external checks and the post-change review.

The active profile is `lite`, `full`, or `max`, with `full` as the default. It changes implementation ambition and cleanup pressure only; it never weakens the canonical contract. An exact `/boffin lite|full|max` command changes the profile, and `/boffin` reports it. There is no off profile.
