from utils import pretty_download
import shutil
import os
import sys
import stat
import platform

# owncast/ffmpeg-builds static macOS builds
FFMPEG_MAC_RELEASE = "20260503142706"


def download_ffmpeg_linux(directory: str):
    print("下载 ffmpeg 中, 请稍候...")
    if platform.machine() == "aarch64":
        url = (
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/"
            "latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz"
        )
    else:
        url = (
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/"
            "latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
        )
    pretty_download("ffmpeg", url, f"{directory}/ffmpeg-linux.tar.xz")
    print(f"解压 ffmpeg 中, 请稍候...")
    shutil.unpack_archive(f"{directory}/ffmpeg-linux.tar.xz", directory)
    os.remove(f"{directory}/ffmpeg-linux.tar.xz")
    extract_dir = url.split("/")[-1].split(".")[0]
    os.makedirs(f"{directory}/ffmpeg", exist_ok=True)
    shutil.move(f"{directory}/{extract_dir}/bin/ffmpeg", f"{directory}/ffmpeg/ffmpeg")
    shutil.move(
        f"{directory}/{extract_dir}/LICENSE.txt", f"{directory}/ffmpeg/LICENSE.txt"
    )
    shutil.rmtree(f"{directory}/{extract_dir}")
    print(f"ffmpeg 下载完成")


def download_ffmpeg_windows(directory: str):
    print("下载 ffmpeg 中, 请稍候...")
    url = (
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/"
        "latest/ffmpeg-master-latest-win64-gpl-shared.zip"
    )
    pretty_download("ffmpeg", url, f"{directory}/ffmpeg-windows.zip")
    print(f"解压 ffmpeg 中, 请稍候...")
    shutil.unpack_archive(f"{directory}/ffmpeg-windows.zip", directory)
    os.remove(f"{directory}/ffmpeg-windows.zip")
    extract_dir = url.split("/")[-1].split(".")[0]
    shutil.rmtree(f"{directory}/ffmpeg", ignore_errors=True)
    shutil.move(f"{directory}/{extract_dir}/bin", f"{directory}/ffmpeg")
    shutil.move(
        f"{directory}/{extract_dir}/LICENSE.txt", f"{directory}/ffmpeg/LICENSE.txt"
    )
    shutil.rmtree(f"{directory}/{extract_dir}")
    print(f"ffmpeg 下载完成")


def download_ffmpeg_mac(directory: str):
    print("下载 ffmpeg 中, 请稍候...")
    url = (
        "https://github.com/owncast/ffmpeg-builds/releases/download/"
        f"{FFMPEG_MAC_RELEASE}/ffmpeg8.0-darwin-arm64.tar.gz"
    )
    archive_path = f"{directory}/ffmpeg-mac.tar.gz"
    pretty_download("ffmpeg", url, archive_path)
    print(f"解压 ffmpeg 中, 请稍候...")
    os.makedirs(f"{directory}/ffmpeg", exist_ok=True)
    shutil.unpack_archive(archive_path, f"{directory}/ffmpeg")
    os.remove(archive_path)
    ffmpeg_bin = f"{directory}/ffmpeg/ffmpeg"
    os.chmod(
        ffmpeg_bin,
        os.stat(ffmpeg_bin).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH,
    )
    print(f"ffmpeg 下载完成")


def download_ffmpeg(directory: str):
    if platform.system() == "Linux":
        download_ffmpeg_linux(directory)
    elif platform.system() == "Windows":
        download_ffmpeg_windows(directory)
    elif platform.system() == "Darwin":
        download_ffmpeg_mac(directory)
    else:
        raise ValueError(f"不支持的操作系统: {platform.system()}")


if __name__ == "__main__":
    download_ffmpeg_mac(sys.argv[-1])
