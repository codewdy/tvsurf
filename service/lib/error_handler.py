from contextlib import contextmanager
import traceback
from collections import defaultdict
from typing import Callable, Iterator


class ErrorHandler:
    def __init__(self) -> None:
        self.handlers: defaultdict[str, list[Callable[[str, str], None]]] = defaultdict(
            list
        )

    def add_handler(self, type: str, handler: Callable[[str, str], None]) -> None:
        self.handlers[type].append(handler)

    def handle_error(self, type: str, title: str, error: str) -> None:
        for handler in self.handlers[type]:
            handler(title, error)

    @contextmanager
    def handle_error_context(
        self, title: str, type: str = "error", rethrow: bool = False
    ) -> Iterator[None]:
        try:
            yield
        except Exception as e:
            self.handle_error(type, title, traceback.format_exc())
            if rethrow:
                raise e
