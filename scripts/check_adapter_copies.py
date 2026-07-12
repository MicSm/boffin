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
            Path(".windsurf/rules/boffin.md"),
            Path(".clinerules/boffin.md"),
            Path(".agents/rules/boffin.md"),
        )
    ),
    TextAdapterCheck(
        rel_path=Path(".kiro/steering/boffin.md"),
        label="wrapped copy adapter",
        normalize=strip_frontmatter,
    ),
)

MANIFEST_ADAPTER_PATHS: tuple[Path, ...] = (Path("gemini-extension.json"),)
SHARED_SKILL_PATHS: tuple[Path, ...] = (
    Path("skills/boffin/SKILL.md"),
    Path("skills/boffin-review/SKILL.md"),
)
INSTRUCTION_BUILDER_PATH = Path("hooks/boffin-instructions.js")
HOOK_WRAPPER_PATH = Path("hooks/claude-codex-hooks.json")
PLUGIN_MANIFEST_PATHS: tuple[Path, ...] = (
    Path(".claude-plugin/plugin.json"),
    Path(".codex-plugin/plugin.json"),
)
MARKETPLACE_MANIFEST_PATH = Path(".claude-plugin/marketplace.json")


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


def read_json(rel_path: Path, errors: list[str], label: str) -> dict[str, object] | None:
    try:
        return json.loads(read_text(rel_path))
    except FileNotFoundError:
        errors.append(f"missing {label}: {rel_path}")
        return None
    except json.JSONDecodeError as exc:
        errors.append(f"{rel_path} is not valid JSON: {exc}")
        return None


def check_shared_runtime_surfaces(errors: list[str]) -> None:
    try:
        instructions = read_text(INSTRUCTION_BUILDER_PATH)
    except FileNotFoundError:
        errors.append(f"missing shared instruction builder: {INSTRUCTION_BUILDER_PATH}")
    else:
        if "AGENTS.md" not in instructions or "loadCanonicalContract" not in instructions:
            errors.append(
                f"{INSTRUCTION_BUILDER_PATH} must load AGENTS.md as the canonical contract"
            )

    for rel_path in SHARED_SKILL_PATHS:
        try:
            skill_text = read_text(rel_path)
        except FileNotFoundError:
            errors.append(f"missing shared skill: {rel_path}")
            continue
        if "AGENTS.md" not in skill_text or "installed plugin root" not in skill_text:
            errors.append(
                f"{rel_path} must point back to AGENTS.md at the installed plugin root"
            )

    wrapper = read_json(HOOK_WRAPPER_PATH, errors, "shared hook wrapper")
    if wrapper is not None:
        hooks = wrapper.get("hooks")
        if not isinstance(hooks, dict):
            errors.append(f"{HOOK_WRAPPER_PATH} must contain a top-level hooks object")
        else:
            expected_events = {"SessionStart", "SubagentStart", "UserPromptSubmit"}
            actual_events = set(hooks)
            if actual_events != expected_events:
                errors.append(
                    f"{HOOK_WRAPPER_PATH} must declare exactly {sorted(expected_events)}"
                )
            for event_name, groups in hooks.items():
                if not isinstance(groups, list) or not groups:
                    errors.append(f"{HOOK_WRAPPER_PATH} event {event_name} must define hooks")
                    continue
                for group in groups:
                    if not isinstance(group, dict):
                        errors.append(
                            f"{HOOK_WRAPPER_PATH} event {event_name} contains a non-object hook group"
                        )
                        continue
                    event_hooks = group.get("hooks")
                    if not isinstance(event_hooks, list) or not event_hooks:
                        errors.append(
                            f"{HOOK_WRAPPER_PATH} event {event_name} must include hook commands"
                        )
                        continue
                    for hook in event_hooks:
                        if not isinstance(hook, dict) or hook.get("type") != "command":
                            errors.append(
                                f"{HOOK_WRAPPER_PATH} event {event_name} must use command hooks"
                            )

    for rel_path in PLUGIN_MANIFEST_PATHS:
        manifest = read_json(rel_path, errors, "plugin manifest")
        if manifest is None:
            continue
        if manifest.get("skills") != "./skills/":
            errors.append(f"{rel_path} must point skills at ./skills/")
        if manifest.get("hooks") != "./hooks/claude-codex-hooks.json":
            errors.append(
                f"{rel_path} must point hooks at ./hooks/claude-codex-hooks.json"
            )

    marketplace = read_json(
        MARKETPLACE_MANIFEST_PATH, errors, "Claude marketplace manifest"
    )
    if marketplace is not None:
        plugins = marketplace.get("plugins")
        if not isinstance(plugins, list) or len(plugins) != 1:
            errors.append(
                f"{MARKETPLACE_MANIFEST_PATH} must expose exactly one repository-root plugin"
            )
        else:
            plugin = plugins[0]
            if not isinstance(plugin, dict) or plugin.get("source") != "./":
                errors.append(
                    f"{MARKETPLACE_MANIFEST_PATH} must point its plugin source at ./"
                )


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
    check_shared_runtime_surfaces(errors)

    if errors:
        print("Adapter portability check failed:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(
        "OK: copy-based adapters match AGENTS.md, wrapped adapters normalize to "
        "AGENTS.md, manifest-only adapters point at the canonical contract, and "
        "shared plugin surfaces still route through the canonical AGENTS.md contract."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
