from .dtype import BaseModel, Enum
from datetime import datetime

class SourceUrl(BaseModel):
    source_key: str
    source_name: str
    channel_name: str
    url: str

class DownloadStatus(Enum):
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

class Session(BaseModel):
    series: int
    name: str
    source: Source
    storage: Storage
    track: TrackStatus

class Series(BaseModel):
    name: str
    sessions: list[int]

class TVDB(BaseModel):
    sessions: dict[int, Session]
    series: dict[int, Series]
    new_session_id: int = 1
    new_series_id: int = 1
