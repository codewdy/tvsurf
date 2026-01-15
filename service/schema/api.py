from .dtype import BaseModel
from .tvdb import Source, Series, TV, SourceUrl
from .downloader import DownloadProgressWithName
from .error import Error
from .searcher import SearchError
from typing import Optional
from .user_data import UserTVData, Tag
from datetime import datetime
from .config import Config

__all__ = [
    "UserInfo",
    "TVInfo",
    "Echo",
    "SearchTV",
    "AddTV",
    "RemoveTV",
    "UpdateTVSource",
    "UpdateEpisodeSeries",
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
    "SetTVTracking",
    "ScheduleEpisodeDownload",
    "GetMonitor",
    "GetConfig",
    "SetConfig",
    "SetMyPassword",
    "AddUser",
    "RemoveUser",
    "UpdateUserGroup",
    "SetUserPassword",
    "GetUsers",
]


class UserInfo(BaseModel):
    username: str
    group: list[str]


class TVInfo(BaseModel):
    id: int
    name: str
    cover_url: str
    series: list[int]
    last_update: datetime
    total_episodes: int
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


class RemoveTV(BaseModel):
    class Request(BaseModel):
        id: int

    class Response(BaseModel):
        pass


class UpdateTVSource(BaseModel):
    class Request(BaseModel):
        id: int
        source: Source

    class Response(BaseModel):
        pass


class UpdateEpisodeSeries(BaseModel):
    class Request(BaseModel):
        tv_id: int
        episode_id: int
        source: SourceUrl

    class Response(BaseModel):
        pass


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
        password_hash: str
        single_user_mode: bool

    class Response(BaseModel):
        token: str


class Login(BaseModel):
    class Request(BaseModel):
        username: str
        password_hash: str

    class Response(BaseModel):
        token: str


class Whoami(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        user: UserInfo
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


class SetTVTracking(BaseModel):
    class Request(BaseModel):
        tv_id: int
        tracking: bool

    class Response(BaseModel):
        pass


class ScheduleEpisodeDownload(BaseModel):
    class Request(BaseModel):
        tv_id: int
        episode_ids: list[int]

    class Response(BaseModel):
        pass


class GetMonitor(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        download_count: int
        error_count: int


class GetConfig(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        config: Config


class SetConfig(BaseModel):
    class Request(BaseModel):
        config: Config

    class Response(BaseModel):
        pass


class SetMyPassword(BaseModel):
    class Request(BaseModel):
        password_hash: str

    class Response(BaseModel):
        pass


class AddUser(BaseModel):
    class Request(BaseModel):
        username: str
        password_hash: str
        group: list[str]

    class Response(BaseModel):
        pass


class RemoveUser(BaseModel):
    class Request(BaseModel):
        username: str

    class Response(BaseModel):
        pass


class UpdateUserGroup(BaseModel):
    class Request(BaseModel):
        username: str
        group: list[str]

    class Response(BaseModel):
        pass


class SetUserPassword(BaseModel):
    class Request(BaseModel):
        username: str
        password_hash: str

    class Response(BaseModel):
        pass


class GetUsers(BaseModel):
    class Request(BaseModel):
        pass

    class Response(BaseModel):
        users: list[UserInfo]
        single_user_mode: bool
