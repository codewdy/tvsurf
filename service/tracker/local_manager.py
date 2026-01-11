from service.lib.context import Context
from service.schema.tvdb import TVDB, Source, TV, Storage, TrackStatus, DownloadStatus
from datetime import datetime
from service.schema.downloader import DownloadProgressWithName
from service.downloader.task import TaskDownloadManager
from typing import Callable, Awaitable
from .path import create_tv_path, remove_tv_path, get_tv_path, get_episode_path
from service.searcher.searchers import Searchers
from service.lib.parallel_holder import ParallelHolder
import asyncio
import os
import aiofiles


class TVDownloadManager:
    def __init__(self, tvdb: TVDB) -> None:
        self.tvdb = tvdb

    async def start(self) -> None:
        self.task_manager = TaskDownloadManager()
        await self.task_manager.start()
        self.searchers = Searchers()

    async def stop(self) -> None:
        await self.task_manager.stop()

    def submit(self, tv_id: int, episode_id: int) -> None:
        tv = self.tvdb.tvs[tv_id]
        if tv.storage.episodes[episode_id].status != DownloadStatus.RUNNING:
            return
        episode = tv.source.episodes[episode_id]
        filename = get_episode_path(tv, episode_id)
        self.task_manager.add_task(
            lambda: self.searchers.get_resource(episode.source),
            filename,
            f"{tv.name} - {episode.name}",
            {"tv_id": tv_id, "episode_id": episode_id},
            lambda: self.on_download_finished(tv_id, episode_id),
            lambda error: self.on_download_error(tv_id, episode_id, error),
        )

    def submit_episodes(self, tv_id: int, ep_start: int) -> None:
        tv = self.tvdb.tvs[tv_id]
        for i in range(ep_start, len(tv.source.episodes)):
            self.submit(tv_id, i)

    async def cancel(self, tv_id: int) -> None:
        raise NotImplementedError("Not implemented")

    def get_download_progress(self) -> list[DownloadProgressWithName]:
        return self.task_manager.get_progress()

    def on_download_finished(self, tv_id: int, episode_id: int) -> None:
        tv = self.tvdb.tvs[tv_id]
        tv.storage.episodes[episode_id].status = DownloadStatus.SUCCESS
        self.tvdb.commit()

    def on_download_error(self, tv_id: int, episode_id: int, error: Exception) -> None:
        tv = self.tvdb.tvs[tv_id]
        tv.storage.episodes[episode_id].status = DownloadStatus.FAILED
        self.tvdb.commit()


class Updater:
    def __init__(
        self,
        tvdb: TVDB,
        on_update: Callable[[int, Source], Awaitable[None]],
        on_no_update: Callable[[int], Awaitable[None]],
    ) -> None:
        self.tvdb = tvdb
        self.on_update = on_update
        self.on_no_update = on_no_update

    async def start(self) -> None:
        self.searchers = Searchers()
        self.update_task = asyncio.create_task(self.update_loop())

    async def stop(self) -> None:
        self.update_task.cancel()
        await asyncio.gather(self.update_task, return_exceptions=True)

    async def update_tv(self, tv_id: int) -> None:
        tv = self.tvdb.tvs[tv_id]
        new_source = await self.searchers.update_source(tv.source)
        if new_source is not None:
            await self.on_update(tv_id, new_source)
        else:
            await self.on_no_update(tv_id)

    async def update_all(self) -> None:
        with Context.handle_error(title="update_all", type="critical"):
            async with ParallelHolder(Context.config.updater.update_parallel) as holder:
                for i, tv in self.tvdb.tvs.items():
                    if tv.track.tracking:
                        holder.schedule(lambda tv_id=i: self.update_tv(tv_id))
                await holder.wait_all()
        self.tvdb.last_update = datetime.now()
        self.tvdb.commit()

    def should_update(self) -> bool:
        return (
            datetime.now() - self.tvdb.last_update
            > Context.config.updater.update_interval
        )

    async def update_loop(self) -> None:
        with Context.handle_error(title="update_loop", type="critical"):
            while True:
                if self.should_update():
                    await self.update_all()
                await asyncio.sleep(
                    max(
                        (
                            Context.config.updater.update_interval
                            - (datetime.now() - self.tvdb.last_update)
                        ).total_seconds(),
                        0,
                    )
                )


class LocalManager:
    async def start(self) -> None:
        self.tvdb: TVDB = Context.data("db").manage("tvdb", TVDB)
        self.download_manager = TVDownloadManager(self.tvdb)
        self.updater = Updater(self.tvdb, self.on_update, self.on_no_update)
        await self.download_manager.start()
        await self.resume_download_on_start()
        await self.updater.start()

    async def stop(self) -> None:
        await self.updater.stop()
        await self.download_manager.stop()

    async def resume_download_on_start(self) -> None:
        for i, tv in self.tvdb.tvs.items():
            self.download_manager.submit_episodes(i, 0)

    async def on_update(self, id: int, source: Source) -> None:
        tv = self.tvdb.tvs[id]
        tv.track.last_update = datetime.now()
        tv.source = source
        self.allocate_local(tv)
        self.tvdb.commit()

    async def on_no_update(self, id: int) -> None:
        tv = self.tvdb.tvs[id]
        if (
            tv.track.last_update
            < datetime.now() - Context.config.updater.tracking_timeout
        ):
            tv.track.tracking = False
            self.tvdb.commit()

    async def download_cover(self, tv: TV) -> None:
        async with Context.client.get(tv.source.cover_url) as resp:
            resp.raise_for_status()
            cover = await resp.read()
            filename = f"cover{os.path.splitext(tv.source.cover_url)[1]}"
            async with aiofiles.open(f"{get_tv_path(tv)}/{filename}", mode="wb") as f:
                await f.write(cover)
            tv.storage.cover = filename

    async def add_tv(self, name: str, source: Source, tracking: bool) -> int:
        for i in self.tvdb.tvs.values():
            if i.name == name:
                raise KeyError(f"TV {name} 已存在")
        id = self.tvdb.new_tv_id
        self.tvdb.new_tv_id += 1
        tv = TV(
            id=id,
            name=name,
            source=source,
            storage=Storage(directory=name, episodes=[], cover=""),
            track=TrackStatus(tracking=tracking, last_update=datetime.now()),
            series=[],
        )
        await create_tv_path(tv)
        await self.download_cover(tv)
        self.tvdb.tvs[id] = tv
        self.allocate_local(tv)
        self.tvdb.commit()
        return id

    def get_tv(self, id: int) -> TV:
        return self.tvdb.tvs[id]

    def get_tvs(self) -> list[TV]:
        return list(self.tvdb.tvs.values())

    def allocate_local(self, tv: TV) -> None:
        ext = ".mp4"
        start_index = len(tv.storage.episodes)
        filenames = set(ep.filename for ep in tv.storage.episodes)
        for i in range(start_index, len(tv.source.episodes)):
            name = tv.source.episodes[i].name
            filename = f"{name}{ext}"
            idx = 0
            while filename in filenames:
                idx += 1
                filename = f"{name}-{idx}{ext}"
            filenames.add(filename)
            tv.storage.episodes.append(
                Storage.Episode(
                    name=name, filename=filename, status=DownloadStatus.RUNNING
                )
            )
        self.download_manager.submit_episodes(tv.id, start_index)

    def get_download_progress(self) -> list[DownloadProgressWithName]:
        return self.download_manager.get_download_progress()
