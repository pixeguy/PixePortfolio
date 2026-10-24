"""Create a runtime-only upload with matching versioned CSS and JS URLs."""

import argparse
import re
import shutil
from pathlib import Path


def prepare(source, destination, version):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", version):
        raise ValueError("Version must contain only letters, numbers, underscores or hyphens")
    destination.mkdir(parents=True, exist_ok=False)
    local_resource = re.compile(r"(['\"])(\./[A-Za-z0-9_-]+\.(?:js|css))(?:\?[^'\"]*)?\1")
    for source_file in source.iterdir():
        if source_file.is_file() and source_file.suffix in {".html", ".css", ".js"}:
            content = source_file.read_text(encoding="utf-8")
            if source_file.suffix in {".html", ".js"}:
                content = local_resource.sub(
                    lambda match: f"{match[1]}{match[2]}?v={version}{match[1]}", content
                )
            (destination / source_file.name).write_text(content, encoding="utf-8", newline="\n")
    shutil.copytree(source / "assets", destination / "assets", ignore=shutil.ignore_patterns("sources"))
    print(f"Prepared website release {version} in {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--version", required=True)
    arguments = parser.parse_args()
    prepare(Path(__file__).resolve().parents[1], arguments.output.resolve(), arguments.version)
