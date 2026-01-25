#!/usr/bin/env python3

import sys
import subprocess
import re


def get_latest_tag() -> str:
    subprocess.check_call(["git", "fetch", "--tags"])
    result = subprocess.run(
        ["git", "tag", "-l", "v*", "--sort=version:refname"],
        capture_output=True,
        text=True,
        check=True,
    )
    lines = result.stdout.strip().splitlines()
    tag = lines[-1].strip()
    if re.match(r"^v\d+\.\d+\.\d+$", tag):
        return tag
    else:
        raise ValueError(f"Invalid tag: {tag}")


def advance_version(tag: str, type: str) -> str:
    major, minor, patch = tag[1:].split(".")
    if type == "minor":
        return f"v{major}.{int(minor) + 1}.0"
    elif type == "major":
        return f"v{int(major) + 1}.0.0"
    else:
        return f"v{major}.{minor}.{int(patch) + 1}"


def push_tag(tag: str):
    subprocess.check_call(["git", "tag", tag])
    subprocess.check_call(["git", "push", "origin", tag])


def main():
    type = "path"
    if sys.argv[-1] == "minor":
        type = "minor"
    elif sys.argv[-1] == "major":
        type = "major"

    tag = get_latest_tag()
    new_tag = advance_version(tag, type)
    print("New tag: ", new_tag)
    push_tag(new_tag)


if __name__ == "__main__":
    main()
