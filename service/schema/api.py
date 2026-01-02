from .dtype import BaseModel

class Echo:
    class Request(BaseModel):
        message: str
    class Response(BaseModel):
        message: str
