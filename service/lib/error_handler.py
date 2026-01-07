from contextlib import contextmanager
import traceback
from collections import defaultdict
from typing import Callable


class ErrorHandler:
    def __init__(self):
        self.handlers = defaultdict(list)

    def add_handler(self, type, handler: Callable[[str, str], None]):
        self.handlers[type].append(handler)

    def handle_error(self, type: str, title: str, error: str):
        for handler in self.handlers[type]:
            handler(title, error)

    @contextmanager
    def handle_error_context(self, title: str, type: str = "error", rethrow=False):
        try:
            yield
        except Exception as e:
            self.handle_error(type, title, traceback.format_exc())
            if rethrow:
                raise e
