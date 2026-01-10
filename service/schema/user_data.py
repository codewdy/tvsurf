from .dtype import BaseModel
from enum import Enum
from datetime import datetime


class Tag(str, Enum):
    WATCHING = "watching"
    WANTED = "wanted"
    WATCHED = "watched"
    ON_HOLD = "on_hold"
    NOT_TAGGED = "not_tagged"


class WatchProgress(BaseModel):
    episode_id: int
    time: float


class UserTVData(BaseModel):
    tv_id: int
    tag: Tag
    watch_progress: WatchProgress
    last_update: datetime


class UserData(BaseModel):
    tvs: dict[int, UserTVData] = {}
