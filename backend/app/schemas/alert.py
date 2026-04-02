from pydantic import BaseModel

class AlertUpdateRequest(BaseModel):
    status: str | None = None       # new|acknowledged|in_progress|referred|closed
    note: str | None = None
    assigned_to: str | None = None  # user UUID (as string)
