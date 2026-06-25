#!/usr/bin/env python3
"""Build the static GitHub Pages payload for the Suricata Rule Index."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - exercised by missing local deps.
    yaml = None


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    site_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=repo_root / "index.yaml",
        help="source YAML index",
    )
    parser.add_argument(
        "--site",
        type=Path,
        default=site_dir,
        help="static site source directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "_site",
        help="output directory",
    )
    return parser.parse_args()


def load_index(path: Path) -> dict:
    if yaml is None:
        raise SystemExit("PyYAML is required. Install it with: python3 -m pip install PyYAML")

    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    if not isinstance(data, dict):
        raise SystemExit(f"{path} did not parse as a YAML mapping")

    if not isinstance(data.get("sources"), dict):
        raise SystemExit(f"{path} is missing a sources mapping")

    return data


def active_index(data: dict) -> dict:
    active = dict(data)
    active["sources"] = {
        source_id: source
        for source_id, source in data["sources"].items()
        if not source.get("deprecated") and not source.get("obsolete")
    }
    return active


def copy_static(site_dir: Path, output_dir: Path) -> None:
    if not site_dir.is_dir():
        raise SystemExit(f"site directory does not exist: {site_dir}")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    for child in site_dir.iterdir():
        if child.name in {"build-site.py", "index.json", "index.yaml", "__pycache__"}:
            continue

        if child.suffix == ".pyc":
            continue

        target = output_dir / child.name
        if child.is_dir():
            shutil.copytree(child, target)
        else:
            shutil.copy2(child, target)


def write_payload(index_path: Path, output_dir: Path, data: dict) -> None:
    with (output_dir / "index.yaml").open("w", encoding="utf-8") as handle:
        yaml.safe_dump(data, handle, sort_keys=False, allow_unicode=True)

    with (output_dir / "index.json").open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def main() -> int:
    args = parse_args()
    data = active_index(load_index(args.input))
    copy_static(args.site, args.output)
    write_payload(args.input, args.output, data)
    print(f"Built {args.output} from {args.input}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
