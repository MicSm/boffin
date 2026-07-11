# External Packs

This directory is reserved for third-party or community-maintained pack
families that follow the ParselFire Core public format without becoming part of the
maintainer-shipped core surface in `packs/`.

## Expected Layout

Use one subdirectory per external pack family:

```text
external/
  <pack-name>/
    pack.urf.md
    <leaf>.urf.md
    pack.urf.md.sig
    <leaf>.urf.md.sig
```

External packs use the same file shapes documented in:

- `spec/kernel-schema.md`
- `spec/urf-profile-kernels.md`
- `CONTRIBUTING.md`

## Acceptance Requirements

Before an external pack is accepted into this repository:

- every shipped `*.urf.md` file must have a detached signature
- the contributor's public key must be published in `signatures/pubkeys/`
- the pack must be public-safe and free of non-public source material or
  organization-specific operational details
- the pack must follow the same K/X, routing, and leaf-shape rules as the core
  `packs/` tree

## Validation Notes

`python scripts/pack_lint.py` currently validates the core `packs/` tree. As
the external surface grows, validator coverage can be extended, but spec
compliance and signature completeness are already required.
