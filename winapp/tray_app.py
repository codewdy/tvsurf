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
from PIL import Image, ImageDraw
from winapp.instance_check import check_single_instance, release_instance_check
from service.app import App


class TrayApp:
    def __init__(self, service_port):
        self.icon = None
        self.running = True
        self.service_port = service_port

    def load_icon(self):
        """加载图标文件，如果不存在则使用默认图像"""
        if hasattr(sys, "_MEIPASS"):
            return Image.open(os.path.join(sys._MEIPASS, "assets", "icon.ico"))  # type: ignore[attr-defined]
        else:
            return Image.open(os.path.join(os.path.dirname(__file__), "icon.ico"))

    def open_service(self, icon=None, item=None):
        url = f"http://localhost:{self.service_port}"
        webbrowser.open(url)

    def quit_app(self, icon, item):
        """退出应用程序"""
        print("正在退出应用程序...")
        self.running = False
        icon.stop()

    def on_left_click(self, icon, item):
        """双击托盘图标时打开服务页面"""
        self.open_service()

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
            default_action=self.on_left_click,
        )

        # 运行图标（这会阻塞直到图标停止）
        self.icon.run()


def main():
    """主函数"""
    app = App()

    # 检测是否已有实例运行
    if check_single_instance():
        print("检测到已有实例运行，只打开浏览器页面...")
        url = f"http://localhost:{app.port()}"
        webbrowser.open(url)
        return

    app.thread_serve()
    app.wait_start()
    url = f"http://localhost:{app.port()}"
    webbrowser.open(url)

    # 创建托盘应用，传入端口号
    tray_app = TrayApp(service_port=app.port())
    try:
        tray_app.run()
    finally:
        # 确保释放单实例检测资源
        release_instance_check()
        app.stop_thread()


if __name__ == "__main__":
    main()
