from playwright_downloader import download_all_browsers
from download_ffmpeg import download_ffmpeg
from pathlib import Path
import os
import argparse
import sys

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", "-d", default="deps")
    args = parser.parse_args()

    directory = Path(args.directory)
    if (directory / "done.txt").exists():
        print("环境已准备好，跳过下载")
        return

    os.makedirs(directory, exist_ok=True)

    download_all_browsers(directory.as_posix())
    download_ffmpeg(directory.as_posix())

    (directory / "done.txt").touch()


if __name__ == "__main__":
    main()
