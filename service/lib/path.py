import sys
import os
import platform


def chromium_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "chrome-win64", "chrome.exe")  # type: ignore[attr-defined]
    return None


def searcher_config_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "searcher", "searcher.json")  # type: ignore[attr-defined]
    return os.path.join(os.path.dirname(__file__), "..", "searcher.json")


def ffmpeg_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "ffmpeg", "ffmpeg.exe")  # type: ignore[attr-defined]
    if platform.system() == "Windows":
        return os.path.join(os.path.dirname(__file__), "..", "..", "ffmpeg.exe")
    return "ffmpeg"


def web_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "web")  # type: ignore[attr-defined]
    return os.path.join(
        os.path.dirname(__file__), "..", "..", "test-web", "build", "client"
    )
