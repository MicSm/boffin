# Kernel Schema

ParselFire stores architectural guidance as a universal stage index plus thin family routers and leaf packs. `packs/universal/pack.urf.md` carries the shared S00-S06 stage model together with stage-walk directives and stage-local `refs=`. Language-family indexes carry compact routing records plus `## STAGE-REFS` that map family-specific K ids onto the shared stages. Leaf packs hold the actual K/X records that the agent selects from at runtime.

## Surface Types

Each pack family directory uses this shape:

```text
packs/
  universal/
    pack.urf.md          # shared stage + routing index with directives + refs
    foundations.urf.md   # leaf pack
    lifecycle.urf.md     # leaf pack
```

### Family index (`pack.urf.md`)

A family index is the runtime entry surface for one pack family. It should stay small and contains compact routing records rather than prose hints.

- `packs/universal/pack.urf.md` contains `## STAGES`, `## ROUTING`, and `## LEAVES`
- other family indexes contain `## ROUTING`, `## LEAVES`, and `## STAGE-REFS`
- a family index may omit `## KERNELS` and `## EXCLUDES` when it is purely a router surface

### Leaf pack (`*.urf.md` other than `pack.urf.md`)

A leaf pack contains the actual guidance records. Leaf packs use:

- `## KERNELS` for positive guidance
- `## EXCLUDES` for mirrored violations

## Record Shape

Kernel and exclusion entries are single logical lines of pipe-separated fields:

```text
UNI-K01|stage=0|scope=build-ladder|kernel=before writing code walk the build ladder: not-needed > stdlib > platform > dependency > one-liner > minimum new code
CPP-X22|stage=3|scope=deferred-guard-arm|violation=do not create an empty RAII owner and arm it only after later work can throw or allocate
```

Each line contains:

- a leading id token: namespaced stable alias for compact reference and K/X pairing
- `stage`: integer stage in the `0..6` range
- `scope`: short kebab-case retrieval label
- `kernel` or `violation`: the guidance text itself

The section heading (`## KERNELS` or `## EXCLUDES`) still determines the entry kind. The leading id token is the compact alias; `scope` remains the primary semantic retrieval key.

## Required Fields

### Kernel entries (under `## KERNELS`)

- leading id token
- `stage`
- `scope`
- `kernel`

### Exclusion entries (under `## EXCLUDES`)

- leading id token
- `stage`
- `scope`
- `violation`

### Stage directives (under `## STAGES`)

The universal stage surface starts with profile directives that explain how the
stage pipeline is used at runtime:

```text
!PURPOSE|turn loaded kernels into a correctness-first decision pipeline that favors consistent code over flat checklist application
!APPLY|for coding and review|walk stages from S00 upward; at each stage gather the K entries named by this stage's refs plus any loaded family STAGE-REFS for the same stage; consult matching EXCLUDES first as a rejection filter, then KERNELS as positive guidance; earlier stages override later ones on conflict; never weaken an earlier-stage invariant to satisfy a later-stage cleanup or convergence goal
!ANTI|consult EXCLUDES at the current stage before reaching for later-stage refactors
!SHOW|on user request|render the active stages selected K/X entries and blocking earlier-stage invariants as concise ordered plain-language bullets in the user's language
```

The current public profile requires exactly these four directives in
`packs/universal/pack.urf.md`.

### `S` entries (under `## STAGES`)

Stage definitions are metadata lines used to document the decision pipeline:

```text
S00|name=scope-and-need|focus=stay within requested scope and keep blast radius low without compromising semantic preservation|refs=UNI-K01;UNI-K02;UNI-K03;UNI-K04
S01|name=contracts-and-invariants|focus=prove exact invariants preserve true special cases and obey safety-critical contracts|refs=UNI-K05;UNI-K06;UNI-K07;UNI-K08;UNI-K09;UNI-K10;UNI-K11;UNI-K12;UNI-K13;UNI-K14;UNI-K15;UNI-K38
```

Required fields:

- id (`S00`-`S06`)
- `name`
- `focus`
- `refs`

Stage ids keep their numeric prefix because the number carries ordinal meaning. In the current profile, `S` entries live only in `packs/universal/pack.urf.md`.

`focus=` is the canonical runtime summary for the stage. `refs=` is a
semicolon-separated list of all universal `K` ids that belong to the stage,
sorted by numeric suffix.

### `SR` entries (under `## STAGE-REFS`)

Language-family indexes map their own K ids onto the shared universal stages:

```text
SR03|refs=PY-K05;PY-K06;PY-K07;PY-K08;PY-K09;PY-K10;PY-K11;PY-K28
```

Required fields:

- id (`SR00`-`SR06`)
- `refs`

Conventions:

- `SR` ids match the numeric suffix of the universal stage they augment
- `refs=` is a semicolon-separated list of family-local K ids sorted by numeric suffix
- a family may omit an `SR` line for stages where it has no kernels
- every K id in a non-universal family must appear in exactly one `SR` record

### `R` entries (under `## ROUTING`)

Routing records point to leaf files and crossover targets:

```text
R01|leaf=foundations.urf.md|signals=smallest,stdlib,dependency,contract,test
```

Use `pack=` only when an index needs to hand off into another family index; the record shape stays the same.

Required fields:

- id (`R01`, `R02`, ...)
- exactly one of `leaf` or `pack`
- `signals`

Conventions:

- `signals` is a comma-separated list of short literal selectors
- use concrete selectors, not sentence prose
- keep each exact signal token unique within one family index surface
- keep local leaf routes before cross-family routes when both exist
- keep `R` numbering dense and ascending within one index surface unless a profile explicitly reserves another range

### `L` entries (under `## LEAVES`)

Leaf registry records stay small and human-readable:

```text
L01|file=foundations.urf.md|theme=scope-contracts|stages=0;1
```

Required fields:

- id (`L01`, `L02`, ...)
- `file`
- `theme`
- `stages`

`stages=` is a semicolon-separated, ascending list of the stages the leaf's
kernels actually occupy. It is the in-index `stage -> leaf` map: to cover stage
`N` during the stage walk, load every leaf whose `stages=` includes `N`, instead
of searching the filesystem for a `refs=` id. A leaf's `stages=` must equal the
exact set of stages present among its `K` records; the validator enforces this
equality so the map can never silently drift from leaf content.

## ID Conventions

K/X ids are unique across families by namespace prefix:

- `UNI-K01`, `UNI-X01` for `universal`
- `CPP-K17`, `CPP-X17` for `cpp-architecture`
- `PY-K08`, `PY-X08` for `python-architecture`

Conventions:

- future families should choose a short stable namespace prefix when introduced
- K/X mirror pairs should share the same numeric suffix
- numeric suffixes should stay unique within a family
- family prefixes should stay stable even when entries move between leaf files
- `R` and `L` ids only need to stay unique within one index surface

## Controlled Conventions

- `stage` must be a base-10 integer from `0` to `6`
- `scope` should be a short retrieval key, not a sentence
- `signals` should use lowercase literal selectors separated by commas with no spaces
- exact `signals` tokens must not repeat within one family index surface
- `theme` should be a short stable label, not a paragraph
- a given `scope` should normally appear once per family and may appear on up to 5 entries within one family when several facets need separate statements
- prefer one distinct architectural theme per entry
- use stable architectural nouns, not transient file or function names, unless those names define a durable boundary
- keep guidance text concise and directly actionable
- prefer one idea per line; if a line carries two independent norms, split it into two K/X pairs or move supporting detail into docs/examples

## Referencing Entries

When citing entries in summaries, audits, or reasoning, prefer `pack/scope`:

```text
universal/shared-invariant-extraction
python-architecture/native-sync-async-paths
cpp-architecture/raii-guard-ownership-move
```

Use K/X ids when compact pairing matters in discussion or review:

```text
CPP-K17 / CPP-X17
```

## Sections

Leaf packs should be organized with these markdown headings:

```text
## KERNELS
## EXCLUDES
```

Family indexes should be organized with these markdown headings:

```text
## ROUTING
## LEAVES
```

The universal index additionally carries:

```text
## STAGES
```

Language-family indexes additionally carry:

```text
## STAGE-REFS
```

`## STAGES` lives only in `packs/universal/pack.urf.md`. `## STAGE-REFS`
belongs on non-universal family indexes that contribute family-local K ids to
the shared stage pipeline.

## Compatibility Notes

- the first token on K/X, S, and SR lines is a bare id token, not a keyed field
- directive lines beginning with `!` are profile-defined control records rather than `key=value` entries
- unknown key-value pairs should be preserved by tooling
- tooling must ignore blank lines and markdown comments
- tooling may treat `pack.urf.md` as an index surface and leaf `*.urf.md` files as individually loadable packs
- tooling may treat `## ROUTING` as the primary selection surface, `## LEAVES` as a compact registry plus stage-to-leaf map, and `## STAGE-REFS` as the family-local augmentation of the universal stage walk
- future fields may extend entries without changing the base separator format

## Validation

The repository ships with a zero-dependency validator:

```text
python scripts/pack_lint.py
```

It enforces exact signal uniqueness within each family index together with universal stage directives, universal `S` definitions, family `SR` coverage, `refs=` completeness and sorting, `## LEAVES` `stages=` equality with actual leaf kernel stages, route targets, leaf registry references, K/X mirror numbering, and stage-sorted leaf ordering. It also emits warnings when a route signal drifts away from its target leaf or when the always-on stage summary drifts away from the canonical universal `focus=` lines.
