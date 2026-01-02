from abc import abstractmethod
from service.schema.searcher import Channel

class BaseChannelSearcher:
    @abstractmethod
    async def search(self, url: str) -> list[Channel]:
        pass