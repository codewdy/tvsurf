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


def default_config_path():
    if hasattr(sys, "_MEIPASS"):
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

        tray_app = TrayApp(open_service)
        tray_app.run()
    finally:
        # 确保释放单实例检测资源
        release_instance_check()
        app.stop_thread()


if __name__ == "__main__":
    main()
