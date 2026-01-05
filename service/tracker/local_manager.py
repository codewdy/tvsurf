from service.lib.context import Context
from service.schema.tvdb import TVDB, Source, TV, Storage, TrackStatus, DownloadStatus
from datetime import datetime
from service.schema.downloader import DownloadProgressWithName
from service.downloader.task import TaskDownloadManager
from typing import Callable, Awaitable
from .path import create_tv_path, remove_tv_path, get_tv_path, get_episode_path
from service.searcher.searchers import Searchers


class TVDownloadManager:
    def __init__(self, tvdb: TVDB):
        self.tvdb = tvdb

    async def start(self):
        self.task_manager = TaskDownloadManager()
        await self.task_manager.start()
        self.searchers = Searchers()

    async def stop(self):
        await self.task_manager.stop()

    def submit(self, tv_id: int, episode_id: int):
        tv = self.tvdb.tvs[tv_id]
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

    def submit_episodes(self, tv_id: int, ep_start: int):
        tv = self.tvdb.tvs[tv_id]
        for i in range(ep_start, len(tv.source.episodes)):
            self.submit(tv_id, i)

    async def cancel(self, tv_id: int):
        raise NotImplementedError("Not implemented")

    def get_download_progress(self) -> list[DownloadProgressWithName]:
        return self.task_manager.get_progress()

    def on_download_finished(self, tv_id: int, episode_id: int):
        tv = self.tvdb.tvs[tv_id]
        tv.storage.episodes[episode_id].status = DownloadStatus.SUCCESS
        self.tvdb.commit()

    def on_download_error(self, tv_id: int, episode_id: int, error: Exception):
        tv = self.tvdb.tvs[tv_id]
        tv.storage.episodes[episode_id].status = DownloadStatus.FAILED
        self.tvdb.commit()


class Updater:
    def __init__(self, tvdb: TVDB, on_update: Callable[[int], Awaitable[None]]):
        self.tvdb = tvdb
        self.on_update = on_update

    async def start(self):
        pass

    async def stop(self):
        pass


class LocalManager:
    async def start(self):
        self.tvdb: TVDB = Context.data("db").manage("tvdb", TVDB)
        self.download_manager = TVDownloadManager(self.tvdb)
        self.updater = Updater(self.tvdb, lambda id: self.on_update(id))
        await self.download_manager.start()
        await self.updater.start()

    async def stop(self):
        await self.download_manager.stop()

    async def on_update(self, id: int):
        pass

    async def add_tv(self, name: str, source: Source):
        for i in self.tvdb.tvs.values():
            if i.name == name:
                raise KeyError(f"TV {name} 已存在")
        id = self.tvdb.new_tv_id
        self.tvdb.new_tv_id += 1
        tv = TV(
            name=name,
            source=source,
            storage=Storage(directory=name, episodes=[], cover=""),
            track=TrackStatus(tracking=False, latest_update=datetime.now()),
            albums=[],
        )
        self.tvdb.tvs[id] = tv
        self.allocate_local(tv)
        await create_tv_path(tv)
        self.download_manager.submit_episodes(id, 0)
        self.tvdb.commit()
        return id

    def allocate_local(self, tv: TV):
        ext = ".mp4"
        filenames = set(ep.filename for ep in tv.storage.episodes)
        for i in range(len(tv.storage.episodes), len(tv.source.episodes)):
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

    def get_download_progress(self) -> list[DownloadProgressWithName]:
        return self.download_manager.get_download_progress()
