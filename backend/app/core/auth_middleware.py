from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.errors import error_payload


class TeamApiKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith(
            f"{settings.api_v1_prefix}/campaigns"
        ):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return JSONResponse(status_code=401, content=error_payload("AUTH_MISSING", "Missing Authorization header"))
            parts = auth_header.split(" ", 1)
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return JSONResponse(
                    status_code=401,
                    content=error_payload("AUTH_INVALID", "Authorization header must be Bearer token"),
                )
            if parts[1] != settings.team_api_key:
                return JSONResponse(status_code=403, content=error_payload("AUTH_FORBIDDEN", "Invalid team API key"))

        return await call_next(request)

