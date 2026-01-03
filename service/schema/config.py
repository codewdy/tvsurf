from .dtype import BaseModel


class DownloadConfig(BaseModel):
    timeout: int = 300
    chunk_size: int = 1024 * 1024
    max_concurrent_fragments: int = 5
    max_concurrent_downloads: int = 3


class Config(BaseModel):
    download: DownloadConfig = DownloadConfig()
