from .base import BaseResourceSearcher


class RawResourceSearcher(BaseResourceSearcher):
    def __init__(self, **kwargs):
        pass

    async def search(self, url):
        return url
