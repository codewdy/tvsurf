from service.schema.tvdb import TV
import aiofiles.os
from service.lib.context import Context
import os


async def create_tv_path(tv: TV):
    await aiofiles.os.makedirs(get_tv_path(tv), exist_ok=True)


async def remove_tv_path(tv: TV):
    await aiofiles.os.rmdir(get_tv_path(tv))


def get_tv_path(tv: TV) -> str:
    return os.path.join(Context.config.data_dir, "tv", tv.storage.directory)


def get_episode_path(tv: TV, episode: int) -> str:
    return os.path.join(get_tv_path(tv), tv.storage.episodes[episode].filename)
