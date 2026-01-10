from .web_a import WebASubjectSearcher
from .base import BaseSubjectSearcher

types = {
    "web_a": WebASubjectSearcher,
}


def _create(type, **config) -> BaseSubjectSearcher:
    return types[type](**config)


def create_subject_searcher(config: dict) -> BaseSubjectSearcher:
    return _create(**config)
