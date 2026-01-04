from .download_tracker import DownloadTracker
from .simple import SimpleDownloader
from urllib.parse import urljoin
from service.lib.context import Context
import re
import asyncio
import aiofiles
import aiofiles.os
import os
from service.lib.run_cmd import run_cmd
from service.lib.path import ffmpeg_path
from service.schema.downloader import DownloadProgress
from service.lib.parallel_holder import ParallelHolder


class M3U8Downloader:
    def __init__(self, src, dst):
        self.src = src
        self.dst = dst
        self.download_tracker = DownloadTracker()

    def select_sub_list(self, lines):
        r = re.compile(r"RESOLUTION=([0-9]+)x([0-9]+)")
        x, y = 0, 0
        rst = (-1, "")
        for line in lines:
            if line.startswith("#"):
                m = r.search(line)
                if m:
                    x, y = int(m.group(1)), int(m.group(2))
                continue
            if x * y > rst[0]:
                rst = (x * y, line)
        if rst[0] == -1:
            raise ValueError("No valid sub list found")
        return rst[1]

    async def download_meta(self, file):
        await SimpleDownloader(self.src, file).run()
        with open(file, "r") as f:
            lines = f.readlines()
        lines = [line.strip() for line in lines]
        master_playlist = False
        for line in lines:
            if line.startswith("#"):
                continue
            if line.endswith(".m3u8"):
                master_playlist = True
                break
        if master_playlist:
            self.src = urljoin(self.src, self.select_sub_list(lines))
            return await self.download_meta(file)
        else:
            return [
                urljoin(self.src, line)
                for line in lines
                if (not line.startswith("#")) and line != ""
            ]

    async def ffmpeg(self, src_m3u8, fragments, dst):
        with open(src_m3u8, "r") as f:
            lines = f.readlines()
            current_fragment = 0
            newlines = []
            for line in lines:
                if line.startswith("#"):
                    newlines.append(line)
                else:
                    newlines.append(fragments[current_fragment] + "\n")
                    current_fragment += 1

        with open(src_m3u8, "w") as f:
            f.writelines(newlines)

        await run_cmd(
            ffmpeg_path(),
            "-y",
            "-allowed_extensions",
            "ALL",
            "-i",
            src_m3u8,
            "-acodec",
            "copy",
            "-vcodec",
            "copy",
            "-bsf:a",
            "aac_adtstoasc",
            dst,
        )

    async def run(self):
        async with aiofiles.tempfile.TemporaryDirectory(prefix="tvsurf-") as tmp:
            self.download_tracker.update("下载元信息", False)
            src_m3u8_file = os.path.join(tmp, "src.m3u8")
            urls = await self.download_meta(src_m3u8_file)
            self.download_tracker.update("下载中", True)
            self.download_tracker.set_fragment_count(len(urls))
            fragments = []
            runner = ParallelHolder(
                max_concurrent=Context.config.download.max_concurrent_fragments
            )
            async with runner:
                for i, url in enumerate(urls):
                    fn = os.path.join(tmp, f"fragment_{i}.ts")
                    fragments.append(fn)
                    runner.schedule(
                        SimpleDownloader(url, fn, self.download_tracker).run()
                    )
                await runner.wait_all()
            self.download_tracker.update("转码中", False)
            splitext = os.path.splitext(self.dst)
            tmpname = splitext[0] + ".tmp" + splitext[1]
            await self.ffmpeg(src_m3u8_file, fragments, tmpname)
            await aiofiles.os.rename(tmpname, self.dst)
            self.download_tracker.update("完成", False)

    def get_progress(self) -> DownloadProgress:
        return self.download_tracker.get_progress()


if __name__ == "__main__":
    import asyncio
    import aiohttp
    from .progress import human_readable_progress
    import sys

    async def test():
        async with Context() as ctx:
            downloader = M3U8Downloader(sys.argv[-2], sys.argv[-1])
            task = asyncio.create_task(downloader.run())
            while True:
                await asyncio.sleep(1)
                print(human_readable_progress(downloader.get_progress()))
                if task.done():
                    break
            print(human_readable_progress(downloader.get_progress()))

    asyncio.run(test())
