from service.lib.request import request
from .base import BaseChannelSearcher
from abc import abstractmethod
from bs4 import BeautifulSoup
from service.schema.searcher import Channel


class WebChannelSearcher(BaseChannelSearcher):
    def __init__(self, **kwargs):
        pass
    
    @abstractmethod
    def parse(self, url: str, soup: BeautifulSoup) -> list[Channel]:
        pass

    async def search(self, url: str) -> list[Channel]:
        soup = await request(url)
        return self.parse(url, soup)
