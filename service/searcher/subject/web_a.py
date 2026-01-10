from .web import WebSubjectSearcher
from service.schema.searcher import Subject
from service.lib.request import to_text
from urllib.parse import urljoin


class WebASubjectSearcher(WebSubjectSearcher):
    def __init__(self, search_url, token, a, cover, cover_attr):
        super().__init__(search_url)
        self.token = token
        self.a = a
        self.cover = cover
        self.cover_attr = cover_attr

    def parse(self, src, soup):
        tokens = soup.select(self.token)
        a_s = soup.select(self.a)
        covers = soup.select(self.cover)

        if len(tokens) != len(a_s):
            raise RuntimeError(
                f"cannot parse search result len(tokens)={len(tokens)} len(a_s)={len(a_s)}"
            )

        if len(tokens) != len(covers):
            raise RuntimeError(
                f"cannot parse search result len(tokens)={len(tokens)} len(covers)={len(covers)}"
            )

        return [
            Subject(
                name=to_text(token),
                url=urljoin(src, a["href"]),
                cover_url=urljoin(src, cover[self.cover_attr]),
            )
            for token, a, cover in zip(tokens, a_s, covers)
        ]
