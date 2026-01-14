import sys
import os
import platform
from functools import cache


@cache
def deps_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "deps")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "..", "deps")


@cache
def chromium_path():
    if platform.system() == "Windows":
        return os.path.join(deps_path(), "chrome-win64", "chrome.exe")
    elif platform.system() == "Linux":
        return os.path.join(deps_path(), "chrome-linux64", "chrome")
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
    else:
        return "ffmpeg"


@cache
def web_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "web")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "..", "web", "build", "client")
