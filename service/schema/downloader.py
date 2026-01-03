from .dtype import BaseModel


class DownloadProgress(BaseModel):
    status: str
    total_size: float
    downloaded_size: float
    speed: float
