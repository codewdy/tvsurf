#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows系统托盘应用程序
提供退出功能
"""

import os
import webbrowser
import pystray
import sys
from PIL import Image


class TrayApp:
    def __init__(self, open_service_callback):
        self.icon = None
        self.running = True
        self.open_service_callback = open_service_callback

    def load_icon(self):
        """加载图标文件，如果不存在则使用默认图像"""
        if hasattr(sys, "_MEIPASS"):
            return Image.open(os.path.join(sys._MEIPASS, "assets", "icon.ico"))  # type: ignore[attr-defined]
        else:
            return Image.open(os.path.join(os.path.dirname(__file__), "icon.ico"))

    def open_service(self, icon=None, item=None):
        self.open_service_callback()

    def quit_app(self, icon, item):
        """退出应用程序"""
        print("正在退出应用程序...")
        self.running = False
        icon.stop()

    def setup_menu(self):
        """设置托盘菜单"""
        menu = pystray.Menu(
            pystray.MenuItem("打开服务", self.open_service),
            pystray.MenuItem("退出", self.quit_app),
        )
        return menu

    def run(self):
        """运行托盘应用程序"""
        # 加载图标
        icon_image = self.load_icon()

        # 创建托盘图标
        self.icon = pystray.Icon(
            "TrayApp",
            icon_image,
            "系统托盘应用",
            self.setup_menu(),
        )

        # 运行图标（这会阻塞直到图标停止）
        self.icon.run()
