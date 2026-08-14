from fastapi import APIRouter, Header
from starlette import status

from app.core.config import get_settings
from app.core.errors import ApiError

router = APIRouter(prefix="/publish", tags=["publish"])


@router.post("/run")
def run_scheduled_publish(x_scheduler_secret: str | None = Header(default=None)) -> dict:
    settings = get_settings()
    if not settings.scheduler_secret:
        raise ApiError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SCHEDULER_NOT_CONFIGURED",
            message="Scheduler secret is not configured",
        )
    if x_scheduler_secret != settings.scheduler_secret:
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="SCHEDULER_FORBIDDEN",
            message="Invalid scheduler secret",
        )
    return {"processed": []}

