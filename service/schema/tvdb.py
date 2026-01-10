from .dtype import BaseModel
from datetime import datetime
from enum import Enum


class SourceUrl(BaseModel):
    source_key: str
    source_name: str
    channel_name: str
    url: str


class DownloadStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class Source(BaseModel):
    class Episode(BaseModel):
        source: SourceUrl
        name: str

    source: SourceUrl
    name: str
    cover_url: str
    episodes: list["Source.Episode"]


class Storage(BaseModel):
    class Episode(BaseModel):
        name: str
        filename: str
        status: DownloadStatus

    directory: str
    episodes: list["Storage.Episode"]
    cover: str


class TrackStatus(BaseModel):
    tracking: bool
    latest_update: datetime


class TV(BaseModel):
    id: int
    name: str
    source: Source
    storage: Storage
    track: TrackStatus
    albums: list[int]


class Album(BaseModel):
    id: int
    name: str
    tvs: list[int]


class TVDB(BaseModel):
    albums: dict[int, Album] = {}
    tvs: dict[int, TV] = {}
    new_album_id: int = 1
    new_tv_id: int = 1
    last_update: datetime = datetime.min
