from .web_a import WebAChannelSearcher
from .base import BaseChannelSearcher

types = {
    "web_a": WebAChannelSearcher,
}


def _create(type, **config) -> BaseChannelSearcher:
    return types[type](**config)


def create_channel_searcher(config: dict) -> BaseChannelSearcher:
    return _create(**config)
