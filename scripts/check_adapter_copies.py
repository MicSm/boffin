from __future__ import annotations

import json
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANONICAL_PATH = Path("AGENTS.md")


def _identity(text: str) -> str:
    return text


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n[\s\S]*?\n---\n*", "", text).strip()


@dataclass(frozen=True)
class TextAdapterCheck:
    rel_path: Path
    label: str
    normalize: Callable[[str], str] = _identity


TEXT_ADAPTER_CHECKS: tuple[TextAdapterCheck, ...] = (
    *(
        TextAdapterCheck(rel_path=path, label="copy-based adapter")
        for path in (
            Path("CLAUDE.md"),
            Path(".github/copilot-instructions.md"),
            Path(".windsurf/rules/parselfire.md"),
            Path(".clinerules/parselfire.md"),
            Path(".agents/rules/parselfire.md"),
        )
    ),
    TextAdapterCheck(
        rel_path=Path(".kiro/steering/parselfire.md"),
        label="wrapped copy adapter",
        normalize=strip_frontmatter,
    ),
)

MANIFEST_ADAPTER_PATHS: tuple[Path, ...] = (Path("gemini-extension.json"),)


def read_text(rel_path: Path) -> str:
    path = ROOT / rel_path
    return path.read_text(encoding="utf-8").replace("\r\n", "\n").strip()


def check_text_adapters(canonical: str, errors: list[str]) -> None:
    for check in TEXT_ADAPTER_CHECKS:
        try:
            actual = check.normalize(read_text(check.rel_path))
        except FileNotFoundError:
            errors.append(f"missing {check.label}: {check.rel_path}")
            continue
        if actual != canonical:
            errors.append(f"{check.rel_path} drifted from {CANONICAL_PATH}")


def check_manifest_adapters(version: str, errors: list[str]) -> None:
    for rel_path in MANIFEST_ADAPTER_PATHS:
        try:
            manifest = json.loads(read_text(rel_path))
        except FileNotFoundError:
            errors.append(f"missing manifest-only adapter: {rel_path}")
            continue
        except json.JSONDecodeError as exc:
            errors.append(f"{rel_path} is not valid JSON: {exc}")
            continue

        if manifest.get("contextFileName") != CANONICAL_PATH.name:
            errors.append(f"{rel_path} must point at {CANONICAL_PATH.name}")
        if version and manifest.get("version") != version:
            errors.append(f"{rel_path} version must match VERSION ({version})")


def main() -> int:
    errors: list[str] = []

    try:
        canonical = read_text(CANONICAL_PATH)
    except FileNotFoundError:
        print(f"Missing canonical adapter source: {CANONICAL_PATH}")
        return 1

    check_text_adapters(canonical, errors)

    try:
        version = read_text(Path("VERSION"))
    except FileNotFoundError:
        errors.append("missing VERSION")
        version = ""

    check_manifest_adapters(version, errors)

    if errors:
        print("Adapter portability check failed:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(
        "OK: copy-based adapters match AGENTS.md, wrapped adapters normalize to "
        "AGENTS.md, and manifest-only adapters point at the canonical contract."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
