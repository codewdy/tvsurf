#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows系统托盘应用程序
提供退出功能
"""

import os
import webbrowser
import pystray
from PIL import Image, ImageDraw
from winapp.instance_check import check_single_instance, release_instance_check
from winapp.service_manager import (
    start_service_in_thread,
    wait_for_service_ready,
    SERVICE_PORT,
    stop_service,
)


class TrayApp:
    def __init__(self, service_port=SERVICE_PORT):
        self.icon = None
        self.running = True
        self.service_port = service_port

    def create_icon_image(self):
        """创建一个简单的图标图像（如果图标文件不存在时使用）"""
        # 创建一个64x64的图像
        image = Image.new("RGB", (64, 64), color="blue")
        draw = ImageDraw.Draw(image)
        # 绘制一个简单的圆形
        draw.ellipse([10, 10, 54, 54], fill="white", outline="black", width=2)
        return image

    def load_icon(self):
        """加载图标文件，如果不存在则使用默认图像"""
        icon_path = os.path.join(os.path.dirname(__file__), "icon.ico")
        if os.path.exists(icon_path):
            try:
                return Image.open(icon_path)
            except Exception as e:
                print(f"无法加载图标文件: {e}")
                return self.create_icon_image()
        else:
            print(f"图标文件不存在: {icon_path}，使用默认图标")
            return self.create_icon_image()

    def open_service(self, icon=None, item=None):
        """打开服务页面"""
        url = f"http://localhost:{self.service_port}"
        print(f"正在打开 {url}...")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"打开浏览器时发生错误: {e}")

    def quit_app(self, icon, item):
        """退出应用程序"""
        print("正在退出应用程序...")
        self.running = False
        # 释放单实例检测资源
        release_instance_check()
        stop_service()
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
    # 检测是否已有实例运行
    if check_single_instance():
        # 已有实例运行，只打开浏览器页面后退出
        print("检测到已有实例运行，只打开浏览器页面...")
        url = f"http://localhost:{SERVICE_PORT}"
        try:
            webbrowser.open(url)
            print(f"已打开 {url}")
        except Exception as e:
            print(f"打开浏览器时发生错误: {e}")
        return

    # 首次启动，正常启动服务和托盘应用
    # 启动service并获取端口号
    service_port = start_service_in_thread()

    # 等待服务启动完成
    print("等待服务启动...")
    if wait_for_service_ready(service_port, timeout=10):
        print("服务已启动，自动打开浏览器页面...")
        # 自动打开浏览器页面
        url = f"http://localhost:{service_port}"
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"打开浏览器时发生错误: {e}")
    else:
        print("警告: 等待服务启动超时，但将继续运行...")

    # 创建托盘应用，传入端口号
    app = TrayApp(service_port=service_port)
    try:
        app.run()
    except KeyboardInterrupt:
        print("程序被用户中断")
    except Exception as e:
        print(f"发生错误: {e}")
        import traceback

        traceback.print_exc()
    finally:
        # 确保释放单实例检测资源
        release_instance_check()
        stop_service()


if __name__ == "__main__":
    main()
