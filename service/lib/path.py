import sys
import os
import platform
from functools import cache


def select_path(*paths: str):
    for path in paths:
        if os.path.exists(path):
            return path
    return None


@cache
def deps_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "deps")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "..", "deps")


@cache
def chromium_path():
    if platform.system() == "Windows":
        return os.path.join(
            deps_path(), "chrome-headless-shell-win64", "chrome-headless-shell.exe"
        )
    elif platform.system() == "Linux":
        return select_path(
            os.path.join(
                deps_path(), "chrome-headless-shell-linux64", "chrome-headless-shell"
            ),
            os.path.join(deps_path(), "chrome-linux", "headless_shell"),
        )
    elif platform.system() == "Darwin":
        return os.path.join(
            deps_path(), "chrome-headless-shell-mac-arm64", "chrome-headless-shell"
        )
    else:
        return None


@cache
def searcher_config_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "searcher", "searcher.json")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "searcher.json")


@cache
def ffmpeg_path():
    if platform.system() == "Windows":
        return os.path.join(deps_path(), "ffmpeg", "ffmpeg.exe")
    elif platform.system() == "Linux":
        return os.path.join(deps_path(), "ffmpeg", "ffmpeg")
    elif platform.system() == "Darwin":
        return os.path.join(deps_path(), "ffmpeg", "ffmpeg")
    else:
        return "ffmpeg"


@cache
def web_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "web")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "..", "web", "build", "client")
