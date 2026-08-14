from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status


def error_payload(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


class ApiError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail=error_payload(code, message))


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0]
    message = first.get("msg", "Validation error")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=error_payload("VALIDATION_ERROR", message),
    )


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        payload = exc.detail
    else:
        payload = error_payload("HTTP_ERROR", str(exc.detail))
    return JSONResponse(status_code=exc.status_code, content=payload)


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_payload("INTERNAL_SERVER_ERROR", str(exc)),
    )

