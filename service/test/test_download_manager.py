import sys
from service.lib.context import Context
from service.downloader.task import TaskDownloaderManager, DownloadTask
from service.downloader.progress import human_readable_progress
import asyncio
import aiofiles
import os
from datetime import timedelta

url = "https://love.girigirilove.net/zijian/anime/2024/12/1224/OoyasanwaShishunki/01/playlist.m3u8"


async def download_task_v1():
    return url


c = 0


async def download_task_v2():
    global c
    c += 1
    if c == 1:
        raise Exception("test")
    if c == 2:
        return url + "123"
    return url


async def run():
    async with Context():
        Context.config.download.retry_interval = timedelta(seconds=20)
        async with aiofiles.tempfile.TemporaryDirectory(
            prefix="test_download_manager_"
        ) as temp_dir:
            manager = TaskDownloaderManager()
            await manager.start()
            manager.add_task(
                url=url,
                dst=os.path.join(temp_dir, "1.mp4"),
                name="1.mp4",
                metadata={},
                on_finished=None,
                on_error=None,
            )
            manager.add_task(
                url=download_task_v1,
                dst=os.path.join(temp_dir, "2.mp4"),
                name="2.mp4",
                metadata={},
                on_finished=None,
                on_error=None,
            )
            manager.add_task(
                url=download_task_v2,
                dst=os.path.join(temp_dir, "3.mp4"),
                name="3.mp4",
                metadata={},
                on_finished=None,
                on_error=None,
            )
            manager.add_task(
                url=url,
                dst=os.path.join(temp_dir, "4.mp4"),
                name="4.mp4",
                metadata={},
                on_finished=None,
                on_error=None,
            )

            while True:
                await asyncio.sleep(1)
                all_progress = manager.get_progress()
                print([human_readable_progress(progress) for progress in all_progress])
                if len(all_progress) == 0:
                    break


asyncio.run(run())
