from .dtype import BaseModel
from .tvdb import Source, Series, TV
from .downloader import DownloadProgressWithName
from .error import Error
from .searcher import SearchError
from typing import Optional

__all__ = [
    "TVInfo",
    "Echo",
    "SearchTV",
    "AddTV",
    "GetTVInfos",
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
]


class TVInfo(BaseModel):
    id: int
    name: str
    series: list[int]


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

    class Response(BaseModel):
        id: int


class GetTVInfos(BaseModel):
    class Request(BaseModel):
        ids: Optional[list[int]] = None

    class Response(BaseModel):
        tvs: list[TVInfo]


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
