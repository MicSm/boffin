# Contributing to ParselFire

ParselFire accepts improvements to the public pack surface, format docs, and
release tooling. The repository is intentionally small, so contribution quality
matters more than contribution volume.

## What Belongs Here

Good fits for this repository:

- public architectural guidance that can safely live in an OSS pack
- routing and leaf-shape improvements that reduce runtime ambiguity
- spec clarifications in `spec/`
- validator and release-tooling improvements that match the live pack
  architecture
- evidence docs that show real before/after outcomes on public code

Not good fits:

- non-public code, docs, or operational details
- literal reuse from non-public source surfaces
- secrets, credentials, or anything that should not ship in a public repo
- architecture guidance that cannot stand on its own in a public pack surface

## Core Repository Surfaces

- `packs/` contains maintainer-shipped pack families and leaf packs.
- `AGENTS.md` is the canonical portable instruction contract.
- `external/` is reserved for third-party or community-maintained packs.
- `spec/` defines the public record format and file shapes.
- `signatures/` contains maintainer and contributor public verification keys.
- thin host adapters live under `CLAUDE.md`, `.github/`, `.windsurf/`,
  `.clinerules/`, `.kiro/`, `.agents/`, and `gemini-extension.json`

Read these first:

- `spec/kernel-schema.md`
- `spec/urf-profile-kernels.md`
- `AGENTS.md`
- `external/README.md`
- `signatures/README.md`

## Editing Core Packs

When changing files under `packs/`:

1. Keep `pack.urf.md` thin. Put K/X density in leaf files, not in the family
   index.
2. Keep one distinct architectural idea per K or X line when possible.
3. Preserve mirror numbering: `K17` and `X17` should describe the same theme
   from positive and negative sides.
4. Keep leaf records sorted by `stage` first and id second.
5. Keep exact `signals=` tokens unique within one family index.
6. Keep universal `S` `refs=` and language-family `SR` `refs=` complete and
   sorted whenever a K entry is added, removed, or re-staged. Keep each
   `## LEAVES` `stages=` equal to the set of stages its leaf's kernels occupy.
   A leaf file missing from `## LEAVES` is a structural error because stage
   resolution depends on that registry.
7. Use stable architectural nouns in `scope=`; avoid transient file and helper
   names unless they define a durable boundary.
8. Keep public packs portable. If a pattern is too domain-specific or too
   sensitive for the shipped core families, move it out of the core surface.
9. Treat pack index changes, matching public docs/spec updates, extractor
   protocol updates, and detached signatures as one maintenance transaction when
   stage refs change.

## Editing Portable Adapters

When changing `AGENTS.md`, `gemini-extension.json`, or host-specific adapter
files:

1. Treat `AGENTS.md` as the canonical instruction-tier source.
2. Keep copy-based adapters byte-aligned with `AGENTS.md` except for
   host-required wrapper text such as frontmatter.
3. Keep manifest-only adapters as pure pointers to `AGENTS.md`; do not add
   host-specific routing or hook logic there.
4. Keep semantic routing knowledge in `packs/` and the shared portable contract
   rather than diverging per host.
5. Run `python scripts/check_adapter_copies.py` before opening a PR.

## Adding Or Changing Families

If you add a new core family under `packs/`:

- choose a short stable id prefix for that family
- update `scripts/pack_lint.py` so the validator knows the family prefix
- add or update the relevant `.cursor/rules/*.mdc` activation rules if the
  family should participate in runtime routing
- keep `## STAGES` only in `packs/universal/pack.urf.md`
- use `## STAGE-REFS` on non-universal family indexes if the family contributes
  K ids to the shared universal stage pipeline

If you add a new leaf:

- register it in the family's `## LEAVES` with a `stages=` listing the stages
  its kernels occupy
- add at least one matching `R##` route in `## ROUTING`
- keep route signals short, literal, and present in the target leaf
- add the new K id to the appropriate stage refs line (`S##` for universal,
  `SR##` for language families)

## Validation Before You Open A PR

Run:

```text
python scripts/pack_lint.py
python scripts/check_adapter_copies.py
```

The current validator checks the core `packs/` tree, including stage refs and
universal directives. If your contribution also touches documentation, make
sure README links, file-layout references, and format examples still match the
tracked repository.

## Versioning For Now

- the root `VERSION` file is the canonical release number for this repository
- bump `VERSION` manually when cutting a release or release candidate
- CI automation is intentionally deferred until after the initial OSS release
- until CI exists, run `python scripts/pack_lint.py` locally for pack-surface or
  validator changes
- run `python scripts/check_adapter_copies.py` locally for `AGENTS.md`,
  host-adapter, or manifest changes

## External Packs

Third-party packs should live under `external/<pack-name>/` and follow the same
index and leaf format as the core packs.

Before an external pack is accepted:

- the pack must be public-safe and free of non-public source material
- each shipped `*.urf.md` surface must have a detached signature
- the contributor's public key must be published under `signatures/pubkeys/`
- the pack must match the format in `spec/`

The current validator is focused on the core `packs/` tree, so external packs
may receive additional manual review until external-surface validation is
expanded.

## Pull Request Checklist

Before submitting a PR, make sure:

- the change matches the live routed-pack architecture
- `python scripts/pack_lint.py` passes if you touched `packs/` or validator code
- `python scripts/check_adapter_copies.py` passes if you touched `AGENTS.md`,
  host adapters, or manifest surfaces
- new routing signals stay unique inside the edited family
- new K/X records are mirrored and stage-sorted
- any changed stage placement also updates the matching `refs=` or `SR` line
  and the target leaf's `## LEAVES` `stages=`
- public docs do not describe superseded runtime paths as if they were active
- public docs do not claim plugin, hook, or slash-command behavior that is not
  actually implemented and manually exercised
- any new shipped pack surfaces include or update their detached signatures when
  applicable
