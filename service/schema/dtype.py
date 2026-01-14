import pydantic
from typing import Callable, Optional
from datetime import timedelta
from pandas import Timedelta
from pydantic.functional_validators import AfterValidator, BeforeValidator
from typing_extensions import Annotated


def to_timedelta(x):
    return Timedelta(x).to_pytimedelta()  # type: ignore[attr-defined]


TimeDelta = Annotated[
    timedelta,
    BeforeValidator(to_timedelta),
]


def parse_bytesize(x: str) -> int:
    if isinstance(x, int):
        return x
    x = x.strip().upper()
    if x.endswith("Byte"):
        return int(x[:-4])
    if x.endswith("KB"):
        return int(x[:-2]) * 1024
    if x.endswith("MB"):
        return int(x[:-2]) * 1024 * 1024
    if x.endswith("GB"):
        return int(x[:-2]) * 1024 * 1024 * 1024
    if x.endswith("TB"):
        return int(x[:-2]) * 1024 * 1024 * 1024 * 1024
    if x.endswith("PB"):
        return int(x[:-2]) * 1024 * 1024 * 1024 * 1024 * 1024
    if x.endswith("EB"):
        return int(x[:-2]) * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
    return int(x)


ByteSize = Annotated[int, BeforeValidator(parse_bytesize)]


class BaseModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(validate_default=True)

    # _commit 方法会在运行时由 DBUnit 动态添加
    _commit: Optional[Callable[[], None]] = None

    def commit(self):
        if self._commit:
            self._commit()

    def merge_from(self, other: "BaseModel"):
        for field in type(self).model_fields:
            setattr(self, field, getattr(other, field))
