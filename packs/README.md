# Pack Guides

This file is NOT intended for LLM consumption. Human-readable guide only.

ParselFire Core ships three core pack families. Each family has:

- `pack.urf.md`: a thin index with routing, leaf registry, and stage references
- `*.urf.md` leaf files: dense K/X record surfaces loaded by agents when relevant

Legend: `id | stage | scope | rule` means a stable record id, stage number, short scope label, and the kernel or violation text carried by that record.

## Families

- [`universal/README.md`](universal/README.md): shared stage pipeline and language-agnostic architectural rules
- [`python-architecture/README.md`](python-architecture/README.md): Python runtime, async, state, and boundary rules
- [`cpp-architecture/README.md`](cpp-architecture/README.md): C++ contracts, lifecycle, concurrency, and boundary rules

## How To Read A Family

1. Start with the family `README.md`.
2. Open that family's `pack.urf.md` to see routing and `## LEAVES`.
3. Follow the leaf files for the stage or seam you care about.

Runtime note: ParselFire Core agents should load only `pack.urf.md` indexes and the `*.urf.md` leaf files resolved from those indexes, not these guide files.
