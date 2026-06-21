from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACKS_DIR = ROOT / "packs"


@dataclass(frozen=True)
class OperationResult:
    file_path: Path
    ok: bool
    message: str


def parse_args() -> argparse.Namespace:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--target-dir",
        type=Path,
        default=DEFAULT_PACKS_DIR,
        help="Directory to scan recursively for *.md files (default: packs/).",
    )
    common.add_argument(
        "--gpg-bin",
        default="gpg",
        help="GPG executable to run (default: gpg).",
    )
    common.add_argument(
        "--quiet-success",
        action="store_true",
        help="Only print failures and the final summary.",
    )

    parser = argparse.ArgumentParser(
        description="Verify or refresh detached GPG signatures for pack markdown files."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "verify",
        parents=[common],
        help="Verify all detached signatures under the target directory.",
    )
    sign_parser = subparsers.add_parser(
        "sign",
        parents=[common],
        help="Create or refresh detached signatures beside every markdown file.",
    )
    sign_parser.add_argument(
        "--key",
        help="Optional GPG key ID or fingerprint to use for signing.",
    )
    sign_parser.add_argument(
        "--passphrase",
        help="Passphrase for gpg loopback mode (visible in process list; prefer --passphrase-file).",
    )
    sign_parser.add_argument(
        "--passphrase-file",
        type=Path,
        help="Read passphrase from this file (first line, stripped). Use - for stdin.",
    )
    sign_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which signatures would be written without modifying files.",
    )
    return parser.parse_args()


def resolve_target_dir(raw_target_dir: Path) -> Path:
    if raw_target_dir.is_absolute():
        return raw_target_dir.resolve()
    return Path.cwd().joinpath(raw_target_dir).resolve()


def relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def iter_markdown_files(target_dir: Path) -> list[Path]:
    return sorted(path for path in target_dir.rglob("*.md") if path.is_file())


def signature_path_for(file_path: Path) -> Path:
    return file_path.with_name(f"{file_path.name}.sig")


def ensure_gpg_available(gpg_bin: str) -> None:
    if shutil.which(gpg_bin) is None:
        raise SystemExit(
            f"GPG executable {gpg_bin!r} was not found in PATH. "
            "Install GnuPG or pass --gpg-bin."
        )


def run_gpg(
    command: list[str],
    *,
    stdin_input: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        input=stdin_input,
        capture_output=True,
        text=True,
        errors="replace",
        check=False,
    )


_GPG_INFORMATIONAL_PREFIXES = (
    "gpg: signature made",
    "gpg: using ",
    "gpg: assuming ",
)


def _is_gpg_informational(line: str) -> bool:
    lowered = line.lower()
    if any(lowered.startswith(prefix) for prefix in _GPG_INFORMATIONAL_PREFIXES):
        return True
    if lowered.startswith("gpg:") and _looks_like_timestamp_line(lowered):
        return True
    return False


_TIMESTAMP_RE = re.compile(r"\d{4}[/-]\d{2}[/-]\d{2}|\d{2}/\d{2}/\d{2}")


def _looks_like_timestamp_line(lowered: str) -> bool:
    """Detect locale-variant 'gpg: Signature made <timestamp>' lines."""
    return bool(_TIMESTAMP_RE.search(lowered))


def summarize_gpg_output(result: subprocess.CompletedProcess[str]) -> str:
    lines: list[str] = []
    for stream in (result.stderr, result.stdout):
        for line in stream.splitlines():
            stripped = line.strip()
            if stripped:
                lines.append(stripped)

    for line in reversed(lines):
        if _is_gpg_informational(line):
            continue
        return line

    if lines:
        return lines[-1]
    return f"gpg exited with code {result.returncode}"


def verify_file(file_path: Path, gpg_bin: str) -> OperationResult:
    sig_path = signature_path_for(file_path)
    if not sig_path.exists():
        return OperationResult(file_path, False, f"missing signature {relative_path(sig_path)}")

    result = run_gpg([gpg_bin, "--verify", str(sig_path), str(file_path)])
    if result.returncode == 0:
        return OperationResult(file_path, True, "signature verified")

    return OperationResult(file_path, False, summarize_gpg_output(result))


def sign_file(
    file_path: Path,
    *,
    gpg_bin: str,
    key: str | None,
    passphrase: str | None,
    dry_run: bool,
) -> OperationResult:
    sig_path = signature_path_for(file_path)
    temp_sig_path = sig_path.with_name(f"{sig_path.name}.tmp")
    if dry_run:
        return OperationResult(
            file_path,
            True,
            f"would write {relative_path(sig_path)}",
        )

    if temp_sig_path.exists():
        temp_sig_path.unlink()

    command = [
        gpg_bin,
        "--batch",
        "--yes",
        "--detach-sign",
        "--output",
        str(temp_sig_path),
    ]
    if key:
        command.extend(["--local-user", key])
    stdin_input = None
    if passphrase is not None:
        command.extend(["--pinentry-mode", "loopback", "--passphrase-fd", "0"])
        stdin_input = f"{passphrase}\n"
    command.append(str(file_path))

    result = run_gpg(command, stdin_input=stdin_input)
    if result.returncode == 0:
        temp_sig_path.replace(sig_path)
        return OperationResult(file_path, True, f"wrote {relative_path(sig_path)}")

    if temp_sig_path.exists():
        temp_sig_path.unlink()

    return OperationResult(file_path, False, summarize_gpg_output(result))


def print_result(result: OperationResult, *, quiet_success: bool) -> None:
    if result.ok and quiet_success:
        return
    status = "OK" if result.ok else "FAIL"
    print(f"[{status}] {relative_path(result.file_path)} - {result.message}")


def process_files(
    file_paths: list[Path],
    *,
    quiet_success: bool,
    operation: Callable[[Path], OperationResult],
    failure_summary: Callable[[int, int], str],
    success_summary: Callable[[int], str],
) -> int:
    failures = 0
    for file_path in file_paths:
        result = operation(file_path)
        print_result(result, quiet_success=quiet_success)
        if not result.ok:
            failures += 1

    if failures:
        print(failure_summary(failures, len(file_paths)))
        return 1

    print(success_summary(len(file_paths)))
    return 0


def run_verify(file_paths: list[Path], *, gpg_bin: str, quiet_success: bool) -> int:
    ensure_gpg_available(gpg_bin)
    return process_files(
        file_paths,
        quiet_success=quiet_success,
        operation=lambda file_path: verify_file(file_path, gpg_bin),
        failure_summary=lambda failures, total: (
            f"Verification failed: {failures} of {total} files did not verify."
        ),
        success_summary=lambda total: f"Verification succeeded: {total} files verified.",
    )


def run_sign(
    file_paths: list[Path],
    *,
    gpg_bin: str,
    key: str | None,
    passphrase: str | None,
    dry_run: bool,
    quiet_success: bool,
) -> int:
    if not dry_run:
        ensure_gpg_available(gpg_bin)

    return process_files(
        file_paths,
        quiet_success=quiet_success,
        operation=lambda file_path: sign_file(
            file_path,
            gpg_bin=gpg_bin,
            key=key,
            passphrase=passphrase,
            dry_run=dry_run,
        ),
        failure_summary=lambda failures, total: (
            f"{'Plan' if dry_run else 'Sign'} failed: {failures} of {total} files could not be processed."
        ),
        success_summary=lambda total: (
            f"Dry run succeeded: {total} files would be signed."
            if dry_run
            else f"Signing succeeded: {total} files signed."
        ),
    )


def _resolve_passphrase(args: argparse.Namespace) -> str | None:
    if args.passphrase is not None:
        return args.passphrase
    passphrase_file: Path | None = getattr(args, "passphrase_file", None)
    if passphrase_file is None:
        return None
    if str(passphrase_file) == "-":
        return sys.stdin.readline().rstrip("\n\r")
    resolved = passphrase_file if passphrase_file.is_absolute() else Path.cwd() / passphrase_file
    try:
        return resolved.read_text(encoding="utf-8").splitlines()[0].strip()
    except (OSError, IndexError) as exc:
        raise SystemExit(f"Cannot read passphrase from {resolved}: {exc}") from exc


def main() -> int:
    args = parse_args()
    target_dir = resolve_target_dir(args.target_dir)
    if not target_dir.exists():
        print(f"Target directory does not exist: {target_dir}")
        return 1
    if not target_dir.is_dir():
        print(f"Target path is not a directory: {target_dir}")
        return 1

    file_paths = iter_markdown_files(target_dir)
    if not file_paths:
        print(f"No markdown files found under {target_dir}")
        return 1

    if args.command == "verify":
        return run_verify(file_paths, gpg_bin=args.gpg_bin, quiet_success=args.quiet_success)
    if args.command == "sign":
        passphrase = _resolve_passphrase(args)
        if not args.dry_run and passphrase is None:
            print("Signing requires --passphrase or --passphrase-file unless you are using --dry-run.")
            return 2
        return run_sign(
            file_paths,
            gpg_bin=args.gpg_bin,
            key=args.key,
            passphrase=passphrase,
            dry_run=args.dry_run,
            quiet_success=args.quiet_success,
        )

    print(f"Unsupported command: {args.command}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
