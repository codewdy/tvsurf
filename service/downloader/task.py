from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional, Union
from service.lib.parallel_holder import ParallelHolder
from service.lib.context import Context
import asyncio
from .m3u8 import M3U8Downloader
from service.schema.downloader import DownloadProgress, DownloadProgressWithName


@dataclass
class DownloadTask:
    url: Union[Callable[[], Awaitable[str]], str]
    dst: str
    name: str
    metadata: Any
    on_finished: Optional[Callable[[], None]]
    on_error: Optional[Callable[[Exception], None]]
    task: Optional[asyncio.Task] = None
    downloader: Optional["TaskDownloader"] = None


class TaskDownloader:
    def __init__(self, task: DownloadTask) -> None:
        self.task = task
        self.status = "排队中"
        self.downloader: Optional[M3U8Downloader] = None

    def get_progress(self) -> DownloadProgress:
        if self.downloader is None:
            return DownloadProgress(
                status=self.status,
                downloading=False,
                total_size=0,
                downloaded_size=0,
                speed=0,
            )
        return self.downloader.get_progress()

    async def run(self) -> None:
        try:
            with Context.handle_error(
                f"下载任务 {self.task.name} 错误", type="critical", rethrow=True
            ):
                await self.run_internal()
                if self.task.on_finished:
                    with Context.handle_error(f"on_finished {self.task.name} 错误"):
                        self.task.on_finished()
        except Exception as e:
            if self.task.on_error:
                with Context.handle_error(f"on_error {self.task.name} 错误"):
                    self.task.on_error(e)

    async def run_internal(self) -> None:
        for i in range(Context.config.download.max_retries, 0, -1):
            try:
                await asyncio.wait_for(
                    self.run_once(),
                    timeout=Context.config.download.download_timeout.total_seconds(),
                )
                break
            except Exception as e:
                if i == 1:
                    raise
                else:
                    self.status = f"等待重试, 剩余重试次数: {i - 1}"
                    await asyncio.sleep(
                        Context.config.download.retry_interval.total_seconds()
                    )

    async def run_once(self) -> None:
        try:
            self.status = "获取视频地址"
            url = await self.task.url() if callable(self.task.url) else self.task.url
            self.downloader = M3U8Downloader(url, self.task.dst)
            await self.downloader.run()
            self.status = "下载完成"
        finally:
            self.downloader = None


class TaskDownloadManager:
    async def start(self) -> None:
        self.tasks: list[DownloadTask] = []
        self.runner = ParallelHolder(
            max_concurrent=Context.config.download.max_concurrent_downloads
        )
        await self.runner.__aenter__()

    async def stop(self) -> None:
        await self.runner.__aexit__(None, None, None)

    def add_task(
        self,
        url: Union[Callable[[], Awaitable[str]], str],
        dst: str,
        name: str,
        metadata: Any,
        on_finished: Optional[Callable[[], None]],
        on_error: Optional[Callable[[Exception], None]],
    ) -> None:
        task = DownloadTask(
            url=url,
            dst=dst,
            name=name,
            metadata=metadata,
            on_finished=on_finished,
            on_error=on_error,
        )
        self.tasks.append(task)
        downloader = TaskDownloader(task)
        task.downloader = downloader
        task.task = self.runner.schedule(downloader.run)
        task.task.add_done_callback(lambda _: self.tasks.remove(task))

    def remove_filtered_task(self, filter: Callable[[Any], bool]) -> None:
        remove_tasks = [task for task in self.tasks if filter(task.metadata)]
        for task in remove_tasks:
            if task.task:
                task.task.cancel()

    def get_progress(self) -> list[DownloadProgressWithName]:
        return [
            DownloadProgressWithName(
                name=task.name, progress=task.downloader.get_progress()  # type: ignore
            )
            for task in self.tasks
        ]
