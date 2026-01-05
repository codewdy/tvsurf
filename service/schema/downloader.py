from .dtype import BaseModel


class DownloadProgress(BaseModel):
    status: str
    downloading: bool
    total_size: float
    downloaded_size: float
    speed: float


class DownloadProgressWithName(BaseModel):
    name: str
    progress: DownloadProgress


class AdBlockDB(BaseModel):
    ts_black_list: set[str] = set()
