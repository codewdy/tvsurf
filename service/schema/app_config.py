from .dtype import BaseModel
from enum import Enum


class ServerType(str, Enum):
    LOCAL = "local"
    ONLINE = "online"


class AppConfig(BaseModel):
    data_dir: str = "data"
    port: int = 9399
    server_type: ServerType = ServerType.LOCAL
