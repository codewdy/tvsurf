from .raw import RawResourceSearcher
from .browser import BrowserResourceSearcher
from .maccms_player import MaccmsPlayerResourceSearcher
from .artplayer import ArtplayerResourceSearcher
from .iyplayer_temline import IyplayerTemlineResourceSearcher
from .base import BaseResourceSearcher

types = {
    "raw": RawResourceSearcher,
    "browser": BrowserResourceSearcher,
    "maccms_player": MaccmsPlayerResourceSearcher,
    "artplayer": ArtplayerResourceSearcher,
    "iyplayer_temline": IyplayerTemlineResourceSearcher,
}


def _create(type, **config) -> BaseResourceSearcher:
    return types[type](**config)


def create_resource_searcher(config: dict) -> BaseResourceSearcher:
    return _create(**config)
