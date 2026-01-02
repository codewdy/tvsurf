from .web_a import WebASubjectSearcher
from .base import BaseSubjectSearcher

types = {
    "web_a": WebASubjectSearcher,
}

def create_subject_searcher(config: dict) -> BaseSubjectSearcher:
    return types[config["type"]](**config)