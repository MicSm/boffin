# Python Architecture Pack Guide

This file is NOT intended for LLM consumption. Human-readable guide only.

The Python family adds runtime-specific guidance for imports, async boundaries, state ownership, schema edges, and cleanup.

Legend: `id | stage | scope | rule` means a stable record id, stage number, short scope label, and the kernel or violation text carried by that record.

## Files

- `pack.urf.md`: Python routing surface plus `SR##` stage references
- `runtime-bootstrap.urf.md`: S01 and S03 bootstrap, import, and runtime-ownership rules
- `state-lifecycle.urf.md`: S02-S03 state modeling, cancellation, and coordinator rules
- `async-surfaces.urf.md`: S01, S04-S05 async, thread, bridge, and boundary guidance
- `boundaries-cleanup.urf.md`: S05-S06 schema, protocol, registry, and cleanup guidance
- `native-primitives.urf.md`: S00 native Python and stdlib choices before custom helpers

## Reading Tip

Use `pack.urf.md` to see which leaf carries a given stage. When a task is mostly about async, bridge, or thread behavior, `async-surfaces.urf.md` is often the first leaf worth reading.
