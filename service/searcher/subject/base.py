from abc import abstractmethod
from service.schema.searcher import Subject

class BaseSubjectSearcher:
    @abstractmethod
    async def search(self, query: str) -> list[Subject]:
        pass