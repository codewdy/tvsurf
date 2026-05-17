from abc import abstractmethod
from service.schema.searcher import Channel
from service.lib.url import change_url_domain


class BaseChannelSearcher:
    def __init__(self, domain: str = "", **kwargs):
        self.domain = domain

    async def search(self, url: str) -> list[Channel]:
        if self.domain:
            url = change_url_domain(url, self.domain)
        return await self.search_impl(url)

    @abstractmethod
    async def search_impl(self, url: str) -> list[Channel]:
        pass
