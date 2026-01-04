from .raw import RawResourceSearcher
from .browser import BrowserResourceSearcher
from .base import BaseResourceSearcher

types = {
    "raw": RawResourceSearcher,
    "browser": BrowserResourceSearcher,
}


def create_resource_searcher(config: dict) -> BaseResourceSearcher:
    return types[config["type"]](**config)
