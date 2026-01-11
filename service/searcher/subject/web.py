from service.schema.searcher import Subject
from urllib.parse import quote
from service.lib.request import request
from abc import abstractmethod
from bs4 import BeautifulSoup
from .base import BaseSubjectSearcher
from urllib.parse import urljoin
from service.lib.request import to_text
import re


class WebSubjectSearcher(BaseSubjectSearcher):
    def __init__(
        self,
        search_url,
        other_page: str = "",
        other_page_filter: str = "",
        max_pages: int = 3,
    ):
        self.search_url = search_url
        self.other_page = other_page
        if other_page_filter != "":
            self.other_page_filter = re.compile(other_page_filter)
        else:
            self.other_page_filter = None
        self.max_pages = max_pages

    def request_url(self, query):
        return self.search_url.format(keyword=quote(query))

    @abstractmethod
    def parse(self, request_url: str, soup: BeautifulSoup) -> list[Subject]:
        pass

    def get_other_pages(self, request_url: str, soup: BeautifulSoup) -> list[str]:
        if self.other_page == "":
            return []
        other_page = soup.select(self.other_page)
        if self.other_page_filter is not None:
            other_page = [
                page
                for page in other_page
                if not self.other_page_filter.search(to_text(page))
            ]
        result = [
            urljoin(request_url, page["href"])  # type: ignore
            for page in other_page
            if page.has_attr("href")
        ]
        result = result[: self.max_pages - 1]
        return result

    async def search(self, query):
        request_url = self.request_url(query)
        soups = [await request(request_url)]
        other_pages = self.get_other_pages(request_url, soups[0])
        for other_page in other_pages:
            soups.append(await request(other_page))
        subjects = [self.parse(request_url, soup) for soup in soups]
        return sum(subjects, [])
