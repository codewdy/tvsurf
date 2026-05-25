from contextlib import contextmanager
import traceback
from collections import defaultdict
from typing import Callable, Iterator


class ErrorHandler:
    def __init__(self) -> None:
        self.handlers: defaultdict[str, list[Callable[[str, str], None]]] = defaultdict(
            list
        )
        self.ignore_error_counter = lambda key: 100000
        self.clear_ignore_error_counter = lambda key: None

    def add_handler(self, type: str, handler: Callable[[str, str], None]) -> None:
        self.handlers[type].append(handler)

    def set_ignore_error_handler(
        self,
        ignore_error_counter: Callable[[str], int],
        clear_ignore_error_counter: Callable[[str], None],
    ) -> None:
        self.ignore_error_counter = ignore_error_counter
        self.clear_ignore_error_counter = clear_ignore_error_counter

    def handle_error(self, type: str, title: str, error: str) -> None:
        for handler in self.handlers[type]:
            handler(title, error)

    @contextmanager
    def handle_error_context(
        self,
        title: str,
        type: str = "error",
        rethrow: bool = False,
        key: str | None = None,
        max_ignore_count: int = 0,
    ) -> Iterator[None]:
        try:
            yield
            if key is not None:
                self.clear_ignore_error_counter(key)
        except Exception as e:
            if key is not None:
                if self.ignore_error_counter(key) <= max_ignore_count:
                    return
            self.handle_error(type, title, traceback.format_exc())
            if rethrow:
                raise e
