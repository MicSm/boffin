# Python Before/After Evidence

These notes summarize two guided refactoring experiments against external Python
repositories cloned under `.repos/`. They use the current live pack surfaces
and fresh verification gathered in this session rather than historical notes.

## FastAPI: `fastapi/security/http.py`

### Before

`HTTPBase.__call__`, `HTTPBearer.__call__`, and `HTTPDigest.__call__` repeated
the same `Authorization` parsing and `auto_error` handling. The only real
variation between bearer and digest was the expected scheme, while `HTTPBasic`
still carried genuinely distinct protocol work.

### Loaded guidance

Loaded `packs/universal/shared-abstractions.urf.md` and
`packs/universal/control-flow.urf.md`. Using two universal leaves was justified
here because the change truly spans shared-invariant extraction and special-case
retention.

Applied:

- `universal/shared-invariant-extraction` (`UNI-K24`)
- `universal/parameterized-duplicates` (`UNI-K28`)
- `universal/exceptional-path-retention` (`UNI-K08`)

Guard rails kept intact:

- `universal/repeated-invariant-inline` (`UNI-X24`) was removed by moving the
  shared authorization invariant into `HTTPBase`
- `universal/special-case-flattening` (`UNI-X08`) was not introduced; `HTTPBasic`
  kept its separate base64 decode and colon-validation path

### After

`HTTPBase` now owns the shared authorization invariant through
`_get_authorization_credentials()`. `HTTPBearer` and `HTTPDigest` declare only a
private `_expected_scheme` and inherit the shared `__call__` behavior.
`HTTPBasic` stays on its own path because it still needs protocol-specific
decode and credential-shape validation.

### Why better

- one authorization invariant now lives in one place instead of three near-copies
- bearer and digest variation is expressed as bounded policy instead of repeated
  control flow
- the refactor stayed local to one file and deleted more code than it added
- the special HTTP Basic path stayed explicit instead of being flattened into a
  fake generic branch

### Verification

- `git diff --stat`:
  - `fastapi/security/http.py | 49 ++++++++++++++++--------------------------------`
  - `1 file changed, 16 insertions(+), 33 deletions(-)`
- `git diff`: one file changed, no public API changes, helper kept private on
  `HTTPBase`
- tests: `49 passed` via the repo venv across the `test_security_http*.py` suite
- linter: no diagnostics for the touched file

## LangChain: `langchain_core/runnables/retry.py`

### Before

`_batch()` and `_abatch()` contained copy-pasted retry bookkeeping. Pending
index computation, pending input/config/manager extraction, result processing,
and final reassembly all appeared twice, with the only real differences being
sync versus async iteration and the final dispatch to `super().batch()` versus
`await super().abatch()`.

### Loaded guidance

Loaded `packs/universal/shared-abstractions.urf.md` and
`packs/python-architecture/async-surfaces.urf.md`.

Applied:

- `universal/shared-invariant-extraction` (`UNI-K24`)
- `universal/parameterized-duplicates` (`UNI-K28`)
- `python-architecture/native-sync-async-paths` (`PY-K13`)

Guard rails kept intact:

- `universal/copy-paste-variants` (`UNI-X28`) was reduced by moving neutral
  mechanics into helpers
- `python-architecture/mixed-mode-engines` (`PY-X13`) was not introduced;
  `_batch()` and `_abatch()` remain distinct entry points

### After

`RunnableRetry` now extracts the neutral batch mechanics into four private
helpers:

- `_get_pending_batch_indices()`
- `_get_pending_batch()`
- `_process_batch_result()`
- `_assemble_batch_results()`

`_batch()` still owns the sync retry loop and `super().batch()` dispatch.
`_abatch()` still owns the async retry loop and `await super().abatch()`
dispatch. The shared helpers only handle index tracking, pending-subset
assembly, result mapping, and ordered reassembly.

### Why better

- shared retry bookkeeping now lives in one place instead of two 50+ line variants
- the sync/async boundary remains explicit, matching
  `python-architecture/native-sync-async-paths`
- the extracted helpers make the original-index contract obvious during retries
  and final reassembly
- the change stayed local to one file and avoided new dependencies or public API
  changes

### Verification

- `git diff --stat`:
  - `libs/core/langchain_core/runnables/retry.py | 164 ++++++++++++++++------------`
  - `1 file changed, 97 insertions(+), 67 deletions(-)`
- `git diff`: one file changed, no public API changes, only private helper
  extraction
- tests: `4 passed, 117 deselected` via the repo venv with
  `test_runnable.py -k retry`
- linter: no diagnostics for the touched file

## What These Examples Demonstrate

- Universal pack guidance is enough to drive real refactors when the problem is
  duplicated invariants or duplicated workflow mechanics.
- Cross-theme loading should stay rare, but it is justified when a refactor
  touches both shared extraction and a real special-case contract, as in the
  FastAPI HTTP security case.
- Python-specific guidance matters once shared refactoring approaches an async
  boundary: the LangChain change improved reuse without collapsing sync and
  async into one mixed-mode engine.
- Fresh diff stats and project-local tests make the evidence portable and
  falsifiable instead of narrative-only.

## Reproduction Outline

1. Clone or update a target repository under `.repos/`.
2. Load `packs/universal/pack.urf.md`, route to the primary relevant universal
   leaf, and walk stages S00-S06 before deciding what to act on.
3. For Python targets, also load `packs/python-architecture/pack.urf.md` and
   the primary relevant Python leaf.
4. If the primary seam is a late-stage refactor (S04-S06), also load at least
   one early-stage correctness leaf (S01-S03). If the walked stages reach other
   leaves, load the leaves whose `stages=` cover them and say so in the
   write-up.
5. For a focused change, keep the edit local; the 3-5 budget applies only to
   the K/X entries you materially act on after the stage walk, not to the read
   set itself.
6. For an open-ended refactor or review, do a read-only audit pass first,
   record findings by stage, then apply and verify them one by one.
7. Run the target project's own tests from the repo's working environment and
   record the exact `git diff --stat` output that produced the example.
