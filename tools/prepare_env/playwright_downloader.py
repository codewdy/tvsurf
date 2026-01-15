#!/usr/bin/env python3
"""
解析 Playwright 浏览器下载信息格式的脚本
"""

import re
import subprocess
from dataclasses import dataclass
from typing import List, Optional
from pathlib import Path
import sys
import os
from utils import unzip_preserve_permissions, pretty_download


@dataclass
class BrowserInfo:
    """浏览器信息数据类"""

    name: str
    version: Optional[str] = None
    install_location: Optional[str] = None
    download_url: Optional[str] = None
    download_fallback_1: Optional[str] = None
    download_fallback_2: Optional[str] = None

    def __str__(self):
        result = f"browser: {self.name}"
        if self.version:
            result += f" version {self.version}"
        if self.install_location:
            result += f"\n  Install location:    {self.install_location}"
        if self.download_url:
            result += f"\n  Download url:        {self.download_url}"
        if self.download_fallback_1:
            result += f"\n  Download fallback 1: {self.download_fallback_1}"
        if self.download_fallback_2:
            result += f"\n  Download fallback 2: {self.download_fallback_2}"
        return result


def parse_playwright_info(text: str) -> List[BrowserInfo]:
    """
    解析 Playwright 浏览器信息文本

    Args:
        text: 包含浏览器信息的文本

    Returns:
        浏览器信息列表
    """
    browsers = []
    lines = text.strip().split("\n")

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 匹配浏览器名称和版本
        # 格式: browser: <name> version <version> 或 browser: <name>
        match = re.match(r"browser:\s+(.+?)(?:\s+version\s+(.+))?$", line)
        if match:
            name = match.group(1).strip()
            version = match.group(2).strip() if match.group(2) else None

            browser = BrowserInfo(name=name, version=version)
            i += 1

            # 解析后续的属性行
            while i < len(lines):
                next_line = lines[i].strip()

                # 如果遇到新的浏览器条目，停止当前解析
                if next_line.startswith("browser:"):
                    break

                # 解析 Install location
                if next_line.startswith("Install location:"):
                    browser.install_location = next_line.split(":", 1)[1].strip()

                # 解析 Download url
                elif next_line.startswith("Download url:"):
                    browser.download_url = next_line.split(":", 1)[1].strip()

                # 解析 Download fallback 1
                elif next_line.startswith("Download fallback 1:"):
                    browser.download_fallback_1 = next_line.split(":", 1)[1].strip()

                # 解析 Download fallback 2
                elif next_line.startswith("Download fallback 2:"):
                    browser.download_fallback_2 = next_line.split(":", 1)[1].strip()

                i += 1

            browsers.append(browser)
        else:
            i += 1

    return browsers


def get_playwright_info() -> List[BrowserInfo]:
    """
    执行 playwright install --dry-run 命令并解析输出

    Returns:
        浏览器信息列表

    Raises:
        subprocess.CalledProcessError: 如果命令执行失败
        FileNotFoundError: 如果 playwright 命令未找到
    """
    try:
        result = subprocess.run(
            ["playwright", "install", "--dry-run"],
            capture_output=True,
            text=True,
            check=True,
        )
        return parse_playwright_info(result.stdout)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"playwright install --dry-run 执行失败: {e.stderr}") from e
    except FileNotFoundError:
        raise FileNotFoundError("未找到 playwright 命令，请确保已安装 playwright")


def download_browser(browser: BrowserInfo, file_path: str):
    """下载浏览器文件并显示进度条"""
    print(f"下载浏览器: {browser.name} (有时下载会比较慢，可以手动重试一下)")

    for attr in ["download_fallback_2", "download_fallback_1", "download_url"]:
        url = getattr(browser, attr)
        if not url:
            continue

        try:
            pretty_download(browser.name, url, file_path)
            print(f"✓ {browser.name} 下载完成")
            return

        except Exception as e:
            print(f"✗ 下载失败 ({url}): {e}")
            continue

    raise RuntimeError(f"所有下载链接都失败，无法下载 {browser.name}")


def download_all_browsers(directory: str):
    os.makedirs(directory, exist_ok=True)
    browsers = get_playwright_info()
    for browser in browsers:
        if browser.name in ["chromium-headless-shell"]:
            download_browser(browser, f"{directory}/{browser.name}.zip")
            unzip_preserve_permissions(f"{directory}/{browser.name}.zip", directory)
            os.remove(f"{directory}/{browser.name}.zip")
