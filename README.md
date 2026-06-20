<p align="center">
  <img src="logo.png" alt="ParselFire logo" width="200">
</p>

<h1 align="center">ParselFire</h1>

<p align="center">Portable architectural guardrails for AI coding agents.</p>

AI agents write code fast but forget your architecture between sessions. They
duplicate logic you deliberately extracted, flatten special cases you preserved
on purpose, and drift away from boundaries that took months to establish.
Larger context windows do not fix this — they give the agent more text, not
more understanding.

ParselFire is a small set of focused guidance files that activate only when
relevant. Instead of one giant rules dump the agent ignores, it loads 3–5
architectural constraints at the moment a design decision is being made —
then audits the result against those same constraints after the edit.

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
| loaded | everything, always | 3–5 relevant constraints per task |
| portable | yes | yes — same packs work across 10+ agent hosts |
| auditable | no | yes — post-edit diff check against loaded constraints |

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
3. Rules load the relevant guidance automatically and audit the diff
   after each edit.

**Other hosts**:

1. Copy the matching file from the table above into your project.
2. Put (or symlink) the `packs/` folder where the agent can read it.
3. The instruction file tells the agent to load relevant packs before
   writing code and re-check the diff afterward.

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
selects which leaf to read based on keyword signals in the current task
context — file type, directory, domain hints.

For a typical task, the agent reads:

- one universal index + one matching universal leaf
- zero or one language-family index + zero or one language leaf
- total: 3–5 focused constraints, not the entire repository

After making an edit, the agent re-reads the loaded constraints and checks
the diff against them. Mismatches are flagged immediately.

This keeps the attention cost low while making the guidance falsifiable —
every claimed constraint must be demonstrably satisfied by the actual diff.

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

## Contributing

- Format rules: [spec/kernel-schema.md](spec/kernel-schema.md)
- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- External pack expectations: [external/README.md](external/README.md)
- Signing and verification: [signatures/README.md](signatures/README.md)

## License

MIT
