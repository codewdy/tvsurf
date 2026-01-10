from .dtype import BaseModel
from .tvdb import Source, Series, TV
from .downloader import DownloadProgressWithName
from .error import Error
from .searcher import SearchError
from typing import Optional
from .user_data import UserTVData, Tag
from datetime import datetime

__all__ = [
    "TVInfo",
    "Echo",
    "SearchTV",
    "AddTV",
    "GetTVInfos",
    "GetTVDetails",
    "GetDownloadProgress",
    "GetErrors",
    "RemoveErrors",
    "SystemSetup",
    "Login",
    "Whoami",
    "AddSeries",
    "RemoveSeries",
    "UpdateSeriesTVs",
    "GetSeries",
    "SetWatchProgress",
    "SetTVTag",
]


class TVInfo(BaseModel):
    id: int
    name: str
    cover_url: str
    series: list[int]
    last_update: datetime
    user_data: UserTVData


class Echo:
    class Request(BaseModel):
        message: str

    class Response(BaseModel):
        message: str


class SearchTV(BaseModel):
    class Request(BaseModel):
        keyword: str

    class Response(BaseModel):
        source: list[Source]
        search_error: list[SearchError]


class AddTV(BaseModel):
    class Request(BaseModel):
        name: str
        source: Source
        tracking: bool
        series: list[int]

    class Response(BaseModel):
        id: int


class GetTVInfos(BaseModel):
    class Request(BaseModel):
        ids: Optional[list[int]] = None

    class Response(BaseModel):
        tvs: list[TVInfo]


class GetTVDetails(BaseModel):
    class Request(BaseModel):
        id: int

    class Response(BaseModel):
        tv: TV
        info: TVInfo
        episodes: list[Optional[str]]


class GetDownloadProgress(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        progress: list[DownloadProgressWithName]


class GetErrors(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        errors: list[Error]


class RemoveErrors(BaseModel):
    class Request(BaseModel):
        ids: list[int]

    class Response(BaseModel):
        pass


class SystemSetup(BaseModel):
    class Request(BaseModel):
        username: str
        password_md5: str
        single_user_mode: bool

    class Response(BaseModel):
        token: str


class Login(BaseModel):
    class Request(BaseModel):
        username: str
        password_md5: str

    class Response(BaseModel):
        token: str


class Whoami(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        username: str
        group: list[str]
        single_user_mode: bool


class AddSeries(BaseModel):
    class Request(BaseModel):
        name: str

    class Response(BaseModel):
        id: int


class RemoveSeries(BaseModel):
    class Request(BaseModel):
        id: int

    class Response(BaseModel):
        pass


class UpdateSeriesTVs(BaseModel):
    class Request(BaseModel):
        id: int
        tvs: list[int]

    class Response(BaseModel):
        pass


class GetSeries(BaseModel):
    class Request(BaseModel):
        ids: Optional[list[int]] = None

    class Response(BaseModel):
        series: list[Series]


class SetWatchProgress(BaseModel):
    class Request(BaseModel):
        tv_id: int
        episode_id: int
        time: float

    class Response(BaseModel):
        pass


class SetTVTag(BaseModel):
    class Request(BaseModel):
        tv_id: int
        tag: Tag

    class Response(BaseModel):
        pass
