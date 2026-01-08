from .dtype import BaseModel
from .tvdb import Source
from .downloader import DownloadProgressWithName
from .error import Error

__all__ = [
    "Echo",
    "SearchTV",
    "AddTV",
    "GetDownloadProgress",
    "GetErrors",
    "RemoveErrors",
    "SystemSetup",
    "Login",
    "Whoami",
]


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


class AddTV(BaseModel):
    class Request(BaseModel):
        name: str
        source: Source

    class Response(BaseModel):
        id: int


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
