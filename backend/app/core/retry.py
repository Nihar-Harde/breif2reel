"""Retry and exponential backoff utility for external agent calls (A10 / NFR §2).

Provides standard decorators and helpers using `tenacity` to handle transient
network failures, rate limits (HTTP 429), and remote service drops for:
- Groq / Gemini LLM calls
- Google Imagen / Gemini Vision calls
- Edge-TTS voice generation
- Azure Container Apps / Colab video generation
"""

import functools
import logging
from typing import Any, Callable, TypeVar

from tenacity import (
    RetryError,
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def with_retry(
    max_attempts: int = 3,
    min_wait_seconds: float = 1.0,
    max_wait_seconds: float = 10.0,
    multiplier: float = 2.0,
    retry_exceptions: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[[F], F]:
    """Decorator to retry a function call with exponential backoff on transient errors."""

    def decorator(fn: F) -> F:
        @retry(
            reraise=True,
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(
                multiplier=multiplier, min=min_wait_seconds, max=max_wait_seconds
            ),
            retry=retry_if_exception_type(retry_exceptions),
            before_sleep=before_sleep_log(logger, logging.WARNING),
        )
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            return fn(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
