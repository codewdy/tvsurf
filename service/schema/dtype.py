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


class BaseModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(validate_default=True)

    # _commit 方法会在运行时由 DBUnit 动态添加
    _commit: Optional[Callable[[], None]] = None

    def commit(self):
        if self._commit:
            self._commit()
