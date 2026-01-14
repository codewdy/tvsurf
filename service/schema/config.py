from .dtype import BaseModel, TimeDelta, ByteSize
from enum import Enum


class DownloadConfig(BaseModel):
    connect_timeout: TimeDelta = "1m"  # type: ignore
    chunk_size: ByteSize = "1MB"  # type: ignore
    max_concurrent_fragments: int = 5
    max_concurrent_downloads: int = 3
    max_retries: int = 3
    download_timeout: TimeDelta = "1h"  # type: ignore
    retry_interval: TimeDelta = "1m"  # type: ignore


class DBConfig(BaseModel):
    save_interval: TimeDelta = "1m"  # type: ignore


class UpdaterConfig(BaseModel):
    update_interval: TimeDelta = "1d"  # type: ignore
    tracking_timeout: TimeDelta = "14d"  # type: ignore
    update_parallel: int = 10


class Config(BaseModel):
    updater: UpdaterConfig = UpdaterConfig()
    download: DownloadConfig = DownloadConfig()
    db: DBConfig = DBConfig()
