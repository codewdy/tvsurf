from .raw import RawResourceSearcher
from .browser import BrowserResourceSearcher
from .base import BaseResourceSearcher

types = {
    "raw": RawResourceSearcher,
    "browser": BrowserResourceSearcher,
}


def _create(type, **config) -> BaseResourceSearcher:
    return types[type](**config)


def create_resource_searcher(config: dict) -> BaseResourceSearcher:
    return _create(**config)
