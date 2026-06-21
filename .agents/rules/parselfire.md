# ParselFire Portable Routing Contract

ParselFire gives AI coding agents a small routed set of architectural guardrails
instead of one large always-on rules dump.

## Default Workflow

First match scope to the task, then pick the path:

- Focused change (the operator asked for a specific function, fix, or feature):
  stay inside that scope. Make only the change requested, apply the stage
  guidance to what you touch, and prove it with a check. Do not scan the whole
  file or build a file-wide ledger; turning a scoped coding task into a
  file-wide refactor breaks the task boundary and gets rejected.
- Open-ended refactor, cleanup, or review of existing code: run the two-pass
  audit below, scoped to what the task covers.

Two-pass audit (refactor / review / cleanup). Never fix while you are still
searching; the first strong improvement you find is not the finish line.

Pass 1, Audit (read-only). Read the target across the task's scope. Walk stages
S00 upward and emit a findings ledger that covers every in-scope stage,
including stages with nothing to change. Do not edit anything in this pass. Use
one row per finding:

`path | stage | status | id | kernel | anchor | check`

Columns: `path` the file touched; `stage` the S00-S06 stage; `status` `todo`,
`done`, or `skip`; `id` the kernel id; `kernel` what it requires in one phrase;
`anchor` the concrete code location the finding rests on; `check` the test or
lint that proves it.

- `status` is one of `todo`, `done`, `skip`, and every `skip` carries a reason.
- Record every fix you name while auditing as its own row with all fields
  filled, and resolve it as `done` or `skip:<reason>`; never leave a fix you
  mentioned in reasoning off the ledger.
- `skip:clean` means Pass 1 found nothing on that stage; every in-scope stage
  still gets a row, never an omitted one.
- A finding you deliberately will not act on is `skip:<reason>` whose reason
  names the blocking kernel (for example, keeping a genuine special case instead
  of flattening it), never `skip:clean`.
- A row recorded as `todo` resolves only to `done` (with its check) or
  `skip:<reason>`; never downgrade a `todo` to `skip:clean`.

Pass 2, Apply. Drain the ledger one row at a time: make the single edit, run the
narrowest check that proves it (a test or a lint), then mark the row `done` with
how it was checked. Do not batch unrelated findings into one sweep.

The task is complete only when every ledger row is `done` or `skip` and the
checks are green, not when the first improvement lands.

Minimalism still governs what you ADD (no speculative abstractions, no
unrequested files, prefer the simplest correct change), but it never licenses
dropping a stage, a trust-boundary validation, data-loss prevention, security,
or accessibility. Non-trivial logic leaves one minimal runnable check behind.

## Stage Pipeline

Walk stages from S00 upward when reasoning about code changes. Earlier stages
override later ones on conflict. At each stage, inspect matching EXCLUDES first
as a rejection filter, then matching KERNELS as positive guidance. Use the
universal stage `refs=` and the loaded language-family `## STAGE-REFS` to know
which K ids belong to the current stage. Each `## LEAVES` record declares the
`stages=` it carries; to cover the current stage, load every leaf whose
`stages=` includes it. Stage-to-leaf resolution is a direct index lookup, never
a filesystem search.

- S00 scope: stay within requested scope and keep blast radius low
- S01 invariants: prove exact invariants, preserve true special cases, obey contracts
- S02 state modeling: make meaningful states explicit, keep distinct outcomes distinct
- S03 lifecycle: centralize mutable state, clarify ownership, rebuild atomically
- S04 shared abstractions: extract shared invariants only after semantics are clear
- S05 boundaries: make subsystem boundaries explicit, thread semantics end to end
- S06 convergence: converge broadly, remove displaced layers

When a task touches code:

1. Load `packs/universal/pack.urf.md`.
2. Detect the active source family from the file being changed:
   - Python: also load `packs/python-architecture/pack.urf.md`
   - C++: also load `packs/cpp-architecture/pack.urf.md`
   - Plain C: stay on universal only
   - Ambiguous `.h`: use the C++ family only when the file contains C++
     constructs
3. Treat each loaded `pack.urf.md` as a routing index, not as the dense
   guidance body.
4. From each loaded `## ROUTING`, match `signals=` against the active code
   context to select your primary leaf per family.
5. If your primary signal match is a late-stage refactoring leaf (S04-S06), you
   MUST ALSO load at least one early-stage correctness leaf (S01-S03) to serve
   as your rejection filter; pick it from `## LEAVES` by choosing a leaf whose
   `stages=` includes the early stage your code's mechanics touch.
6. To cover a stage whose `refs=` ids are not in your loaded leaves, read
   `## LEAVES` and load every leaf whose `stages=` includes that stage; resolve
   coverage from the index, not by searching the `packs/` directory.
7. Consult X entries first at the current stage, then K entries, before
   proceeding to later stages.
8. Apply the guidance semantically. Never paste pack text verbatim into code or
   comments.

## Pre-Flight Review

- Re-read the loaded pack index and all loaded leaf packs; do not rely on
  memory.
- For a focused change, confirm you stayed within the requested scope and proved
  the change with a check; the ledger checks below apply to refactor/review tasks.
- For a refactor/review task, confirm the Pass 1 ledger lists a row for every
  in-scope stage; a stage with no row is an incomplete audit, not a clean file.
- Confirm every ledger row is `done` or `skip`, that each `skip` carries a
  reason, and that no row recorded as `todo` was downgraded to `skip:clean`.
- Confirm every fix named in Pass 1 reasoning has its own ledger row; a fix
  discussed but left unrecorded is an incomplete audit.
- If a change touches ownership, lifecycle, completion semantics,
  state-machine transitions, concurrent access, or logic encoded through flags
  or sentinels, name the exact invariant from stages S01-S03 it must preserve
  before editing.
- On user request, render the ledger and the blocking earlier-stage invariants
  as concise ordered bullets in the user's language.

After any code edit:

- Verify the edit with an external check (the narrowest test or lint that proves
  it), not by re-reading your own reasoning or the diff alone.
- Review the change as if a different author wrote it: read the final file
  region, not only the diff, and ask what a fresh reviewer would flag.
- Re-read the relevant leaf pack(s); confirm no `## EXCLUDES` pattern was
  introduced and no earlier-stage (S00-S03) invariant was weakened to satisfy a
  later-stage (S04-S06) cleanup goal.
- A ledger finding may not be silently dropped: it ends as `done` (with its
  check) or `skip:<reason>`; a `todo` is never relabeled `skip:clean`.
- Present the filled ledger as the result; do not add rows for kernels that
  found nothing, and never cite a kernel a row does not actually rest on.

Keep runtime reads focused:

- default read set = `packs/universal/pack.urf.md` + one primary universal leaf
  + any additional universal leaves whose `stages=` are required by the stages
  you actually walk + zero or one language-family index + zero or more language
  leaves whose `stages=` are required by the same walked stages
- for a focused coding change, the 3-5 entry budget is the dose you materially
  apply after walking every loaded stage; it is not a cap on the stage-walk
- use `## LEAVES` `stages=` as the authoritative stage-to-leaf map; do not rely
  on filesystem search to discover which leaf covers a stage
- for a pure review, audit, or compliance task with no single edit seam, widen
  the read surface to one leaf per stage-family the file's mechanics actually
  touch across S01-S05

This file is the canonical portable instruction surface. Thin host adapters
should mirror it without adding host-specific routing semantics.
