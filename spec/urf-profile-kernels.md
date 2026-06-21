# URF Profile for Kernel Packs

This document freezes the minimal URF-flavored profile used by ParselFire family indexes and leaf packs.

## Goals

- human-readable in plain markdown
- cheap to diff and review
- deterministic to parse with zero third-party dependencies
- compact enough that readers and tooling can inspect an index before opening leaf content

## File Shapes

ParselFire uses three compatible file shapes.

### Universal index (`packs/universal/pack.urf.md`)

The universal index carries the shared stage model plus compact routing records.

```text
## STAGES
!PURPOSE|turn loaded kernels into a correctness-first decision pipeline that favors consistent code over flat checklist application
!APPLY|for coding and review|walk stages from S00 upward; at each stage gather the K entries named by this stage's refs plus any loaded family STAGE-REFS for the same stage; consult matching EXCLUDES first as a rejection filter, then KERNELS as positive guidance; earlier stages override later ones on conflict; never weaken an earlier-stage invariant to satisfy a later-stage cleanup or convergence goal
!ANTI|consult EXCLUDES at the current stage before reaching for later-stage refactors
!SHOW|on user request|render the active stages selected K/X entries and blocking earlier-stage invariants as concise ordered plain-language bullets in the user's language
S00|name=scope-and-need|focus=stay within requested scope and keep blast radius low without compromising semantic preservation|refs=UNI-K01;UNI-K02;UNI-K03;UNI-K04

## ROUTING
R01|leaf=foundations.urf.md|signals=smallest,stdlib,dependency,contract,test

## LEAVES
L01|file=foundations.urf.md|theme=scope-contracts|stages=0;1
```

### Family index (`*/pack.urf.md` outside `universal`)

A family index is the compact entry surface for one pack family.

```text
## ROUTING
R01|leaf=core.urf.md|signals=nodiscard,forward,pack,bool,assignment,ellipsis

## LEAVES
L01|file=core.urf.md|theme=language-mechanics|stages=1

## STAGE-REFS
SR01|refs=CPP-K01;CPP-K02;CPP-K03;CPP-K04;CPP-K05;CPP-K06;CPP-K07;CPP-K08;CPP-K09;CPP-K10;CPP-K11;CPP-K12;CPP-K13;CPP-K14;CPP-K15;CPP-K16;CPP-K17;CPP-K18
```

When a family index needs to hand off into another family, it uses the same `R##|pack=...|signals=...` record shape.

### Leaf pack (`*.urf.md` other than `pack.urf.md`)

Leaf packs contain the actual K/X records.

```text
## KERNELS
UNI-K01|stage=0|scope=build-ladder|kernel=before writing code walk the build ladder: not-needed > stdlib > platform > dependency > one-liner > minimum new code

## EXCLUDES
UNI-X01|stage=0|scope=premature-custom-code|violation=do not write new code when an existing primitive or standard mechanism already covers the need
```

## Parsing Rules

- lines starting with `#` define section boundaries and are not records
- lines starting with `<!--` or `-->` are comments and should be ignored
- blank lines are ignored
- record lines are split on `|`
- the first token is `S00`, `SR01`, `R01`, `L01`, a directive such as `!PURPOSE`, or a bare K/X id such as `UNI-K01`
- directive lines beginning with `!` are profile-defined control records and may include positional text segments after the id
- remaining tokens on ordinary records are `key=value` pairs
- unknown sections may exist, but tooling should consume `STAGES`, `STAGE-REFS`, `ROUTING`, `LEAVES`, `KERNELS`, and `EXCLUDES` only when relevant to that file shape

## Normalization Rules

- preserve original field order when rewriting leaf record lines
- preserve leading id tokens exactly
- trim surrounding whitespace around section headings and tokens
- do not wrap record lines across multiple lines
- prefer ASCII punctuation for portability
- keep `signals=` as a comma-separated selector list with no spaces
- keep `refs=` as a semicolon-separated K-id list with no spaces
- keep `stages=` as a semicolon-separated ascending stage list with no spaces
- keep exact `signals=` tokens unique within one family index surface

## Public v0 Constraints

- entries must reference public architectural guidance only
- no non-public infrastructure names or undistributable implementation details
- no literal reuse from non-public source surfaces
- family indexes should stay small enough to review quickly
- the universal index is the canonical stage-pipeline surface and must carry `!PURPOSE`, `!APPLY`, `!ANTI`, and `!SHOW`
- universal `S` records use `focus=` and `refs=` rather than `question=`
- language-family indexes may add `## STAGE-REFS` but should not duplicate `## STAGES`
- `## ROUTING` should use short literal selectors instead of sentence prose
- exact `signals=` tokens should not repeat across `R` records in the same family index
- `## LEAVES` should remain a small registry surface, and each `L` record must carry `stages=` matching its leaf's actual kernel stages
- leaf packs should stay compact enough to keep guidance focused and readable

## Validation

Run the repository validator after editing pack surfaces:

```text
python scripts/pack_lint.py
```

The validator is zero-dependency and checks family-index signal collisions, universal stage directives, universal `S` definitions, family `SR` coverage, `refs=` completeness and sorting, `## LEAVES` `stages=` equality with actual leaf kernel stages, route and leaf references, K/X mirror numbering, and stage/id ordering. It also emits warnings when route signals drift away from their target leaf content and when the always-on stage summary drifts away from the universal `focus=` lines.
