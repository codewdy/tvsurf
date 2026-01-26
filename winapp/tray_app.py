#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows系统托盘应用程序
提供退出功能
"""

import os
import time
import webbrowser
import pystray
import sys
from PIL import Image
import platform


class TrayApp:
    def __init__(self, open_service_callback):
        self.icon = None
        self.running = True
        self.open_service_callback = open_service_callback
        self.last_click_time = 0
        self.double_click_threshold = 0.5  # 双击时间间隔阈值（秒）

    def load_icon(self):
        """加载图标文件，如果不存在则使用默认图像"""
        if platform.system() == "Darwin":
            filename = "mac_icon.ico"
        else:
            filename = "icon.ico"
        if hasattr(sys, "_MEIPASS"):
            return Image.open(os.path.join(sys._MEIPASS, "assets", filename))  # type: ignore[attr-defined]
        else:
            return Image.open(os.path.join(os.path.dirname(__file__), filename))

    def open_service(self, icon=None, item=None):
        self.open_service_callback()

    def handle_icon_click(self, icon, item):
        """处理图标点击事件，检测是否为双击"""
        current_time = time.time()

        # 如果这是第一次点击，记录时间并返回
        if self.last_click_time == 0:
            self.last_click_time = current_time
            return

        # 计算距离上次点击的时间间隔
        time_since_last_click = current_time - self.last_click_time

        if time_since_last_click <= self.double_click_threshold:
            # 在阈值时间内再次点击，视为双击，打开服务
            self.open_service_callback()
            # 重置时间戳，避免连续双击被多次识别
            self.last_click_time = 0
        else:
            # 超过阈值，视为新的单击，更新时间戳
            self.last_click_time = current_time

    def quit_app(self, icon, item):
        """退出应用程序"""
        print("正在退出应用程序...")
        self.running = False
        icon.stop()

    def setup_menu(self):
        """设置托盘菜单"""
        # 创建一个隐藏的默认菜单项来处理双击事件
        # 在Windows上，双击图标会触发默认菜单项
        menu = pystray.Menu(
            pystray.MenuItem("打开服务", self.open_service),
            pystray.MenuItem("退出", self.quit_app),
            pystray.MenuItem(
                "双击打开", self.handle_icon_click, default=True, visible=False
            ),
        )
        return menu

    def run(self):
        """运行托盘应用程序"""
        # 加载图标
        icon_image = self.load_icon()

        # 创建托盘图标
        self.icon = pystray.Icon(
            "tvsurf",
            icon_image,
            "tvsurf",
            self.setup_menu(),
        )

        # 运行图标（这会阻塞直到图标停止）
        self.icon.run()
