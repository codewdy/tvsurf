from abc import abstractmethod


class BaseResourceSearcher:
    @abstractmethod
    async def search(self, url: str) -> str:
        pass
