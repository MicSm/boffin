# Signatures

ParselFire Core reserves a detached GPG signing surface for its public pack files.
For now, release numbering is tracked manually in the root `VERSION` file, and
signatures are prepared manually during release packaging. CI-side signing is
intentionally deferred until after the initial OSS release.

`signatures/pubkeys/` is the canonical location for maintainer and contributor
public keys.

## Planned Signed Surface

The intended signed surface is every shipped `*.urf.md` file under the public
core families in `packs/`:

- `packs/universal/`
- `packs/python-architecture/`
- `packs/cpp-architecture/`

Each signed core pack file should have a mirrored detached signature under
`signatures/packs/` with the same relative path plus `.sig`.

Example:

- `packs/universal/pack.urf.md`
- `signatures/packs/universal/pack.urf.md.sig`

## Release-Time Checklist

1. Update the root `VERSION` file to the release or release-candidate number.
2. Make sure the released `*.urf.md` contents are final.
3. Create or refresh the mirrored detached `.sig` file for each released
   `*.urf.md` surface under `signatures/packs/`.
4. Publish or update the matching public key under `signatures/pubkeys/`.

## Verify A Single File

Once signatures exist:

```text
gpg --verify signatures/packs/universal/pack.urf.md.sig packs/universal/pack.urf.md
```

## Verify The Repository Surface

For routine verification from the repo root, use the helper script:

```text
python scripts/pack_signatures.py verify --target-dir packs
```

If you prefer raw `gpg`, verify the mirrored signature path under
`signatures/packs/` that matches the pack file's relative path inside `packs/`.

## Automation Helper

For repeatable local verification and re-signing from the repo root, use:

```text
python scripts/pack_signatures.py verify
python scripts/pack_signatures.py sign --passphrase-file path/to/secret.txt
python scripts/pack_signatures.py sign --key <fingerprint> --passphrase-file path/to/secret.txt
python scripts/pack_signatures.py sign --dry-run
```

The helper scans `packs/` recursively for every shipped `*.urf.md` file and
expects or writes a mirrored detached signature under `signatures/packs/` with
the same relative path plus `.sig`.

Signing requires a passphrase: supply it via `--passphrase-file` (reads first
line) or `--passphrase` (less safe — visible in process list). The passphrase
is fed to `gpg` in loopback mode so the pinentry window does not pop up once per
file.

## Contributor Requirements

- external contributors must publish their public key under `signatures/pubkeys/`
- external shipped pack files must include detached `.sig` files
- unsigned pack surfaces should be treated as review material, not as released
  artifacts
