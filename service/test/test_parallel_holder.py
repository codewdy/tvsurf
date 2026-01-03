import asyncio
import unittest
import sys
from pathlib import Path

# 添加service目录的父目录到路径，以便可以导入service模块
service_dir = Path(__file__).parent.parent
project_root = service_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from service.lib.parallel_holder import ParallelHolder


class TestParallelHolder(unittest.TestCase):
    """测试 ParallelHolder 并发控制功能"""

    def test_initialization(self):
        """测试初始化"""
        holder = ParallelHolder(max_concurrent=3)
        self.assertEqual(holder.max_concurrent, 3)
        self.assertEqual(len(holder.events), 0)
        self.assertEqual(len(holder.tasks), 0)
        self.assertEqual(len(holder.running_tasks), 0)
        self.assertEqual(holder.id_counter, 0)

    def test_basic_scheduling(self):
        """测试基本任务调度"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=2)

            # 记录执行的任务ID
            executed = []

            async def task(id: int):
                executed.append(id)
                await asyncio.sleep(0.1)

            # 调度2个任务
            id1 = holder.schedule(task(1))
            id2 = holder.schedule(task(2))

            # 等待任务完成
            await asyncio.sleep(0.2)

            self.assertEqual(id1, 0)
            self.assertEqual(id2, 1)
            self.assertEqual(len(executed), 2)
            self.assertIn(1, executed)
            self.assertIn(2, executed)

        asyncio.run(run_test())

    def test_max_concurrent_limit(self):
        """测试最大并发数限制"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=2)

            # 用于跟踪同时运行的任务数
            running_count = 0
            max_running = 0
            running_lock = asyncio.Lock()

            async def task(id: int):
                nonlocal running_count, max_running
                async with running_lock:
                    running_count += 1
                    max_running = max(max_running, running_count)
                await asyncio.sleep(0.2)  # 较长的睡眠时间确保并发检测
                async with running_lock:
                    running_count -= 1

            # 调度5个任务，但只能同时运行2个
            for i in range(5):
                holder.schedule(task(i))

            # 等待所有任务完成
            await asyncio.sleep(1.0)

            # 验证同时运行的任务数不超过max_concurrent
            self.assertLessEqual(max_running, holder.max_concurrent)
            self.assertEqual(max_running, 2)

        asyncio.run(run_test())

    def test_task_completion_triggers_new_task(self):
        """测试任务完成后能触发新任务调度"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=2)

            completed = []

            async def task(id: int, delay: float):
                await asyncio.sleep(delay)
                completed.append(id)

            # 调度3个任务，前2个快速完成，第3个应该自动开始
            holder.schedule(task(1, 0.05))  # 快速完成
            holder.schedule(task(2, 0.05))  # 快速完成
            holder.schedule(task(3, 0.05))  # 应该在前两个完成后自动开始

            await asyncio.sleep(0.3)

            # 所有3个任务都应该完成
            self.assertEqual(len(completed), 3)
            self.assertEqual(set(completed), {1, 2, 3})

        asyncio.run(run_test())

    def test_task_order(self):
        """测试任务按ID顺序执行"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=2)

            execution_order = []
            execution_lock = asyncio.Lock()

            async def task(id: int):
                async with execution_lock:
                    execution_order.append(id)
                await asyncio.sleep(0.1)

            # 调度多个任务
            ids = []
            for i in range(5):
                task_id = holder.schedule(task(i))
                ids.append(task_id)

            await asyncio.sleep(0.5)

            # 前两个任务应该按ID顺序执行（0和1）
            self.assertEqual(execution_order[0], 0)
            self.assertEqual(execution_order[1], 1)
            # 后面的任务也应该是按顺序的（2, 3, 4）
            self.assertEqual(execution_order[2], 2)

        asyncio.run(run_test())

    def test_task_cleanup(self):
        """测试任务完成后的清理"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=2)

            async def task(id: int):
                await asyncio.sleep(0.1)

            # 调度任务
            id1 = holder.schedule(task(1))
            id2 = holder.schedule(task(2))

            # 等待任务完成
            await asyncio.sleep(0.2)

            # 验证任务已从字典中移除
            self.assertNotIn(id1, holder.events)
            self.assertNotIn(id2, holder.events)
            self.assertNotIn(id1, holder.tasks)
            self.assertNotIn(id2, holder.tasks)
            self.assertNotIn(id1, holder.running_tasks)
            self.assertNotIn(id2, holder.running_tasks)

        asyncio.run(run_test())

    def test_multiple_waves(self):
        """测试多波任务调度"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=3)

            completed = []

            async def task(id: int):
                await asyncio.sleep(0.05)
                completed.append(id)

            # 第一波：调度3个任务
            for i in range(3):
                holder.schedule(task(i))

            await asyncio.sleep(0.1)
            self.assertEqual(len(completed), 3)

            # 第二波：再调度3个任务
            for i in range(3, 6):
                holder.schedule(task(i))

            await asyncio.sleep(0.1)
            self.assertEqual(len(completed), 6)
            self.assertEqual(set(completed), {0, 1, 2, 3, 4, 5})

        asyncio.run(run_test())

    def test_id_counter_increment(self):
        """测试ID计数器递增"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=5)

            async def task(id: int):
                await asyncio.sleep(0.01)

            ids = []
            for i in range(5):
                task_id = holder.schedule(task(i))
                ids.append(task_id)

            # 验证ID是连续的
            self.assertEqual(ids, [0, 1, 2, 3, 4])
            self.assertEqual(holder.id_counter, 5)

        asyncio.run(run_test())

    def test_concurrent_stress(self):
        """压力测试：大量任务并发控制"""

        async def run_test():
            holder = ParallelHolder(max_concurrent=4)

            running_count = 0
            max_running = 0
            lock = asyncio.Lock()
            completed_count = 0

            async def task(id: int):
                nonlocal running_count, max_running, completed_count
                async with lock:
                    running_count += 1
                    max_running = max(max_running, running_count)

                await asyncio.sleep(0.05)

                async with lock:
                    running_count -= 1
                    completed_count += 1

            # 调度20个任务
            for i in range(20):
                holder.schedule(task(i))

            # 等待所有任务完成
            await asyncio.sleep(1.0)

            # 验证并发控制
            self.assertLessEqual(max_running, holder.max_concurrent)
            self.assertEqual(max_running, 4)
            self.assertEqual(completed_count, 20)

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main(verbosity=2)

