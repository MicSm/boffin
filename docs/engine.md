# ParselFire Core

**ParselFire Core** is the routing engine behind [Boffin](../README.md). Boffin is
the public product and character; ParselFire Core is the exact name of the
technical engine underneath it.

This page describes the engine surface for engineers who want to audit the
mechanism rather than take the README's word for it.

## The routed pack model

ParselFire Core stores architectural guidance in small pack families instead of
one large always-loaded prompt. The public families are:

- [universal](../packs/universal/pack.urf.md), for language-independent scope,
  contracts, state, lifecycle, boundaries, and convergence;
- [Python architecture](../packs/python-architecture/pack.urf.md), for Python
  mechanics such as async surfaces and import structure;
- [C++ architecture](../packs/cpp-architecture/pack.urf.md), for C++ mechanics
  such as ownership, RAII, and concurrency.

Plain C uses the universal family. A `.h` file uses the C++ family only when its
contents actually contain C++ constructs.

Each family has a thin `pack.urf.md` index and a set of `*.urf.md` leaves. The
index provides the routing map:

- `ROUTING` maps short context signals to a primary leaf;
- `LEAVES` records which stages each leaf covers;
- the universal index defines the ordered `STAGES` pipeline;
- language-family indexes add stage references for their own kernels.

The agent selects a primary leaf from the active file and task, then follows the
index's stage map to load any other leaves needed by the mechanics it is
actually touching. It does not search the repository for a convenient rule id.
The result is a small, explainable read set.

A late-stage cleanup is never allowed to route around early correctness. If a
primary leaf covers only shared abstraction, boundaries, or convergence, the
agent must also load the early-stage correctness leaves needed by that code as
rejection filters.

## Stage order

ParselFire Core walks the stages in this order:

1. **S00 — scope and need:** stay inside the requested task and keep the change
   surface small.
2. **S01 — contracts and invariants:** preserve exact contracts, true special
   cases, and required safety behavior.
3. **S02 — state and outcomes:** keep meaningful states and distinct outcomes
   explicit.
4. **S03 — ownership and lifecycle:** keep mutable state, publication,
   rebuilding, and teardown under clear ownership.
5. **S04 — shared abstractions:** extract a shared invariant only after the
   semantics are understood.
6. **S05 — boundaries and plumbing:** carry first-class behavior through real
   subsystem boundaries without side channels.
7. **S06 — convergence and deletion:** remove displaced layers only after the
   replacement path is proven.

At each stage, matching `X` entries are checked first as rejection filters;
matching `K` entries are considered second as positive guidance. Earlier stages
win when they conflict with later cleanup. A neater abstraction is not a valid
reason to weaken a contract, state distinction, or lifecycle invariant.

## Two work modes

### Focused change

When the operator requests a specific function, fix, or feature, the agent:

1. identifies the language and execution domain from the target source;
2. loads the universal index and, when applicable, one language-family index;
3. routes to the primary seam and completes the relevant stage walk,
   EXCLUDES first;
4. makes only the requested change;
5. runs the narrowest external test or lint that proves it;
6. re-reads the loaded guidance and reviews the final touched region as if a
   different author wrote it.

For focused coding, the usual 3–5 entry budget applies to the guidance the agent
materially acts on after the walk. It is not a cap on checking the relevant
stages.

### Open-ended refactor, cleanup, or review

Open-ended work uses two passes.

**Pass 1 is read-only.** The agent audits the full requested scope from S00
upward and records a findings ledger. Every in-scope stage gets either a concrete
finding or a reasoned skip. A finding records its path, stage, status, kernel,
code anchor, and the check that would prove it.

**Pass 2 drains the ledger.** The agent applies one finding at a time, runs its
narrowest proving check, and resolves the row as done or as an explicit reasoned
skip. A named finding cannot silently disappear, and the task does not finish
with unresolved rows.

This distinction matters: a small requested fix should not become a file-wide
cleanup, while a broad review should not stop at the first attractive edit.

## Human guides versus runtime indexes

The Markdown guides are for people browsing the repository:

- [pack overview](../packs/README.md)
- [universal guide](../packs/universal/README.md)
- [Python architecture guide](../packs/python-architecture/README.md)
- [C++ architecture guide](../packs/cpp-architecture/README.md)

Agents use the `pack.urf.md` indexes and the leaf files those indexes route to.
The guide READMEs are not runtime guidance and should not be substituted for the
indexes. Keeping those surfaces separate makes the execution contract compact
without making the project opaque to human reviewers.

## Host delivery and adapters

The same ParselFire Core contract reaches different coding agents through thin
host surfaces.

The launch delivery paths are:

- **Cursor:** the `boffinit` npm package installs the packs under
  `.boffin/packs/` and managed routing rules under `.cursor/rules/`.
- **Claude Code:** the repository's Claude marketplace/plugin surface exposes
  the shared Boffin skills and hooks.
- **Codex:** the Codex plugin reuses the same shared skills and hook runtime.
- **OpenCode:** `npx boffinit opencode` vendors the same packs under
  `.boffin/packs/`, writes always-on guidance to `.boffin/AGENTS.md` via
  `opencode.json` `instructions`, and emits OpenCode-native skills/commands
  under `.opencode/`. See **[docs/opencode.md](opencode.md)**.

The npm installer (Cursor + OpenCode) and the Claude/Codex plugin surfaces are
separate delivery paths. They share the same guidance; one is not packaged
inside the other. Cursor and OpenCode may coexist in one project: each owns its
host files; packs and `VERSION` are shared.

Portable static adapters remain available for hosts that already consume
repository instructions:

- `AGENTS.md` is the canonical portable contract and is read by Codex, Aider,
  Zed, CodeWhale, and other compatible hosts;
- `CLAUDE.md` is the static Claude Code adapter;
- `.github/copilot-instructions.md` serves GitHub Copilot;
- `.windsurf/rules/boffin.md` serves Windsurf;
- `.clinerules/boffin.md` serves Cline;
- `.kiro/steering/boffin.md` serves Kiro;
- `.agents/rules/boffin.md` serves workspace-rules hosts;
- `gemini-extension.json` is the Gemini CLI / Antigravity surface;
- `.cursor/rules/boffin-*.mdc` contains Cursor's routed rules.

Adapters deliver the contract; architectural knowledge stays in `packs/`.
Installed Cursor rules point to `.boffin/packs/`, while the repository's own
rules use root-relative `packs/` paths for self-hosting.

## Profiles

Boffin exposes `lite`, `full`, and `max`; `full` is the default. Profiles tune
ambition and cleanup pressure only. Every profile loads the complete canonical
contract and retains the same S00–S03 invariants, EXCLUDES, trust-boundary
validation, data-loss prevention, security, and accessibility floor.

There is no `off` profile. Disable or uninstall the integration when it should
not run.

## Repository layout

```text
README.md               Public product and install surface
docs/engine.md          This technical engine guide
assets/                 Product and social artwork
package.json            npm metadata for boffinit
bin/ and lib/           boffinit installer (Cursor + OpenCode) entry and impl
docs/opencode.md        OpenCode install / commands / troubleshooting
hooks/ and skills/      Shared Claude Code / Codex runtime surfaces
.claude-plugin/         Claude marketplace and plugin manifests
.codex-plugin/          Codex plugin manifest
packs/                  ParselFire Core indexes, leaves, and human guides
  universal/            Language-independent guidance
  python-architecture/  Python-specific guidance
  cpp-architecture/     C++-specific guidance
examples/               Reproducible before/after evidence
spec/                   Public pack and URF profile specifications
scripts/                Pack, adapter, and signature validators
signatures/             Detached-signature process and public keys
external/               Third-party and community pack contribution area
```

## Validation and signatures

Run the structural checks from the repository root after changing packs or
adapters:

```sh
python scripts/pack_lint.py
python scripts/check_adapter_copies.py
```

The first validates pack structure, numbering, ordering, and references. The
second checks that static host adapters match the canonical `AGENTS.md`
contract.

ParselFire Core also has a detached-signature release surface. After release
pack files have been signed, verify the mirrored signatures with:

```sh
python scripts/pack_signatures.py verify --target-dir packs --quiet-success
```

Signature generation and release-time status are documented in
[signatures/README.md](../signatures/README.md). A signature proves which bytes
were signed; it does not replace review of the guidance itself.

## Evidence

The evidence pages include the target, loaded guidance, diff statistics, tests,
and reproduction outline:

- [C++ evidence](../examples/before-after-cpp.md): DuckDB `+17 / -17`, 2,104
  assertions across 8 test files, with distinct continuation and recovery paths
  preserved.
- [Python evidence](../examples/before-after-python.md): FastAPI `+16 / -33`
  with 49 tests and no public API change; LangChain with its sync/async boundary
  preserved and 4 tests.

These are guided case studies, not controlled A/B experiments and not claims of
token, cost, or speed gains.

## Make the routing visible

For an auditable run, ask the agent to report the stages and constraints it
actually used, together with the evidence for each one:

```text
Work in this repository on the requested scope.
Before editing, walk the relevant ParselFire Core stages in order, checking EXCLUDES first.
After the change, report only the constraints that materially affected the result and the external check that proved each edit.
```

That report should point to concrete code anchors and checks. Merely listing
kernel ids is not evidence that the guidance mattered.

## Formats and contributions

- [Kernel pack schema](../spec/kernel-schema.md)
- [URF profile](../spec/urf-profile-kernels.md)
- [Contribution workflow](../CONTRIBUTING.md)
- [External pack expectations](../external/README.md)
- [Signing and verification](../signatures/README.md)

ParselFire Core and Boffin are released under the repository's
[MIT License](../LICENSE).
