from pydantic import BaseModel, Field


class Ticket(BaseModel):
    id: int
    title: str = Field(min_length=3)
    priority: int = Field(ge=1, le=3)
