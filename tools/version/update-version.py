#!/usr/bin/env python3

import re
import json
import os
import sys


def update_app_version(version: str):
    filepath = os.path.join(os.path.dirname(__file__), "..", "..", "app", "app.json")
    with open(filepath, "r", encoding="utf-8") as f:
        app_json = json.load(f)
    app_json["expo"]["version"] = version
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(app_json, f, indent=2, ensure_ascii=False)


def update_package(version: str):
    filepath = os.path.join(
        os.path.dirname(__file__), "..", "..", "package", "package.json"
    )
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump({"version": version}, f, indent=2, ensure_ascii=False)


def get_version_from_tag(tag: str):
    """
    Get the version from the tag string.
    """
    if not re.match(r"^v\d+\.\d+\.\d+$", tag):
        return None
    return tag[1:]


def update_version(tag: str):
    version = get_version_from_tag(tag)
    if version is None:
        return
    update_app_version(version)
    update_package(version)


if __name__ == "__main__":
    update_version(sys.argv[-1])
