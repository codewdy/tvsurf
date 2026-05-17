from abc import abstractmethod
from service.lib.url import change_url_domain


class BaseResourceSearcher:
    def __init__(self, domain: str = "", **kwargs):
        self.domain = domain

    async def search(self, url: str) -> str:
        if self.domain:
            url = change_url_domain(url, self.domain)
        return await self.search_impl(url)

    @abstractmethod
    async def search_impl(self, url: str) -> str:
        pass
