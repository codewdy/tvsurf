from service.schema.searcher import Subject
from urllib.parse import quote
from service.lib.request import request
from abc import abstractmethod
from bs4 import BeautifulSoup
from .base import BaseSubjectSearcher


class WebSubjectSearcher(BaseSubjectSearcher):
    def __init__(self, search_url):
        self.search_url = search_url

    def request_url(self, query):
        return self.search_url.format(keyword=quote(query))

    @abstractmethod
    def parse(self, request_url: str, soup: BeautifulSoup) -> list[Subject]:
        pass

    @abstractmethod
    def get_next_pages(self, request_url: str, soup: BeautifulSoup) -> list[str]:
        pass

    async def search(self, query):
        running_requests = [self.request_url(query)]
        all_requests = set(running_requests)
        subjects = []
        while len(running_requests) > 0:
            request_url = running_requests.pop(0)
            soup = await request(request_url)
            subjects.extend(self.parse(request_url, soup))
            next_pages = self.get_next_pages(request_url, soup)
            for next_page in next_pages:
                if next_page not in all_requests:
                    running_requests.append(next_page)
                    all_requests.add(next_page)
        return subjects
