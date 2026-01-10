from .dtype import BaseModel


class Subject(BaseModel):
    name: str
    url: str
    cover_url: str = ""


class Channel(BaseModel):
    class Episode(BaseModel):
        name: str
        url: str

    name: str
    episodes: list["Channel.Episode"]
    cover_url: str = ""


class SearchError(BaseModel):
    source_name: str
    source_key: str
    error: str
