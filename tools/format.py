"""Format explicit repository files; use --all for the entire repository."""

import argparse
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PRETTIER_EXTENSIONS = {
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".md",
    ".mdx",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Check without writing files"
    )
    parser.add_argument(
        "--all", action="store_true", help="Format the entire repository"
    )
    parser.add_argument(
        "files", nargs="*", help="File paths relative to the repository root"
    )
    args = parser.parse_args()
    if args.all and args.files:
        parser.error("Use either explicit files or --all, not both")
    if not args.all and not args.files:
        parser.error("Specify the files you changed, or use --all explicitly")
    paths = (
        subprocess.check_output(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT,
        )
        .decode()
        .split("\0")
    )
    files = sorted(
        {p for p in paths if p and (ROOT / p).is_file() and not (ROOT / p).is_symlink()}
    )
    if not args.all:
        allowed = set(files)
        selected = set()
        for name in args.files:
            path = ROOT / name
            if path.is_symlink():
                parser.error(f"Symbolic links are not supported: {name}")
            try:
                relative = path.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                parser.error(f"File is outside the repository: {name}")
            if relative not in allowed:
                parser.error(f"Not an existing, non-ignored repository file: {name}")
            selected.add(relative)
        files = sorted(selected)
    groups = {"ruff": [], "prettier": [], "shfmt": []}
    for name in files:
        suffix = Path(name).suffix
        if suffix in {".py", ".pyi", ".spec"}:
            groups["ruff"].append(name)
        elif suffix in PRETTIER_EXTENSIONS:
            groups["prettier"].append(name)
        elif suffix in {".sh", ".bash"}:
            groups["shfmt"].append(name)

    # Resolve every required tool before changing any files.
    commands = {}
    for tool, names in groups.items():
        if not names:
            continue
        local_prettier = ROOT / "web/node_modules/.bin/prettier"
        executable = (
            str(local_prettier)
            if tool == "prettier" and local_prettier.is_file()
            else shutil.which(tool)
        )
        if not executable:
            parser.error(f"Missing formatter: {tool}")
        commands[tool] = executable

    options = {
        "ruff": ["format", "--force-exclude", "--extension", "spec:python"]
        + (["--check"] if args.check else []),
        "prettier": ["--check" if args.check else "--write"],
        "shfmt": ["-i", "2", "-d" if args.check else "-w"],
    }
    failed = False
    for tool, executable in commands.items():
        names = groups[tool]
        print(f"{tool}: {len(names)} files", flush=True)
        for start in range(0, len(names), 100):
            result = subprocess.run(
                [executable, *options[tool], *names[start : start + 100]], cwd=ROOT
            )
            failed |= result.returncode != 0
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
