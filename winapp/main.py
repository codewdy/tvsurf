#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows系统托盘应用程序
提供退出功能
"""

import webbrowser
from winapp.instance_check import check_single_instance, release_instance_check
from service.app import App
from winapp.tray_app import TrayApp
import argparse
import sys
import os
import platform
import shutil


def default_config_path():
    if (
        platform.system() == "Darwin"
        and hasattr(sys, "_MEIPASS")
        and ".app" in sys.argv[0]
    ):
        if sys.argv[0].startswith("/Applications/"):
            user_home = os.path.expanduser("~")
            data_dir = os.path.join(
                user_home, "Library", "Application Support", "com.codewdy.tvsurf"
            )
            if not os.path.exists(data_dir):
                os.makedirs(data_dir)
            if not os.path.exists(os.path.join(data_dir, "config.yaml")):
                shutil.copy(
                    os.path.join(sys._MEIPASS, "assets", "config.yaml"),  # type: ignore[attr-defined]
                    os.path.join(data_dir, "config.yaml"),
                )
            return os.path.join(data_dir, "config.yaml")
        else:
            return os.path.join(
                os.path.dirname(sys.argv[0]), "..", "..", "..", "config.yaml"
            )
    elif hasattr(sys, "_MEIPASS"):
        return os.path.join(os.path.dirname(sys.argv[0]), "config.yaml")
    else:
        return "config.yaml"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config", default=default_config_path(), help="config file path"
    )
    args = parser.parse_args()

    app = App(args.config)

    def open_service():
        url = f"http://localhost:{app.port()}"
        webbrowser.open(url)

    # 检测是否已有实例运行
    if check_single_instance():
        open_service()
        return

    app.thread_serve()
    try:
        app.wait_start()
        open_service()

        tray_app = TrayApp(open_service, app.config.data_dir)
        tray_app.run()
    finally:
        # 确保释放单实例检测资源
        release_instance_check()
        app.stop_thread()


if __name__ == "__main__":
    main()
