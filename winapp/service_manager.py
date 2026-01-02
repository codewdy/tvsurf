#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务管理模块
负责服务的启动、检测等操作
"""

import threading
import time
import socket
from service.mock_main import start


# 服务端口号
SERVICE_PORT = 9399


def wait_for_service_ready(port: int = SERVICE_PORT, timeout: int = 10) -> bool:
    """
    等待服务启动完成（通过端口检测）
    
    Args:
        port: 服务端口号
        timeout: 超时时间（秒）
    
    Returns:
        bool: 服务是否就绪
    """
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def start_service_in_thread(port: int = SERVICE_PORT) -> int:
    """
    启动service并返回端口号
    将mock_main相关的功能收敛到这个函数中
    
    Args:
        port: 服务端口号
    
    Returns:
        int: 服务端口号
    """
    def _start_service():
        """在后台线程中启动service"""
        try:
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
    return port

