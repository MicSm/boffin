# C++ Before/After Evidence

This note summarizes a guided refactoring experiment against a real C++ project
cloned under `.repos/`: DuckDB, an analytical in-process SQL database
(~39k stars). It uses the current live pack surfaces and fresh verification
gathered in this session rather than historical notes.

The point of this example is not the cleanup. **It is the catastrophe the agent refused to cause.** The target is DuckDB's parallel execution engine—a high-stakes concurrency surface. The request was a classic AI trap: *"Make it more DRY and remove redundant checks."*

Without guardrails, AI tools "clean up" C++ by silently erasing the exact invariants that prevent deadlocks. Here is how ParselFire Core stopped it.

## DuckDB: `src/parallel/pipeline_executor.cpp`

Repo: <https://github.com/duckdb/duckdb>
Refactor branch: `refactor-pipeline_executor` on the fork
<https://github.com/MicSm/duckdb> (commit `a1b3ffc97f`).

### Before

`PipelineExecutor` drives a query pipeline across worker threads. To a naive AI (or a junior developer), the file looks like a minefield of copy-pasted code waiting to be DRY'ed:

- Four `BLOCKED` / `INTERRUPTED` return paths (source, sink, next-batch, combine) repeat a nearly identical shape.
- Two `FinishSource` calls look completely redundant.
- The batch-index initialization block is copy-pasted verbatim in the constructor and in `Reset()`.

A standard LLM eagerly merges these. But doing so destroys the state machine.

### Loaded guidance

Loaded `packs/universal/pack.urf.md` and `packs/cpp-architecture/pack.urf.md`.
Because the request is a late-stage DRY refactor (S04) of a parallel executor,
the read set was widened across the early-stage correctness leaves the code
actually touches, and stages S00-S06 were walked before any edit:

- `packs/universal/control-flow.urf.md` (S01-S02)
- `packs/universal/lifecycle.urf.md` (S03)
- `packs/universal/shared-abstractions.urf.md` (S04)
- `packs/cpp-architecture/concurrency.urf.md` (S01/S03)
- `packs/cpp-architecture/lifecycle.urf.md` (S03)
- `packs/cpp-architecture/state-modeling.urf.md` (S02)

### The Fixes Applied

Instead of breaking the file, the agent used the stage-walk to find real bugs:

- **Caught a cross-execution liveness bug (`UNI-K23`):** The agent noticed `Reset()` cleared every per-execution flag *except* `source_profiling_finalized`. A reused executor would start its next run with a stale flag, skipping profiling on early LIMIT termination. The agent added the missing reset.
- **Removed dead state (`UNI-K16`):** Deleted `exhausted_source` which was written but never read, relying purely on the true `exhausted_pipeline` latch.
- **Safe invariant extraction (`UNI-K24`):** Extracted the *actually* safe duplication (the batch-index setup) into a single `InitializeLocalSinkPartitionInfo()` helper, preserving its critical `D_ASSERT` preconditions.

### The Catastrophes Avoided (Guard rails kept intact)

This is what happens when you load architectural constraints *before* generating code. The agent refused to make the destructive edits:

- **Refused to collapse thread-suspension states (`UNI-X08` / `UNI-K18`):** An unguided LLM merges the four `BLOCKED` / `INTERRUPTED` paths because they look the same. ParselFire Core stopped it, recognizing that returning `SinkNextBatchType::BLOCKED` versus `OperatorResultType::BLOCKED` persists completely different thread continuation flags (`next_batch_blocked` vs `remaining_sink_chunk`). Flattening them would cause silent pipeline hangs and deadlocks.
- **Refused to merge lifecycle overloads (`UNI-K08`):** The two `FinishSource` calls were left alone. The agent verified they encode different active-operator contracts depending on whether a `StartOperator` lock bracket is active.
- **Preserved cross-thread visibility (`CPP-K02` / `CPP-K26`):** The agent explicitly refused to "simplify" synchronization, citing the rule that cross-thread global state must stay behind its `annotated_mutex`, while per-executor flags must remain instance-owned.
- **Preserved explicit thread detaching (`CPP-X28`):** The debug-only `thread.detach()` blocks were flagged but deliberately kept because the agent identified them as isolated async test scaffolding (`#ifdef DUCKDB_DEBUG_ASYNC_SINK_SOURCE`).

### After

`pipeline_executor.cpp` has one shared batch-index helper, one fewer dead field,
and a `Reset()` that fully restores execution state. Every distinct interrupt,
profiling, and output path that the file relied on is still explicit.

### Why better

- We prevented a catastrophic breakage of the execution engine.
- The one genuinely duplicated invariant (batch-index setup) now lives in one place instead of two.
- A dead state field is gone, and a reused executor no longer carries a stale profiling flag into its next run.
- The interrupt-recovery special cases stayed explicit instead of being flattened into a fake generic path.
- The change stayed local to one file pair, with no public API change, and deleted as much as it added.

### Verification

- build: configured and built with MSVC 19.44 (Visual Studio 2022 Community) +
  CMake/Ninja, `Debug`; the parallel translation unit that contains
  `pipeline_executor.cpp` compiles clean (no errors, no warnings)
- tests: ran the intra-query parallelism and parallel-CSV suites plus the
  parallelism-verification test from the project's own `unittest` binary —
  `2104 assertions across 8 test files, all passing` (1 test skipped: requires
  the `tpcds` extension)
- `git diff --stat`:
  - `src/include/duckdb/parallel/pipeline_executor.hpp | 5 ++--`
  - `src/parallel/pipeline_executor.cpp | 29 +++++++++++------------`
  - `2 files changed, 17 insertions(+), 17 deletions(-)`
- linter: no diagnostics for the touched files

## What This Example Demonstrates

- **Any 7B parameter model can delete duplicate lines. It takes architectural memory to know which duplicates are load-bearing.** The strongest signal here is that the agent walked the correctness stages *first* and explicitly refused to flatten thread-continuation paths that a line-count-driven refactor would have destroyed.
- **Universal rules need C++ translation:** Universal guidance caught the DRY trap, but the C++ pack provided the exact vocabulary (`CPP-K02`, `CPP-K26`, `CPP-X28`) needed to evaluate cross-thread visibility and detached worker lifecycles accurately.
- **Audits find what diffs miss:** Loading the early-stage correctness leaves turned a dangerous "make it DRY" request into an audit that found a missing lifecycle reset and a dead field, while leaving the high-risk concurrency code intact.

## Reproduction Outline

1. Clone or update the target repository under `.repos/`.
2. Load `packs/universal/pack.urf.md` and `packs/cpp-architecture/pack.urf.md`,
   route to the relevant leaves, and walk stages S00-S06 before deciding what to
   act on.
3. Because the seam is a late-stage DRY refactor, also load the early-stage
   correctness leaves the code touches (control-flow, lifecycle, concurrency,
   state-modeling) and say so in the write-up.
4. Do a read-only audit pass first, record findings by stage, then apply and
   verify only the safe rows one at a time.
5. Build with the project's own toolchain (here: MSVC + CMake/Ninja) and run a
   targeted subset of the project's own tests that exercises the changed
   subsystem; record the exact `git diff --stat` that produced the example.
