import pydantic

class BaseModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        validate_default=True
    )