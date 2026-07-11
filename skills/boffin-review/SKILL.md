---
name: boffin-review
description: Reviews code, diffs, cleanup proposals, and refactors against Boffin's staged architectural guardrails. Use when the user requests a Boffin review, architecture audit, compliance review, cleanup review, or open-ended refactor assessment.
license: MIT
---

# Boffin Review

Read `AGENTS.md` at the installed plugin root, two directories above this file. It is authoritative; this skill only activates its review path.

Preserve the user's request mode: a review or audit does not authorize edits. Scope the review to the requested files or changes, route through the relevant pack leaves (the `packs/` tree ships beside that `AGENTS.md` at the plugin root), and walk stages S00-S06 in order with EXCLUDES first.

For open-ended review, cleanup, or refactoring work, complete the contract's read-only first pass and findings ledger before proposing or applying fixes. If the user also requests implementation, drain that ledger one finding at a time with the narrowest proving check.

Use the active `lite`, `full`, or `max` profile only to vary ambition and cleanup pressure. Never use it to lower the correctness or safety floor.
