#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务管理模块
负责服务的启动、检测等操作
"""

from service.app import App


# 服务端口号
SERVICE_PORT = 9399


app = App()


def wait_for_service_ready(port: int = SERVICE_PORT, timeout: int = 10) -> bool:
    app.wait_start()
    return True


def start_service_in_thread(port: int = SERVICE_PORT) -> int:
    app.thread_serve()
    return SERVICE_PORT


def stop_service():
    app.stop_thread()
