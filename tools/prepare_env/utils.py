import urllib.request
from tqdm import tqdm
import zipfile
import stat
import os


def pretty_download(desc: str, url: str, file_path: str):
    # 打开连接并获取文件大小
    with urllib.request.urlopen(url) as response:
        total_size = int(response.headers.get("Content-Length", 0))

        # 下载文件并显示进度条
        with open(file_path, "wb") as out_file, tqdm(
            desc=desc,
            total=total_size if total_size > 0 else None,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
        ) as pbar:
            while True:
                chunk = response.read(8192)  # 8KB chunks
                if not chunk:
                    break
                out_file.write(chunk)
                pbar.update(len(chunk))


def unzip_preserve_permissions(archive_path: str, extract_dir: str):
    """
    解压 zip 文件并保留执行权限

    Args:
        archive_path: zip 文件路径
        extract_dir: 解压目标目录
    """
    with zipfile.ZipFile(archive_path, "r") as zip_ref:
        # 获取所有文件信息
        for info in zip_ref.infolist():
            # 解压文件
            zip_ref.extract(info, extract_dir)

            # 获取解压后的文件路径
            extracted_path = os.path.join(extract_dir, info.filename)

            # 如果 zip 文件中的文件有执行权限（Unix 权限），则恢复它
            # zipfile 的 external_attr 字段包含文件属性
            # Unix 权限在 external_attr 的高 16 位
            unix_permissions = (info.external_attr >> 16) & 0o777

            if unix_permissions:
                # 如果 zip 文件中保存了权限信息，使用它
                os.chmod(extracted_path, unix_permissions)
            else:
                # 如果没有权限信息，检查文件是否应该是可执行的
                # 通常可执行文件没有扩展名或者是特定的文件名
                file_name = os.path.basename(info.filename)
                # 常见的可执行文件名模式
                executable_patterns = [
                    "chrome",
                    "chrome-wrapper",
                    "chrome_sandbox",
                    "chrome_crashpad_handler",
                    "ffmpeg",
                    "ffprobe",
                ]
                # 检查文件名是否匹配可执行文件模式，或者没有扩展名
                if (
                    any(pattern in file_name for pattern in executable_patterns)
                    or "." not in file_name
                ):
                    # 添加执行权限
                    current_mode = os.stat(extracted_path).st_mode
                    os.chmod(
                        extracted_path,
                        current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH,
                    )
