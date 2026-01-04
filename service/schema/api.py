from .dtype import BaseModel
from .tvdb import Source
from .downloader import DownloadProgressWithName


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
