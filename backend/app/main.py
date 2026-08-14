from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth_middleware import TeamApiKeyAuthMiddleware
from app.core.config import get_settings
from app.core.errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.routes.campaigns import router as campaigns_router
from app.routes.niches import router as niches_router
from app.routes.publish import router as publish_router

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TeamApiKeyAuthMiddleware)

app.include_router(campaigns_router, prefix=settings.api_v1_prefix)
app.include_router(niches_router, prefix=settings.api_v1_prefix)
app.include_router(publish_router, prefix=settings.api_v1_prefix)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
