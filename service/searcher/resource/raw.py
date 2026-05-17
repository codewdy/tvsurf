from .base import BaseResourceSearcher


class RawResourceSearcher(BaseResourceSearcher):
    def __init__(self):
        pass

    async def search_impl(self, url):
        return url
