<p align="center">
  <img src="logo.png" alt="ParselFire logo" width="200">
</p>

<h1 align="center">ParselFire</h1>

<p align="center">Portable architectural guardrails for AI coding agents.</p>

<p align="center">
  <a href="#evidence">Evidence</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#make-the-effect-visible">Make The Effect Visible</a> •
  <a href="#how-it-works-under-the-hood">How It Works</a>
</p>

AI agents write code fast but forget your architecture between sessions. They
duplicate logic you deliberately extracted, flatten special cases you preserved
on purpose, and drift away from boundaries that took months to establish.
Larger context windows do not fix this — they give the agent more text, not
more understanding.

ParselFire is a small set of focused guidance files that activate only when
relevant. Instead of one giant rules dump the agent ignores, it loads a small
routed read set, walks architectural stages from S00 through S06, and checks
earlier-stage correctness before later-stage cleanup or DRY work — then audits
the result against those same constraints after the edit.

## Evidence

Tested on real open-source repositories, not toy examples:

| repo | change | result |
|------|--------|--------|
| **FastAPI** (75k stars) | collapsed duplicated auth parsing in `fastapi/security/http.py` | `+16 / -33`, 49 tests pass, no API change |
| **LangChain** (100k stars) | extracted shared retry bookkeeping in `runnables/retry.py` | `+97 / -67`, 4 tests pass, sync/async boundary preserved |

In both cases, the agent avoided the mistakes it would normally make:
no speculative abstractions, no flattened special cases, no merged sync/async
paths.

Full write-ups with diffs, test output, and constraint traceability:

- [before/after evidence (Python)](examples/before-after-python.md)

## How It Differs From `AGENTS.md`

`AGENTS.md` tells an agent how to work in your repository — build commands,
test commands, code style, workflow conventions.

ParselFire teaches an agent what not to break — architectural boundaries,
lifecycle invariants, domain-specific constraints that outlive any single task.

| | `AGENTS.md` | ParselFire |
|--|-------------|------------|
| scope | workflow and style | architectural boundaries |
| loaded | everything, always | small routed read set, widened by stage when review needs it |
| portable | yes | yes — same packs work across 10+ agent hosts |
| auditable | no | yes — explicit stage walk, external checks, and post-edit review |

## Works With Your Agent

Pick whichever surface your host already reads:

| host | file |
|------|------|
| Cursor | `.cursor/rules/` (routed, automatic) |
| Claude Code | `CLAUDE.md` |
| Codex, Aider, Zed, CodeWhale | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurf/rules/parselfire.md` |
| Cline | `.clinerules/parselfire.md` |
| Kiro | `.kiro/steering/parselfire.md` |
| Gemini CLI / Antigravity | `gemini-extension.json` |

All adapters point at the same underlying guidance. The architectural
knowledge lives in `packs/`; the per-host files are thin delivery surfaces.

## Quick Start

```text
git clone <parselfire-repo-url>
cd parselfire
git clone <your-project-url> .repos/target
```

**Cursor** (automatic routing):

1. Open `parselfire/` as the workspace root.
2. Ask the agent to work inside `.repos/target/`.
3. Rules load the relevant guidance automatically, keep focused changes in
   scope, and widen into a two-pass audit for open-ended refactors or reviews.

**Other hosts**:

1. Copy the matching file from the table above into your project.
2. Put (or symlink) the `packs/` folder where the agent can read it.
3. The instruction file tells the agent to load relevant packs before writing
   code and re-audit the touched result afterward.

## Make The Effect Visible

It is not always obvious whether a good architectural catch came from the agent's
base model or from ParselFire's loaded constraints.

To make ParselFire's contribution visible, ask the agent not only to review or
refactor your code, but also to explicitly report which stages and constraints
it applied during the work.

Example prompt:

```text
Work in this repository and analyze modules A, B, and C for compliance with their architectural invariants.
Walk ParselFire stages S00-S06 in order and give me a compact list of which stages and kernels you applied during the analysis and why each one was relevant.
```

That makes the result auditable: you see not just the issues the agent found,
but which architectural kernels were active and why they helped surface those
issues.

## What Ships In v0

- **3 guidance families**: universal, Python, and C++ — covering lifecycle,
  concurrency, shared abstractions, async boundaries, ownership, and more
- **10+ host adapters**: thin instruction files for every major agent runtime
- **Format specification**: [spec/kernel-schema.md](spec/kernel-schema.md) and
  [spec/urf-profile-kernels.md](spec/urf-profile-kernels.md)
- **Zero-dependency validator**: [scripts/pack_lint.py](scripts/pack_lint.py)
  plus [scripts/check_adapter_copies.py](scripts/check_adapter_copies.py)
  for adapter-drift detection
- **Real evidence**: [examples/before-after-python.md](examples/before-after-python.md)
- **Signature scaffolding**: [signatures/README.md](signatures/README.md)

v0 is deliberately small: focused guidance packs, local validation, and
reproducible evidence. No dependencies, no hosted services, no API keys.

## How It Works Under The Hood

Each guidance family has a thin index and several leaf files. The agent
selects a primary leaf per family from the active code context — file type,
directory, and domain hints — then uses the universal stage pipeline to decide
what to check first. Each `## LEAVES` entry also declares `stages=`, so once
the agent knows which stage it is walking it can load the exact leaf set for
that stage directly from the index instead of searching the repository for a
matching K id.

For a focused coding task, the agent usually reads:

- one universal index
- one primary universal leaf for the seam it is working on
- any additional universal leaves whose `stages=` are required by the stages it
  actually walks
- when the seam is a late-stage refactor (S04-S06), at least one early-stage
  correctness leaf (S01-S03), plus any other leaves required to complete that
  early stage, as a rejection filter
- zero or one language-family index + zero or more language leaves required by
  the same walked stages
- total: still a small routed read set, not the entire repository

For an open-ended refactor, review, or compliance pass, the agent widens the
read surface to one leaf per stage-family the file's mechanics actually touch
across S01-S05, because review needs width rather than a single seam.

While reasoning, the agent walks stages S00-S06 in order. At each stage it
checks matching `X` entries first as rejection filters and matching `K` entries
second as positive guidance. Earlier stages override later ones on conflict.
For focused coding, the 3-5 entry budget applies only to the entries the agent
materially acts on after the stage walk; it is not a cap on the walk itself.
For refactor or review work, the agent should first build stage-scoped
findings, then apply and verify them one by one.

After making an edit, the agent re-reads the loaded constraints, runs the
narrowest external check that proves the change, and reviews the final touched
region against those constraints. Mismatches are flagged immediately,
including cases where a later-stage cleanup would weaken an earlier-stage
invariant.

This keeps the attention cost low while making the guidance falsifiable —
every claimed constraint must be grounded in the actual change and its
verification, not just cited aspirationally.

## The "Let Them Copy" Doctrine

If you are building an AI agent platform, an IDE, or an enterprise coding tool: **you should copy this approach.**

The industry cannot solve architectural drift by throwing larger context windows at the problem. Agents need focused invariants, loaded exactly when a design decision is being made, and verified against the resulting change with real checks.

ParselFire is the open runtime for this paradigm. Whether you use ParselFire directly or build your own version of routed guardrails, the architecture of AI coding tools must move in this direction. Copying is encouraged.

## Repository Layout

```text
packs/                Architectural guidance — family indexes + leaf files
  universal/          Language-agnostic constraints (lifecycle, abstractions, ...)
  python-architecture/  Python-specific (async boundaries, import structure, ...)
  cpp-architecture/   C++ (ownership, concurrency, RAII patterns, ...)
examples/             Before/after evidence from real refactors
spec/                 Public format specification
scripts/              Zero-dependency validators
signatures/           Signing scaffolding and public keys
external/             Third-party / community packs (contribution area)
.cursor/rules/        Cursor-specific activation rules
AGENTS.md             Portable instruction contract (canonical)
CLAUDE.md             Claude Code adapter
.github/              GitHub Copilot adapter
.windsurf/            Windsurf adapter
.clinerules/          Cline adapter
.kiro/                Kiro adapter
.agents/              Generic workspace-rule adapter
gemini-extension.json Gemini / Antigravity manifest
VERSION               Release marker
```

## Validation

Run before committing changes to guidance or adapter files:

```text
python scripts/pack_lint.py
python scripts/check_adapter_copies.py
```

The first script validates guidance structure (numbering, ordering, cross-
references). The second ensures all host adapters stay in sync with the
canonical `AGENTS.md` contract.

If you changed shipped `packs/*.urf.md` surfaces, also run:

```text
python scripts/pack_signatures.py verify --target-dir packs --quiet-success
```

## Contributing

- Format rules: [spec/kernel-schema.md](spec/kernel-schema.md)
- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- External pack expectations: [external/README.md](external/README.md)
- Signing and verification: [signatures/README.md](signatures/README.md)

## License

MIT
