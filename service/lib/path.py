import sys
import os


def chromium_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "chrome-win64", "chrome.exe")  # type: ignore[attr-defined]
    return None


def searcher_config_path():
    return os.path.join(os.path.dirname(__file__), "..", "searcher.json")
