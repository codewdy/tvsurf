from .web_a import WebAChannelSearcher
from .base import BaseChannelSearcher

types = {
    "web_a": WebAChannelSearcher,
}


def create_channel_searcher(config: dict) -> BaseChannelSearcher:
    return types[config["type"]](**config)
