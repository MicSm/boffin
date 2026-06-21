from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKS_DIR = ROOT / "packs"
ROUTING_RULE_PATH = ROOT / ".cursor" / "rules" / "parselfire-pack-routing.mdc"
HEADING_RE = re.compile(r"^##\s+(?P<name>[A-Z-]+)\s*$")
PAIR_ID_RE = re.compile(r"^(?P<prefix>[A-Z]+)-(?P<kind>[KX])(?P<number>\d+)$")
ROUTING_ID_RE = re.compile(r"^[RL]\d+$")
STAGE_ID_RE = re.compile(r"^S\d{2}$")
STAGE_REF_ID_RE = re.compile(r"^SR\d{2}$")
DIRECTIVE_ID_RE = re.compile(r"^![A-Z-]+$")
LOWER_SIGNAL_RE = re.compile(r"^[a-z0-9-]+$")
RULE_STAGE_SUMMARY_RE = re.compile(r"^-\s+(S\d{2})\s+[^:]+:")
EXPECTED_STAGE_DIRECTIVES = ["!PURPOSE", "!APPLY", "!ANTI", "!SHOW"]
EXPECTED_STAGE_IDS = [f"S{stage:02d}" for stage in range(7)]
FAMILY_PREFIXES = {
    "universal": "UNI",
    "cpp-architecture": "CPP",
    "python-architecture": "PY",
}


@dataclass(frozen=True)
class Record:
    file_path: Path
    line_number: int
    section: str
    raw: str
    record_id: str
    tokens: tuple[str, ...]
    fields: dict[str, str]


@dataclass(frozen=True)
class IndexValidation:
    actual_leaf_names: set[str]
    leaf_registry: dict[str, Record]
    route_records: list[Record]
    stage_records: list[Record]
    stage_ref_records: list[Record]
    leaf_declared_stages: dict[str, set[int]]


class LintState:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, path: Path, line_number: int, message: str) -> None:
        self.errors.append(f"{path.relative_to(ROOT)}:{line_number}: {message}")

    def warning(self, path: Path, line_number: int, message: str) -> None:
        self.warnings.append(f"{path.relative_to(ROOT)}:{line_number}: {message}")

    def error_at(self, record: Record, message: str) -> None:
        self.error(record.file_path, record.line_number, message)

    def warning_at(self, record: Record, message: str) -> None:
        self.warning(record.file_path, record.line_number, message)


def _split_semicolon_tokens(
    raw: str | None,
    *,
    record: Record,
    field_name: str,
    state: LintState,
) -> list[str]:
    if not raw:
        state.error_at(record, f"record is missing {field_name}=")
        return []
    tokens: list[str] = []
    for token in raw.split(";"):
        if not token:
            state.error_at(record, f"{field_name} contains an empty token")
            continue
        tokens.append(token)
    return tokens


def _require_ascending(values: list[int], *, record: Record, label: str, state: LintState) -> None:
    if values and values != sorted(values):
        state.error_at(record, label)


def parse_urf_file(path: Path, state: LintState) -> list[Record]:
    records: list[Record] = []
    current_section = ""

    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("<!--") or stripped == "-->":
            continue
        heading_match = HEADING_RE.match(stripped)
        if heading_match:
            current_section = heading_match.group("name")
            continue
        if stripped.startswith("#"):
            continue
        parts = stripped.split("|")
        record_id = parts[0]
        tokens = tuple(parts[1:])
        fields: dict[str, str] = {}
        for token in tokens:
            if "=" not in token:
                if record_id.startswith("!"):
                    continue
                state.error(path, line_number, f"record token lacks '=': {token!r}")
                continue
            key, value = token.split("=", 1)
            fields[key] = value
        records.append(
            Record(
                file_path=path,
                line_number=line_number,
                section=current_section,
                raw=stripped,
                record_id=record_id,
                tokens=tokens,
                fields=fields,
            )
        )
    return records


def parse_stage(record: Record, state: LintState) -> int | None:
    raw_stage = record.fields.get("stage")
    if raw_stage is None:
        state.error_at(record, "missing stage field")
        return None
    try:
        stage = int(raw_stage)
    except ValueError:
        state.error_at(record, f"invalid stage value {raw_stage!r}")
        return None
    if stage < 0 or stage > 6:
        state.error_at(record, f"stage {stage} is outside 0..6")
        return None
    return stage


def parse_pair_id(record: Record, state: LintState) -> tuple[str, str, int] | None:
    match = PAIR_ID_RE.match(record.record_id)
    if not match:
        state.error_at(record, f"invalid K/X id {record.record_id!r}")
        return None
    return match.group("prefix"), match.group("kind"), int(match.group("number"))


def parse_refs_field(record: Record, expected_prefix: str, state: LintState) -> list[str]:
    seen: set[str] = set()
    ordered_numbers: list[int] = []
    parsed_refs: list[str] = []
    for ref in _split_semicolon_tokens(
        record.fields.get("refs"),
        record=record,
        field_name="refs",
        state=state,
    ):
        match = PAIR_ID_RE.match(ref)
        if match is None:
            state.error_at(record, f"refs entry {ref!r} is not a valid K id")
            continue
        prefix = match.group("prefix")
        kind = match.group("kind")
        number = int(match.group("number"))
        if kind != "K":
            state.error_at(record, f"refs entry {ref!r} must point to a K id")
        if prefix != expected_prefix:
            state.error_at(record, f"refs entry {ref!r} does not match family prefix {expected_prefix!r}")
        if ref in seen:
            state.error_at(record, f"refs entry {ref!r} is duplicated")
            continue
        seen.add(ref)
        ordered_numbers.append(number)
        parsed_refs.append(ref)
    _require_ascending(
        ordered_numbers,
        record=record,
        label="refs ids must be sorted by numeric suffix",
        state=state,
    )
    return parsed_refs


def parse_stage_list_field(record: Record, field: str, state: LintState) -> set[int]:
    seen_order: list[int] = []
    result: set[int] = set()
    for part in _split_semicolon_tokens(
        record.fields.get(field),
        record=record,
        field_name=field,
        state=state,
    ):
        if not part.isdigit():
            state.error_at(record, f"{field} entry {part!r} is not an integer")
            continue
        value = int(part)
        if value < 0 or value > 6:
            state.error_at(record, f"{field} entry {value} is outside 0..6")
            continue
        if value in result:
            state.error_at(record, f"{field} entry {value} is duplicated")
            continue
        result.add(value)
        seen_order.append(value)
    _require_ascending(
        seen_order,
        record=record,
        label=f"{field} values must be ascending",
        state=state,
    )
    return result


def resolve_pack_target(family_dir: Path, target: str) -> Path | None:
    target_path = Path(target)
    candidates: list[Path] = []
    if target_path.suffix:
        candidates.append((family_dir / target_path).resolve())
        candidates.append((PACKS_DIR / target_path).resolve())
        candidates.append((ROOT / target_path).resolve())
    else:
        candidates.append((PACKS_DIR / target / "pack.urf.md").resolve())
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def validate_signals(record: Record, state: LintState) -> list[str]:
    signals_value = record.fields.get("signals", "")
    if not signals_value:
        state.error_at(record, "routing record is missing signals")
        return []
    signals = signals_value.split(",")
    seen_local: set[str] = set()
    for signal in signals:
        if not signal:
            state.error_at(record, "signals contain an empty token")
            continue
        if signal in seen_local:
            state.error_at(record, f"signals repeat {signal!r} inside one route")
            continue
        seen_local.add(signal)
        if not LOWER_SIGNAL_RE.match(signal):
            state.error_at(record, f"signal {signal!r} must be lowercase literal text")
    return signals


def validate_dense_sequence(index_path: Path, records: list[Record], kind: str, state: LintState) -> None:
    if not records:
        return
    numbers: list[int] = []
    for record in records:
        if not record.record_id.startswith(kind) or not record.record_id[1:].isdigit():
            state.error_at(record, f"invalid {kind} id {record.record_id!r}")
            continue
        numbers.append(int(record.record_id[1:]))
    if not numbers:
        return
    if numbers != sorted(numbers):
        state.error(index_path, 1, f"{kind} ids are not ascending")
    expected = list(range(1, len(numbers) + 1))
    if numbers != expected:
        state.error(index_path, 1, f"{kind} ids must be dense with no gaps")


def validate_universal_stage_section(
    index_path: Path,
    directive_records: list[Record],
    stage_records: list[Record],
    state: LintState,
) -> None:
    actual_directives = [record.record_id for record in directive_records]
    if actual_directives != EXPECTED_STAGE_DIRECTIVES:
        state.error(
            index_path,
            1,
            "## STAGES must begin with !PURPOSE, !APPLY, !ANTI, !SHOW in order",
        )
    for record in directive_records:
        if not DIRECTIVE_ID_RE.match(record.record_id):
            state.error_at(record, f"invalid directive id {record.record_id!r}")
        if not record.tokens:
            state.error_at(record, "directive must include at least one payload token")

    actual_stage_ids = [record.record_id for record in stage_records]
    if actual_stage_ids != EXPECTED_STAGE_IDS:
        state.error(index_path, 1, "## STAGES must contain S00 through S06 in order")
    for record in stage_records:
        if not STAGE_ID_RE.match(record.record_id):
            state.error_at(record, f"invalid stage id {record.record_id!r}")
        if "name" not in record.fields:
            state.error_at(record, "stage record is missing name=")
        if "focus" not in record.fields:
            state.error_at(record, "stage record is missing focus=")
        if "refs" not in record.fields:
            state.error_at(record, "stage record is missing refs=")
        if "question" in record.fields:
            state.error_at(record, "stage record must use focus= instead of question=")


def validate_stage_ref_section(index_path: Path, stage_ref_records: list[Record], state: LintState) -> None:
    if not stage_ref_records:
        state.error(index_path, 1, "non-universal family indexes must contain ## STAGE-REFS")
        return
    actual_ids = [record.record_id for record in stage_ref_records]
    sorted_ids = sorted(actual_ids)
    if actual_ids != sorted_ids:
        state.error(index_path, 1, "## STAGE-REFS ids must be ascending")
    if len(actual_ids) != len(set(actual_ids)):
        state.error(index_path, 1, "## STAGE-REFS ids must be unique")
    for record in stage_ref_records:
        if not STAGE_REF_ID_RE.match(record.record_id):
            state.error_at(record, f"invalid stage-ref id {record.record_id!r}")
        if "refs" not in record.fields:
            state.error_at(record, "stage-ref record is missing refs=")


def build_leaf_anchor_text(leaf_path: Path, leaf_records: list[Record], theme: str) -> str:
    chunks = [leaf_path.stem, theme]
    chunks.extend(record.raw for record in leaf_records)
    return normalize_text(" ".join(chunks))


def warn_unanchored_route_signals(
    family_dir: Path,
    route_records: list[Record],
    leaf_registry: dict[str, Record],
    leaf_records_by_name: dict[str, list[Record]],
    state: LintState,
) -> None:
    for route_record in route_records:
        leaf_name = route_record.fields.get("leaf")
        if not leaf_name:
            continue
        registry_record = leaf_registry.get(leaf_name)
        leaf_records = leaf_records_by_name.get(leaf_name)
        if registry_record is None or leaf_records is None:
            continue
        anchor_text = build_leaf_anchor_text(
            family_dir / leaf_name,
            leaf_records,
            registry_record.fields.get("theme", ""),
        )
        for signal in route_record.fields.get("signals", "").split(","):
            if normalize_text(signal) not in anchor_text:
                state.warning_at(
                    route_record,
                    f"signal {signal!r} has no literal anchor in {leaf_name!r}; consider a more specific selector",
                )


def validate_index(
    family_dir: Path,
    index_path: Path,
    records: list[Record],
    state: LintState,
) -> IndexValidation:
    stage_section_records = [record for record in records if record.section == "STAGES"]
    directive_records = [record for record in stage_section_records if record.record_id.startswith("!")]
    stage_records = [record for record in stage_section_records if not record.record_id.startswith("!")]
    stage_ref_records = [record for record in records if record.section == "STAGE-REFS"]
    route_records = [record for record in records if record.section == "ROUTING"]
    leaf_records = [record for record in records if record.section == "LEAVES"]

    if family_dir.name == "universal":
        if stage_ref_records:
            state.error(index_path, 1, "## STAGE-REFS is not valid in packs/universal/pack.urf.md")
        validate_universal_stage_section(index_path, directive_records, stage_records, state)
    else:
        if stage_section_records:
            state.error(index_path, 1, "## STAGES is only valid in packs/universal/pack.urf.md")
        validate_stage_ref_section(index_path, stage_ref_records, state)

    validate_dense_sequence(index_path, route_records, "R", state)
    validate_dense_sequence(index_path, leaf_records, "L", state)

    route_targets: set[str] = set()
    registry_targets: set[str] = set()
    used_signals: dict[str, Record] = {}
    leaf_registry: dict[str, Record] = {}
    leaf_declared_stages: dict[str, set[int]] = {}

    for record in route_records:
        if not ROUTING_ID_RE.match(record.record_id) or not record.record_id.startswith("R"):
            state.error_at(record, f"invalid routing id {record.record_id!r}")
        has_leaf = "leaf" in record.fields
        has_pack = "pack" in record.fields
        if has_leaf == has_pack:
            state.error_at(record, "routing record must contain exactly one of leaf= or pack=")
        for signal in validate_signals(record, state):
            previous = used_signals.get(signal)
            if previous is not None:
                state.error_at(
                    record,
                    f"signal {signal!r} already used by {previous.record_id} in {previous.fields.get('leaf', previous.fields.get('pack', 'unknown'))}",
                )
            else:
                used_signals[signal] = record
        if has_leaf:
            leaf_name = record.fields["leaf"]
            target_path = family_dir / leaf_name
            route_targets.add(leaf_name)
            if not target_path.exists():
                state.error_at(record, f"leaf target {leaf_name!r} does not exist")
        if has_pack:
            target = record.fields["pack"]
            if resolve_pack_target(family_dir, target) is None:
                state.error_at(record, f"pack target {target!r} does not exist")

    for record in leaf_records:
        if not ROUTING_ID_RE.match(record.record_id) or not record.record_id.startswith("L"):
            state.error_at(record, f"invalid leaf id {record.record_id!r}")
        leaf_name = record.fields.get("file")
        if not leaf_name:
            state.error_at(record, "leaf registry entry is missing file=")
            continue
        registry_targets.add(leaf_name)
        leaf_registry[leaf_name] = record
        if not (family_dir / leaf_name).exists():
            state.error_at(record, f"leaf registry target {leaf_name!r} does not exist")
        if "theme" not in record.fields:
            state.error_at(record, "leaf registry entry is missing theme=")
        if "stages" not in record.fields:
            state.error_at(record, "leaf registry entry is missing stages=")
        else:
            leaf_declared_stages[leaf_name] = parse_stage_list_field(record, "stages", state)

    for leaf_name in sorted(route_targets - registry_targets):
        state.error(index_path, 1, f"route target {leaf_name!r} is missing from ## LEAVES")
    for leaf_name in sorted(registry_targets - route_targets):
        state.warning(index_path, 1, f"leaf {leaf_name!r} is registered but not selected by any route")

    actual_leaf_names = {path.name for path in family_dir.glob("*.urf.md") if path.name != "pack.urf.md"}
    for leaf_name in sorted(actual_leaf_names - registry_targets):
        state.error(index_path, 1, f"leaf file {leaf_name!r} exists on disk but is missing from ## LEAVES")

    return IndexValidation(
        actual_leaf_names=actual_leaf_names,
        leaf_registry=leaf_registry,
        route_records=route_records,
        stage_records=stage_records,
        stage_ref_records=stage_ref_records,
        leaf_declared_stages=leaf_declared_stages,
    )


def validate_leaf(
    family_dir: Path,
    leaf_path: Path,
    records: list[Record],
    expected_prefix: str,
    state: LintState,
    family_ids: dict[str, Record],
) -> tuple[dict[int, Record], dict[int, Record]]:
    k_records = [record for record in records if record.section == "KERNELS"]
    x_records = [record for record in records if record.section == "EXCLUDES"]

    family_name = family_dir.name
    seen_sections = {record.section for record in records}
    if "KERNELS" not in seen_sections:
        state.error(leaf_path, 1, "leaf file is missing ## KERNELS")
    if "EXCLUDES" not in seen_sections:
        state.error(leaf_path, 1, "leaf file is missing ## EXCLUDES")

    def validate_section(section_records: list[Record], expected_kind: str) -> dict[int, Record]:
        parsed: dict[int, Record] = {}
        order: list[tuple[int, int]] = []
        text_field = "kernel" if expected_kind == "K" else "violation"
        for record in section_records:
            pair_id = parse_pair_id(record, state)
            if pair_id is None:
                continue
            prefix, kind, number = pair_id
            if prefix != expected_prefix:
                state.error_at(
                    record,
                    f"id prefix {prefix!r} does not match family {family_name!r} prefix {expected_prefix!r}",
                )
            if kind != expected_kind:
                state.error_at(record, f"record is in ## {record.section} but id kind is {kind}")
            if "scope" not in record.fields:
                state.error_at(record, f"{record.record_id} is missing required scope= field")
            if text_field not in record.fields:
                state.error_at(record, f"{record.record_id} is missing required {text_field}= field")
            stage = parse_stage(record, state)
            if stage is None:
                continue
            if record.record_id in family_ids:
                previous = family_ids[record.record_id]
                state.error_at(
                    record,
                    f"id {record.record_id!r} already used in {previous.file_path.relative_to(ROOT)}:{previous.line_number}",
                )
            else:
                family_ids[record.record_id] = record
            if number in parsed:
                previous = parsed[number]
                state.error_at(
                    record,
                    f"numeric suffix {number} already used by {previous.record_id!r} in this section",
                )
            else:
                parsed[number] = record
            order.append((stage, number))
        if order != sorted(order):
            state.error(
                leaf_path,
                1,
                f"records in ## {section_records[0].section if section_records else expected_kind} are not sorted by stage then id",
            )
        return parsed

    return validate_section(k_records, "K"), validate_section(x_records, "X")


def _stage_id_for_ref_record(family_dir: Path, record: Record) -> str:
    if family_dir.name == "universal":
        return record.record_id
    return f"S{record.record_id[2:]}"


def validate_stage_refs_coverage(
    family_dir: Path,
    stage_records: list[Record],
    stage_ref_records: list[Record],
    family_k_records_by_id: dict[str, Record],
    expected_prefix: str,
    state: LintState,
) -> None:
    source_records = stage_records if family_dir.name == "universal" else stage_ref_records

    seen_refs: dict[str, Record] = {}
    for record in source_records:
        stage_id = _stage_id_for_ref_record(family_dir, record)
        stage_number = int(stage_id[1:])
        for ref_id in parse_refs_field(record, expected_prefix, state):
            previous = seen_refs.get(ref_id)
            if previous is not None:
                previous_stage = _stage_id_for_ref_record(family_dir, previous)
                state.error_at(
                    record,
                    f"refs entry {ref_id!r} already assigned to {previous_stage} in {previous.file_path.relative_to(ROOT)}:{previous.line_number}",
                )
                continue
            seen_refs[ref_id] = record
            target_record = family_k_records_by_id.get(ref_id)
            if target_record is None:
                state.error_at(record, f"refs entry {ref_id!r} does not exist in family leaves")
                continue
            target_stage = parse_stage(target_record, state)
            if target_stage is not None and target_stage != stage_number:
                state.error_at(
                    record,
                    f"refs entry {ref_id!r} is listed under {stage_id} but leaf record stage is {target_stage}",
                )

    missing_ids = sorted(set(family_k_records_by_id) - set(seen_refs))
    for missing_id in missing_ids:
        missing_record = family_k_records_by_id[missing_id]
        state.error_at(missing_record, f"K id {missing_id!r} is missing from the family stage refs")


def warn_stage_pipeline_summary_drift(stage_records: list[Record], state: LintState) -> None:
    if not ROUTING_RULE_PATH.exists():
        state.warning(ROUTING_RULE_PATH, 1, "missing .cursor stage pipeline summary surface")
        return
    summary_stage_ids: list[str] = []
    for line in ROUTING_RULE_PATH.read_text(encoding="utf-8").splitlines():
        match = RULE_STAGE_SUMMARY_RE.match(line.strip())
        if match is not None:
            summary_stage_ids.append(match.group(1))
    pack_stage_ids = [record.record_id for record in stage_records]
    if summary_stage_ids != pack_stage_ids:
        state.warning(
            ROUTING_RULE_PATH,
            1,
            "stage summary bullets drifted from the canonical universal stage ids",
        )


def _finish_lint(state: LintState, *, family_count: int, leaf_count: int) -> int:
    if state.warnings:
        print("Warnings:")
        for warning in state.warnings:
            print(f"  - {warning}")

    if state.errors:
        print("Errors:")
        for error in state.errors:
            print(f"  - {error}")
        return 1

    print(f"OK: validated {family_count} families and {leaf_count} leaf files.")
    if state.warnings:
        print(f"Warnings: {len(state.warnings)}")
    return 0


def lint_repo() -> int:
    state = LintState()
    family_dirs = sorted(path for path in PACKS_DIR.iterdir() if path.is_dir() and (path / "pack.urf.md").exists())

    validated_leaf_count = 0
    for family_dir in family_dirs:
        index_path = family_dir / "pack.urf.md"
        index_records = parse_urf_file(index_path, state)
        index_validation = validate_index(family_dir, index_path, index_records, state)

        expected_prefix = FAMILY_PREFIXES.get(family_dir.name)
        if expected_prefix is None:
            state.warning(index_path, 1, f"no configured id prefix for family {family_dir.name!r}; skipping K/X prefix checks")
            continue

        family_ids: dict[str, Record] = {}
        family_numbers: dict[str, dict[int, Record]] = {"K": {}, "X": {}}
        leaf_records_by_name: dict[str, list[Record]] = {}

        for leaf_name in sorted(index_validation.actual_leaf_names):
            leaf_path = family_dir / leaf_name
            leaf_records = parse_urf_file(leaf_path, state)
            leaf_records_by_name[leaf_name] = leaf_records
            validated_leaf_count += 1
            k_records, x_records = validate_leaf(
                family_dir=family_dir,
                leaf_path=leaf_path,
                records=leaf_records,
                expected_prefix=expected_prefix,
                state=state,
                family_ids=family_ids,
            )

            declared_stages = index_validation.leaf_declared_stages.get(leaf_name)
            if declared_stages is not None:
                actual_stages = {
                    int(record.fields["stage"])
                    for record in k_records.values()
                    if record.fields.get("stage", "").isdigit()
                }
                if declared_stages != actual_stages:
                    missing = sorted(actual_stages - declared_stages)
                    spurious = sorted(declared_stages - actual_stages)
                    details: list[str] = []
                    if missing:
                        details.append(f"missing stages {missing}")
                    if spurious:
                        details.append(f"declared stages without kernels {spurious}")
                    state.error(
                        leaf_path,
                        1,
                        f"## LEAVES stages= for {leaf_name!r} must equal the leaf's actual kernel stages ({', '.join(details)})",
                    )

            for kind, section_records in (("K", k_records), ("X", x_records)):
                for number, record in section_records.items():
                    previous = family_numbers[kind].get(number)
                    if previous is not None:
                        state.error_at(
                            record,
                            f"{kind} suffix {number} already used in {previous.file_path.relative_to(ROOT)}:{previous.line_number}",
                        )
                    else:
                        family_numbers[kind][number] = record

        warn_unanchored_route_signals(
            family_dir=family_dir,
            route_records=index_validation.route_records,
            leaf_registry=index_validation.leaf_registry,
            leaf_records_by_name=leaf_records_by_name,
            state=state,
        )

        family_k_records_by_id = {record.record_id: record for record in family_numbers["K"].values()}
        validate_stage_refs_coverage(
            family_dir=family_dir,
            stage_records=index_validation.stage_records,
            stage_ref_records=index_validation.stage_ref_records,
            family_k_records_by_id=family_k_records_by_id,
            expected_prefix=expected_prefix,
            state=state,
        )

        for kind, other_kind in (("K", "X"), ("X", "K")):
            for number in sorted(set(family_numbers[kind]) - set(family_numbers[other_kind])):
                record = family_numbers[kind][number]
                state.error_at(record, f"{kind} suffix {number} has no mirrored {other_kind} entry in family {family_dir.name!r}")

        if family_dir.name == "universal":
            warn_stage_pipeline_summary_drift(index_validation.stage_records, state)

    return _finish_lint(state, family_count=len(family_dirs), leaf_count=validated_leaf_count)


if __name__ == "__main__":
    sys.exit(lint_repo())
