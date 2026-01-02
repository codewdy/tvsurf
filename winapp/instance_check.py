#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单实例检测模块
提供跨平台的单实例检测功能
"""

import sys
import atexit
from typing import Optional, Any


class SingleInstanceChecker:
    """
    单实例检测器基类
    用于检测应用是否已有实例在运行
    """
    
    def __init__(self, app_name: str = "TVSurf_TrayApp"):
        """
        初始化单实例检测器
        
        Args:
            app_name: 应用名称，用于创建互斥体/锁的唯一标识
        """
        self.app_name = app_name
        self._handle: Optional[Any] = None
    
    def is_existing_instance(self) -> bool:
        """
        检测是否已有实例运行
        
        Returns:
            bool: True表示已有实例运行，False表示这是第一个实例
        """
        raise NotImplementedError("子类必须实现此方法")
    
    def cleanup(self):
        """清理资源"""
        raise NotImplementedError("子类必须实现此方法")


class WindowsSingleInstanceChecker(SingleInstanceChecker):
    """Windows平台的单实例检测器实现（使用命名互斥体）"""
    
    def __init__(self, app_name: str = "TVSurf_TrayApp"):
        super().__init__(app_name)
        self._has_win32 = False
        
        try:
            import win32event  # type: ignore
            import win32api  # type: ignore
            import winerror  # type: ignore
            self._win32event = win32event
            self._win32api = win32api
            self._winerror = winerror
            self._has_win32 = True
        except ImportError:
            self._has_win32 = False
    
    def is_existing_instance(self) -> bool:
        """
        使用Windows命名互斥体检测是否已有实例运行
        
        Returns:
            bool: True表示已有实例运行，False表示这是第一个实例
        """
        if not self._has_win32:
            # 非Windows系统，无法使用互斥体，假设没有其他实例
            print("警告: 非Windows系统，无法进行单实例检测")
            return False
        
        try:
            # 创建互斥体，如果已存在则返回现有句柄
            mutex = self._win32event.CreateMutex(None, False, self.app_name)  # type: ignore
            last_error = self._win32api.GetLastError()
            
            if last_error == self._winerror.ERROR_ALREADY_EXISTS:
                # 互斥体已存在，说明已有实例运行
                self._win32api.CloseHandle(mutex)
                return True
            else:
                # 成功创建互斥体，这是第一个实例
                self._handle = mutex
                # 注册清理函数
                atexit.register(self.cleanup)
                return False
        except Exception as e:
            # 如果创建失败，假设没有其他实例（降级处理）
            print(f"创建互斥体时发生错误: {e}，继续运行...")
            return False
    
    def cleanup(self):
        """释放互斥体句柄"""
        if self._handle and self._has_win32:
            try:
                self._win32api.CloseHandle(self._handle)
                self._handle = None
            except Exception as e:
                print(f"释放互斥体时发生错误: {e}")


# 平台检测和默认实现选择
def create_checker(app_name: str = "TVSurf_TrayApp") -> SingleInstanceChecker:
    """
    根据当前平台创建合适的单实例检测器
    
    Args:
        app_name: 应用名称
    
    Returns:
        SingleInstanceChecker: 单实例检测器实例
    """
    if sys.platform == "win32":
        return WindowsSingleInstanceChecker(app_name)
    else:
        # 未来可以添加其他平台的实现
        # 例如: return LinuxSingleInstanceChecker(app_name)
        # 或者: return MacSingleInstanceChecker(app_name)
        # 目前返回Windows实现（即使不在Windows上也会降级处理）
        return WindowsSingleInstanceChecker(app_name)


# 便捷函数（保持向后兼容）
_checker_instance: Optional[SingleInstanceChecker] = None


def check_single_instance(app_name: str = "TVSurf_TrayApp") -> bool:
    """
    检测是否已有实例运行的便捷函数
    
    Args:
        app_name: 应用名称
    
    Returns:
        bool: True表示已有实例运行，False表示这是第一个实例
    """
    global _checker_instance
    if _checker_instance is None:
        _checker_instance = create_checker(app_name)
    return _checker_instance.is_existing_instance()


def release_instance_check():
    """释放单实例检测资源的便捷函数"""
    global _checker_instance
    if _checker_instance is not None:
        _checker_instance.cleanup()
        _checker_instance = None

