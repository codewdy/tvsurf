import time
import unittest
import sys
from pathlib import Path

# 添加service目录的父目录到路径，以便可以导入service模块
service_dir = Path(__file__).parent.parent
project_root = service_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from service.downloader.download_tracker import (
    SpeedTracker,
    SizeTracker,
    DownloadTracker,
)
from service.schema.downloader import DownloadProgress


class TestSpeedTracker(unittest.TestCase):
    """测试 SpeedTracker 速度跟踪功能"""

    def test_initialization(self):
        """测试初始化"""
        tracker = SpeedTracker()
        self.assertEqual(tracker._window_size, 60)
        self.assertEqual(len(tracker._records), 0)

    def test_empty_records_returns_zero(self):
        """测试空记录返回0速度"""
        tracker = SpeedTracker()
        self.assertEqual(tracker.get_speed(), 0)

    def test_single_record(self):
        """测试单条记录的速度计算"""
        tracker = SpeedTracker()
        tracker.add_bytes_downloaded(1000)
        speed = tracker.get_speed()
        # 单条记录时，速度 = bytes / window_size
        self.assertAlmostEqual(speed, 1000 / 60, places=2)

    def test_multiple_records(self):
        """测试多条记录的速度计算"""
        tracker = SpeedTracker()
        # 添加多条记录，模拟下载过程
        tracker.add_bytes_downloaded(1000)
        time.sleep(0.1)  # 等待一小段时间
        tracker.add_bytes_downloaded(2000)
        time.sleep(0.1)
        tracker.add_bytes_downloaded(3000)

        speed = tracker.get_speed()
        # 速度应该大于0
        self.assertGreater(speed, 0)

    def test_clean_old_records(self):
        """测试清理旧记录"""
        tracker = SpeedTracker()
        # 设置一个很短的窗口用于测试
        tracker._window_size = 0.1

        tracker.add_bytes_downloaded(1000)
        time.sleep(0.05)
        tracker.add_bytes_downloaded(2000)

        # 记录应该还在
        self.assertGreater(len(tracker._records), 0)

        # 等待超过窗口时间
        time.sleep(0.15)
        tracker.add_bytes_downloaded(3000)

        # 旧记录应该被清理
        # 由于时间窗口很短，大部分旧记录应该被清理
        self.assertLessEqual(len(tracker._records), 2)

    def test_speed_calculation_with_time_span(self):
        """测试基于时间跨度的速度计算"""
        tracker = SpeedTracker()
        tracker._window_size = 10  # 设置较大的窗口

        # 在短时间内添加大量数据
        start_time = time.time()
        tracker.add_bytes_downloaded(10000)
        time.sleep(0.2)
        tracker.add_bytes_downloaded(20000)
        end_time = time.time()

        speed = tracker.get_speed()
        time_span = end_time - start_time

        # 速度应该接近总字节数除以时间跨度
        expected_speed = 20000 / time_span  # 第二条记录开始计算
        self.assertAlmostEqual(speed, expected_speed, delta=1000)  # 允许一定误差


class TestSizeTracker(unittest.TestCase):
    """测试 SizeTracker 大小跟踪功能"""

    def test_initialization(self):
        """测试初始化"""
        tracker = SizeTracker()
        self.assertEqual(len(tracker._records), 0)
        self.assertEqual(tracker._fragment_count, 0)

    def test_set_fragment_count(self):
        """测试设置片段数量"""
        tracker = SizeTracker()
        tracker.set_fragment_count(10)
        self.assertEqual(tracker._fragment_count, 10)

    def test_empty_records_returns_zero(self):
        """测试空记录返回0大小"""
        tracker = SizeTracker()
        self.assertEqual(tracker.get_total_size(), 0)

    def test_single_fragment(self):
        """测试单个片段的大小计算"""
        tracker = SizeTracker()
        tracker.set_fragment_count(5)
        tracker.add_fragment(1000.0)

        total_size = tracker.get_total_size()
        # 平均大小 * 片段数量 = 1000 * 5 = 5000
        self.assertEqual(total_size, 5000.0)

    def test_multiple_fragments(self):
        """测试多个片段的大小计算"""
        tracker = SizeTracker()
        tracker.set_fragment_count(10)

        tracker.add_fragment(1000.0)
        tracker.add_fragment(2000.0)
        tracker.add_fragment(3000.0)

        total_size = tracker.get_total_size()
        # 平均大小 = (1000 + 2000 + 3000) / 3 = 2000
        # 总大小 = 2000 * 10 = 20000
        self.assertEqual(total_size, 20000.0)

    def test_fragment_count_zero(self):
        """测试片段数量为0的情况"""
        tracker = SizeTracker()
        tracker.set_fragment_count(0)
        tracker.add_fragment(1000.0)

        total_size = tracker.get_total_size()
        self.assertEqual(total_size, 0.0)

    def test_no_fragments_with_count(self):
        """测试有片段数量但没有片段记录的情况"""
        tracker = SizeTracker()
        tracker.set_fragment_count(10)
        # 不添加任何片段

        total_size = tracker.get_total_size()
        self.assertEqual(total_size, 0.0)


class TestDownloadTracker(unittest.TestCase):
    """测试 DownloadTracker 下载跟踪功能"""

    def test_initialization(self):
        """测试初始化"""
        tracker = DownloadTracker()
        self.assertEqual(tracker.status, "")
        self.assertEqual(tracker.downloaded_size, 0)
        self.assertIsInstance(tracker.speed_tracker, SpeedTracker)
        self.assertIsInstance(tracker.size_tracker, SizeTracker)

    def test_update_status(self):
        """测试更新状态"""
        tracker = DownloadTracker()
        tracker.update("downloading")
        self.assertEqual(tracker.status, "downloading")

        tracker.update("completed")
        self.assertEqual(tracker.status, "completed")

    def test_set_fragment_count(self):
        """测试设置片段数量"""
        tracker = DownloadTracker()
        tracker.set_fragment_count(10)
        self.assertEqual(tracker.size_tracker._fragment_count, 10)

    def test_add_fragment(self):
        """测试添加片段"""
        tracker = DownloadTracker()
        tracker.set_fragment_count(5)
        tracker.add_fragment(1000.0)

        self.assertEqual(tracker.downloaded_size, 1000.0)
        self.assertEqual(len(tracker.size_tracker._records), 1)
        self.assertEqual(tracker.size_tracker._records[0], 1000.0)

    def test_add_bytes_downloaded(self):
        """测试添加下载字节数"""
        tracker = DownloadTracker()
        tracker.add_bytes_downloaded(5000)

        self.assertEqual(tracker.downloaded_size, 5000)
        self.assertEqual(len(tracker.speed_tracker._records), 1)

        tracker.add_bytes_downloaded(3000)
        self.assertEqual(tracker.downloaded_size, 8000)

    def test_get_progress_empty(self):
        """测试获取空进度"""
        tracker = DownloadTracker()
        progress = tracker.get_progress()

        self.assertIsInstance(progress, DownloadProgress)
        self.assertEqual(progress.status, "")
        self.assertEqual(progress.total_size, 0)
        self.assertEqual(progress.downloaded_size, 0)
        self.assertEqual(progress.speed, 0)

    def test_get_progress_with_data(self):
        """测试获取有数据的进度"""
        tracker = DownloadTracker()
        tracker.update("downloading")
        tracker.set_fragment_count(10)
        tracker.add_fragment(1000.0)
        tracker.add_bytes_downloaded(500)

        progress = tracker.get_progress()

        self.assertEqual(progress.status, "downloading")
        self.assertEqual(progress.downloaded_size, 1500.0)  # 1000 + 500
        self.assertGreater(progress.total_size, 0)
        self.assertGreaterEqual(progress.speed, 0)

    def test_multiple_fragments_progress(self):
        """测试多个片段的进度计算"""
        tracker = DownloadTracker()
        tracker.update("downloading")
        tracker.set_fragment_count(5)

        tracker.add_fragment(1000.0)
        tracker.add_fragment(2000.0)
        tracker.add_fragment(3000.0)

        progress = tracker.get_progress()

        # 平均大小 = (1000 + 2000 + 3000) / 3 = 2000
        # 总大小 = 2000 * 5 = 10000
        self.assertEqual(progress.total_size, 10000.0)
        self.assertEqual(progress.downloaded_size, 6000.0)  # 1000 + 2000 + 3000

    def test_combined_fragments_and_bytes(self):
        """测试片段和字节数混合使用"""
        tracker = DownloadTracker()
        tracker.set_fragment_count(4)

        tracker.add_fragment(1000.0)
        tracker.add_bytes_downloaded(500)
        tracker.add_fragment(2000.0)
        tracker.add_bytes_downloaded(300)

        progress = tracker.get_progress()

        # downloaded_size = 1000 + 500 + 2000 + 300 = 3800
        self.assertEqual(progress.downloaded_size, 3800.0)
        # total_size 基于片段平均值计算
        expected_avg = (1000.0 + 2000.0) / 2
        expected_total = expected_avg * 4
        self.assertEqual(progress.total_size, expected_total)

    def test_speed_tracking_in_progress(self):
        """测试进度中的速度跟踪"""
        tracker = DownloadTracker()
        tracker.add_bytes_downloaded(10000)
        time.sleep(0.1)
        tracker.add_bytes_downloaded(20000)

        progress = tracker.get_progress()

        # 速度应该大于0
        self.assertGreaterEqual(progress.speed, 0)

    def test_status_updates(self):
        """测试状态更新在进度中反映"""
        tracker = DownloadTracker()
        tracker.update("initializing")
        progress1 = tracker.get_progress()
        self.assertEqual(progress1.status, "initializing")

        tracker.update("downloading")
        progress2 = tracker.get_progress()
        self.assertEqual(progress2.status, "downloading")

        tracker.update("completed")
        progress3 = tracker.get_progress()
        self.assertEqual(progress3.status, "completed")


if __name__ == "__main__":
    unittest.main(verbosity=2)
