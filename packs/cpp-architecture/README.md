# C++ Architecture Pack Guide

This file is NOT intended for LLM consumption. Human-readable guide only.

The C++ family adds language- and runtime-specific guidance for contracts, state modeling, concurrency, RAII, shared helpers, and subsystem boundaries.

Legend: `id | stage | scope | rule` means a stable record id, stage number, short scope label, and the kernel or violation text carried by that record.

## Files

- `pack.urf.md`: C++ routing surface plus `SR##` stage references
- `core.urf.md`: S01 language-mechanics rules
- `contracts.urf.md`: S01 typed-boundary and contract rules
- `state-modeling.urf.md`: S02 state and outcome modeling rules
- `concurrency.urf.md`: S01 and S03 memory ordering, thread, and publication rules
- `lifecycle.urf.md`: S03 ownership, worker, and RAII lifecycle rules
- `shared.urf.md`: S04 shared abstraction and helper rules
- `boundaries.urf.md`: S05-S06 subsystem boundary and convergence rules

## Reading Tip

Use `pack.urf.md` to map a symptom to the right leaf. If the risk smells like ownership, publication, teardown, or worker lifetime, read `lifecycle.urf.md` and `concurrency.urf.md` together.
