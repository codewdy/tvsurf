from .dtype import BaseModel
from datetime import datetime
from enum import Enum


class ErrorType(str, Enum):
    ERROR = "error"
    CRITICAL = "critical"


class Error(BaseModel):
    id: int
    timestamp: datetime
    title: str
    description: str
    type: ErrorType


class IgnoredError(BaseModel):
    count: dict[str, int] = {}


class ErrorDB(BaseModel):
    errors: list[Error] = []
    next_error_id: int = 1
    ignored_errors: IgnoredError = IgnoredError()
