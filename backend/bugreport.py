"""
Bug-report ingestion router.

Public POST /api/bugreport/submit accepts a structured bug report from
both the website ("Report a bug" page) and the desktop app's Help menu,
then forwards it to tech@marvex.app via Resend with `reply-to` set to
the reporter so the founder can reply directly from Gmail.

Mirrors the design of `press.py`:
  * Light Pydantic validation, anti-spam rate-limit per email, store the
    record in Mongo for audit + Admin Ops dashboard, fire-and-forget the
    email so a Resend hiccup never breaks the user-facing flow.
  * Storage shape: db.bug_reports
        { id, email, subject, description, source, app_version, url,
          user_agent, console_logs, status, created_at, ip_hint }

Owner-tunable env:
  BUGREPORT_RATE_LIMIT_HOURS  same email / N hours, default 1.
  BUGREPORT_TO                destination address. Default tech@marvex.app.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("backend.bugreport")

# Hard caps so an abusive payload can't fill the database.
MAX_DESCRIPTION = 4000
MAX_LOGS = 8000


def _rate_limit_hours() -> int:
    try:
        return max(0, int(os.environ.get("BUGREPORT_RATE_LIMIT_HOURS", "1")))
    except ValueError:
        return 1


def _destination() -> str:
    return os.environ.get("BUGREPORT_TO", "tech@marvex.app").strip()


class BugReportSubmit(BaseModel):
    email: EmailStr
    subject: str = Field(..., min_length=4, max_length=160)
    description: str = Field(..., min_length=10, max_length=MAX_DESCRIPTION)
    source: str = Field(default="web", max_length=24)         # "web" | "desktop"
    app_version: Optional[str] = Field(default=None, max_length=32)
    url: Optional[str] = Field(default=None, max_length=500)  # page URL where the bug was hit
    user_agent: Optional[str] = Field(default=None, max_length=300)
    console_logs: Optional[str] = Field(default=None, max_length=MAX_LOGS)


class BugReportResponse(BaseModel):
    ok: bool
    id: str
    message: str


def _build_email(report: Dict[str, Any]) -> tuple[str, str]:
    """Compose subject + HTML body for the tech@ inbox email."""
    src = (report.get("source") or "web").upper()
    short = (report.get("subject") or "")[:80]
    subject = f"[Marvex bug · {src}] {short}"

    def _row(label: str, value: str) -> str:
        if not value:
            return ""
        return (
            f'<tr><td style="padding:6px 12px 6px 0;color:#7a87ad;'
            f'font-size:12px;vertical-align:top;white-space:nowrap;">{label}</td>'
            f'<td style="padding:6px 0;color:#cfdaf3;font-size:13px;">{value}</td></tr>'
        )

    description_html = (
        (report.get("description") or "")
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    logs = (report.get("console_logs") or "").strip()
    logs_block = ""
    if logs:
        safe_logs = (
            logs.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        logs_block = (
            '<div style="margin-top:18px;"><div style="text-transform:uppercase;'
            'letter-spacing:0.18em;font-size:10px;color:#7a87ad;margin-bottom:6px;">'
            'Console / context</div>'
            '<pre style="background:#0a1428;border:1px solid rgba(255,255,255,0.06);'
            'border-radius:8px;padding:12px;color:#9aa7c7;font-size:11px;'
            f'line-height:1.5;white-space:pre-wrap;word-break:break-word;">{safe_logs}</pre></div>'
        )

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#03040a;color:#cfdaf3;padding:24px;max-width:680px;margin:0 auto;">
      <div style="border:1px solid rgba(255,90,120,0.22);border-radius:14px;padding:22px;background:linear-gradient(180deg,rgba(255,90,120,0.04),rgba(122,59,255,0.04));">
        <div style="text-transform:uppercase;letter-spacing:0.22em;font-size:11px;color:#ff7a8c;margin-bottom:10px;">Marvex Studio · Bug report</div>
        <h1 style="font-size:20px;color:#fff;margin:0 0 14px;line-height:1.25;">{report.get("subject", "")}</h1>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          {_row("From", report.get("email", ""))}
          {_row("Source", src)}
          {_row("Version", report.get("app_version") or "")}
          {_row("URL", report.get("url") or "")}
          {_row("User-Agent", report.get("user_agent") or "")}
          {_row("Reported", (report.get("created_at_iso") or ""))}
          {_row("Ref", report.get("id", ""))}
        </table>
        <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;">
          <div style="text-transform:uppercase;letter-spacing:0.18em;font-size:10px;color:#7a87ad;margin-bottom:8px;">Description</div>
          <div style="color:#e6ecff;font-size:14px;line-height:1.55;">{description_html}</div>
        </div>
        {logs_block}
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0 12px;"/>
        <p style="font-size:11px;color:#566187;line-height:1.6;margin:0;">
          Reply directly to this email to respond to the user — Marvex sets reply-to to their address.
        </p>
      </div>
    </div>
    """
    return subject, html


def make_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/api/bugreport", tags=["bugreport"])

    @router.post("/submit", response_model=BugReportResponse, status_code=201)
    async def submit(payload: BugReportSubmit, request: Request) -> BugReportResponse:
        email = payload.email.lower().strip()
        now = datetime.now(timezone.utc)

        # Rate-limit by email so a flood from one address can't spam the inbox.
        if _rate_limit_hours() > 0:
            cutoff = now - timedelta(hours=_rate_limit_hours())
            recent = await db.bug_reports.find_one(
                {"email": email, "created_at": {"$gte": cutoff}},
                {"_id": 0, "id": 1},
            )
            if recent:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"You already submitted a bug report in the last "
                        f"{_rate_limit_hours()}h — we received it. "
                        "If it's urgent, reply to that confirmation."
                    ),
                )

        report_id = f"bug-{secrets.token_hex(5)}"
        doc: Dict[str, Any] = {
            "id": report_id,
            "email": email,
            "subject": payload.subject.strip(),
            "description": payload.description.strip(),
            "source": (payload.source or "web").strip().lower()[:24],
            "app_version": (payload.app_version or "").strip()[:32] or None,
            "url": (payload.url or "").strip()[:500] or None,
            "user_agent": (payload.user_agent or request.headers.get("user-agent") or "")[:300] or None,
            "console_logs": (payload.console_logs or "").strip()[:MAX_LOGS] or None,
            "status": "new",
            "created_at": now,
            "ip_hint": (
                request.headers.get("x-forwarded-for")
                or (request.client.host if request.client else "")
            )[:60],
        }

        try:
            await db.bug_reports.insert_one(doc)
        except Exception as e:  # noqa: BLE001
            logger.exception("bug-report insert failed")
            raise HTTPException(status_code=500, detail=f"Could not save bug report: {e!s}") from e

        # Send the email — non-blocking semantics: a failure is logged but
        # never exposed to the user, who still gets a clean 201 with a ref id.
        try:
            from email_sender import send_email
            email_payload = {**doc, "created_at_iso": now.isoformat()}
            subject, html = _build_email(email_payload)
            result = await send_email(
                to=_destination(),
                subject=subject,
                html=html,
                # reply-to = reporter's email so the founder hits Reply and
                # the response lands in their inbox directly.
                reply_to=email,
            )
            if not result.get("ok"):
                logger.warning("bug-report: email send failed (%s) for %s",
                               result.get("error"), report_id)
        except Exception:  # noqa: BLE001
            logger.exception("bug-report: email send raised for %s", report_id)

        return BugReportResponse(
            ok=True,
            id=report_id,
            message="Thanks — we got your report and will look at it shortly.",
        )

    @router.get("/admin/list")
    async def admin_list(status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Read-only listing for the Admin Ops dashboard. Gated upstream
        by `/admin/ops` AccessGate (same as press code listing)."""
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        rows: List[Dict[str, Any]] = []
        async for r in (
            db.bug_reports
            .find(query, {"_id": 0, "ip_hint": 0, "console_logs": 0})
            .sort("created_at", -1)
            .limit(200)
        ):
            if isinstance(r.get("created_at"), datetime):
                r["created_at"] = r["created_at"].isoformat()
            rows.append(r)
        return rows

    return router
