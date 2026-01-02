from service.schema.searcher import Subject
from urllib.parse import quote
from service.lib.request import request
from abc import abstractmethod
from bs4 import BeautifulSoup
from .base import BaseSubjectSearcher

class WebSubjectSearcher(BaseSubjectSearcher):
    def __init__(self, search_url, **kwargs):
        self.search_url = search_url

    def request_url(self, query):
        return self.search_url.format(keyword=quote(query))

    @abstractmethod
    def parse(self, request_url: str, soup: BeautifulSoup) -> Subject:
        pass

    async def search(self, query):
        request_url = self.request_url(query)
        soup = await request(request_url)
        return self.parse(request_url, soup)
