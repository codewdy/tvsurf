from playwright_downloader import download_all_browsers
from download_ffmpeg import download_ffmpeg
from pathlib import Path
import os
import argparse


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
