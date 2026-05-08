"""
Sentry SDK bootstrap for the FastAPI backend.

Behaviour:
  * If `SENTRY_DSN` is unset (local dev), this is a complete no-op — no
    network calls, no breadcrumbs collected, no perf overhead. Imports
    of `sentry_sdk` elsewhere are still safe; they just become no-ops.
  * If set, we wire up the FastAPI + Starlette + PyMongo + logging
    integrations so HTTP exceptions, slow Mongo queries, and ERROR-level
    logs all surface in the Sentry dashboard.

Env:
  SENTRY_DSN                      — required to enable. From Sentry → Project Settings → Client Keys.
  SENTRY_ENVIRONMENT              — default "production".
  SENTRY_TRACES_SAMPLE_RATE       — default 0.1 (10% of requests traced).
  SENTRY_RELEASE                  — optional version tag for grouping by deploy.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger("backend.sentry")


def init_sentry() -> bool:
    """Initialise Sentry. Returns True if active, False if no-op."""
    dsn = (os.environ.get("SENTRY_DSN") or "").strip()
    if not dsn:
        logger.info("sentry: DSN not set — monitoring disabled")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.pymongo import PyMongoIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
    except ImportError:
        logger.warning("sentry: sentry-sdk not installed — monitoring disabled")
        return False

    try:
        traces_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    except ValueError:
        traces_rate = 0.1

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        release=os.environ.get("SENTRY_RELEASE") or None,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            PyMongoIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=traces_rate,
        send_default_pii=False,
        # Drop noisy/irrelevant exceptions before they consume quota.
        before_send=_filter_event,
    )
    logger.info("sentry: enabled (env=%s, traces=%.2f)",
                os.environ.get("SENTRY_ENVIRONMENT", "production"), traces_rate)
    return True


# 4xx HTTPException is not a "real" error — it's user input that got
# rejected (validation failure, wrong code, etc.). Drop those to keep
# the dashboard signal-to-noise high.
_NOISY_TYPES = {"HTTPException"}


def _filter_event(event, hint):  # type: ignore[no-untyped-def]
    exc_info = (hint or {}).get("exc_info")
    if not exc_info:
        return event
    exc = exc_info[1] if len(exc_info) >= 2 else None
    status = getattr(exc, "status_code", None)
    if isinstance(status, int) and 400 <= status < 500:
        return None
    if exc is not None and exc.__class__.__name__ in _NOISY_TYPES:
        return None
    return event
