#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows系统托盘应用程序
提供退出功能
"""

import sys
import os
import threading
import webbrowser
import pystray
from PIL import Image, ImageDraw

# 添加项目根目录到路径，以便导入service模块
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def start_service_in_thread():
    """
    启动service并返回端口号
    将mock_main相关的功能收敛到这个函数中
    """
    def _start_service():
        """在后台线程中启动service"""
        try:
            from service.mock_main import start
            print("正在启动service...")
            start()
        except Exception as e:
            print(f"启动service时发生错误: {e}")
            import traceback
            traceback.print_exc()
    
    # 启动service线程
    service_thread = threading.Thread(target=_start_service, daemon=True)
    service_thread.start()
    
    # 返回端口号
    return 9399


class TrayApp:
    def __init__(self, service_port=9399):
        self.icon = None
        self.running = True
        self.service_port = service_port
        
    def create_icon_image(self):
        """创建一个简单的图标图像（如果图标文件不存在时使用）"""
        # 创建一个64x64的图像
        image = Image.new('RGB', (64, 64), color='blue')
        draw = ImageDraw.Draw(image)
        # 绘制一个简单的圆形
        draw.ellipse([10, 10, 54, 54], fill='white', outline='black', width=2)
        return image
    
    def load_icon(self):
        """加载图标文件，如果不存在则使用默认图像"""
        icon_path = os.path.join(os.path.dirname(__file__), 'icon.ico')
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
        icon.stop()
    
    def on_left_click(self, icon, item):
        """双击托盘图标时打开服务页面"""
        self.open_service()
    
    def setup_menu(self):
        """设置托盘菜单"""
        menu = pystray.Menu(
            pystray.MenuItem('打开服务', self.open_service),
            pystray.MenuItem('退出', self.quit_app),
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
            default_action=self.on_left_click
        )
        
        # 运行图标（这会阻塞直到图标停止）
        self.icon.run()


def main():
    """主函数"""
    # 启动service并获取端口号
    service_port = start_service_in_thread()
    
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


if __name__ == '__main__':
    main()

