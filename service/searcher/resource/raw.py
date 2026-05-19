from .base import BaseResourceSearcher


class RawResourceSearcher(BaseResourceSearcher):
    async def search_impl(self, url):
        return url
