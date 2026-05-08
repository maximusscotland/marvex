"""
Transactional email helper.

Supports TWO backends — picked automatically based on what's configured:

  1. SMTP  (preferred for self-hosted mailboxes like Spaceship Mail).
     Triggered when SMTP_HOST + SMTP_USERNAME + SMTP_PASSWORD are set.
     Sends async via aiosmtplib so the FastAPI event loop stays responsive.

  2. Resend (cloud transactional service, used as a fallback / overflow).
     Triggered when RESEND_API_KEY is set AND SMTP isn't.

If NEITHER is configured the helper logs a warning and returns a "skipped"
status — it never raises, so a missing config never breaks signup.

Env (in `/app/backend/.env`):
  SENDER_EMAIL         — From address. Default: onboarding@resend.dev
  SENDER_NAME          — Display name. Default: Marvex Studio
  SMTP_HOST            — SMTP server (e.g. mail.spaceship.com)
  SMTP_PORT            — 465 (SSL) or 587 (STARTTLS). Default: 465
  SMTP_USERNAME        — Auth user (full email address)
  SMTP_PASSWORD        — Auth password
  RESEND_API_KEY       — Resend API key (re_...)
"""

import asyncio
import base64
import logging
import os
import ssl
from email.message import EmailMessage
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
#                              Config helpers
# ---------------------------------------------------------------------------

def _smtp_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USERNAME")
        and os.environ.get("SMTP_PASSWORD")
    )


def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def _sender_address() -> str:
    addr = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    name = os.environ.get("SENDER_NAME", "Marvex Studio")
    return f"{name} <{addr}>"


def _sender_email_only() -> str:
    return os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


# ---------------------------------------------------------------------------
#                              SMTP backend
# ---------------------------------------------------------------------------

def _build_smtp_message(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: Optional[str],
    attachments: Optional[List[Path]],
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = _sender_address()
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    # Deliverability-critical headers (Outlook + Gmail love these).
    # ``List-Unsubscribe`` (RFC 2369) + ``List-Unsubscribe-Post`` (RFC 8058)
    # = the single biggest signal that you're a legitimate bulk sender, not
    # a spammer. Outlook now demotes any "transactional"-looking email that
    # lacks them.
    sender = _sender_email_only()
    msg["List-Unsubscribe"] = f"<mailto:{sender}?subject=unsubscribe>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    # ``Sender`` aligned with ``From`` reassures spam filters the message
    # isn't being relayed by a different actor than it claims.
    msg["Sender"] = sender
    # Plain-text alternative — make it substantive, not a placeholder.
    # Outlook penalises emails whose plain-text part is shorter than ~5x
    # the HTML's word count would suggest.
    msg.set_content(_plain_text_fallback())
    msg.add_alternative(html, subtype="html")
    for path in attachments or []:
        try:
            if not path.exists():
                logger.warning("attachment missing, skipping: %s", path)
                continue
            data = path.read_bytes()
            msg.add_attachment(
                data,
                maintype="application",
                subtype="pdf" if path.suffix.lower() == ".pdf" else "octet-stream",
                filename=path.name,
            )
        except Exception:
            logger.exception("could not attach %s", path)
    return msg


def _plain_text_fallback() -> str:
    """A real plain-text version of the welcome email so spam filters see
    parity between the HTML and text parts. Pure ASCII keeps every legacy
    client happy."""
    return (
        "Welcome to Marvex Studio.\n"
        "\n"
        "Thanks for joining the early-access list. We will email you the\n"
        "moment the Studio opens to founding members.\n"
        "\n"
        "In the meantime, your starter guide is attached to this message:\n"
        "\n"
        "  Using Marvex Studio -- an 8-chapter pocket manual covering the\n"
        "  right-click magic, BYOK setup, the global search, smart link\n"
        "  routing, the calendar view, and every keyboard shortcut you\n"
        "  will ever need.\n"
        "\n"
        "Visit:  https://marvex.app\n"
        "Reply to this email any time -- it lands in our inbox and gets\n"
        "read the same day.\n"
        "\n"
        "-- The Marvex Studio team\n"
        "\n"
        "----\n"
        "You are receiving this because your email was entered on the\n"
        "marvex.app waitlist form. To unsubscribe, reply with the\n"
        "word `remove' in the subject line.\n"
    )


async def _send_via_smtp(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: Optional[str],
    attachments: Optional[List[Path]],
) -> Dict[str, Any]:
    try:
        import aiosmtplib  # type: ignore
    except ImportError:
        return {"ok": False, "error": "aiosmtplib not installed"}

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "465"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    msg = _build_smtp_message(
        to=to, subject=subject, html=html,
        reply_to=reply_to, attachments=attachments,
    )

    # Port 465 = implicit SSL; port 587 = STARTTLS upgrade.
    use_tls = port == 465
    start_tls = port in (587, 25)

    try:
        await aiosmtplib.send(
            msg,
            hostname=host,
            port=port,
            username=username,
            password=password,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=30,
            tls_context=ssl.create_default_context() if use_tls or start_tls else None,
        )
        logger.info("smtp send OK → %s (host=%s:%s)", to, host, port)
        return {"ok": True, "backend": "smtp"}
    except Exception as e:
        logger.exception("smtp send failed → %s", to)
        return {"ok": False, "backend": "smtp", "error": str(e)}


# ---------------------------------------------------------------------------
#                              Resend backend
# ---------------------------------------------------------------------------

def _encode_attachment_resend(path: Path) -> Optional[Dict[str, Any]]:
    try:
        if not path.exists():
            return None
        return {
            "filename": path.name,
            "content": base64.b64encode(path.read_bytes()).decode("ascii"),
        }
    except Exception:
        logger.exception("resend attachment encode failed for %s", path)
        return None


async def _send_via_resend(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: Optional[str],
    attachments: Optional[List[Path]],
) -> Dict[str, Any]:
    try:
        import resend  # type: ignore
        resend.api_key = os.environ.get("RESEND_API_KEY")
    except ImportError:
        return {"ok": False, "error": "resend SDK not installed"}

    params: Dict[str, Any] = {
        "from": _sender_address(),
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        params["reply_to"] = [reply_to]
    encoded = []
    for p in attachments or []:
        e = _encode_attachment_resend(p)
        if e:
            encoded.append(e)
    if encoded:
        params["attachments"] = encoded

    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        email_id = resp.get("id") if isinstance(resp, dict) else None
        return {"ok": True, "backend": "resend", "id": email_id}
    except Exception as e:
        logger.exception("resend send failed → %s", to)
        return {"ok": False, "backend": "resend", "error": str(e)}


# ---------------------------------------------------------------------------
#                              Public API
# ---------------------------------------------------------------------------

async def send_email(
    to: str,
    subject: str,
    html: str,
    *,
    attachments: Optional[List[Path]] = None,
    reply_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Send via whichever backend is configured. Never raises.

    Priority order:
      1. Resend (when RESEND_API_KEY is set) — clean IPs, better
         deliverability than fresh shared-host SMTP.
      2. SMTP (when SMTP_HOST/USERNAME/PASSWORD are set) — fallback
         when Resend isn't configured OR when Resend rejects the
         request (e.g. domain not verified, key revoked, rate-limited).

    The fall-back chain is essential during launch week: Resend's
    domain-verification check can flag "unverified" while DNS is still
    propagating, and we never want a signup to silently fail to email.
    """
    if _resend_configured():
        result = await _send_via_resend(
            to=to, subject=subject, html=html,
            reply_to=reply_to or _sender_email_only(),
            attachments=attachments,
        )
        if result.get("ok"):
            return result
        # Resend refused — try SMTP as a fallback so the user still gets
        # the welcome email. Tag the result so we can grep "fallback" in
        # logs to see when Resend is misbehaving.
        if _smtp_configured():
            logger.warning("resend send failed (%s) → falling back to SMTP for %s",
                           result.get("error"), to)
            smtp_result = await _send_via_smtp(
                to=to, subject=subject, html=html,
                reply_to=reply_to or _sender_email_only(),
                attachments=attachments,
            )
            smtp_result["fallback_from"] = "resend"
            smtp_result["resend_error"] = result.get("error")
            return smtp_result
        return result

    if _smtp_configured():
        return await _send_via_smtp(
            to=to, subject=subject, html=html,
            reply_to=reply_to or _sender_email_only(),
            attachments=attachments,
        )
    logger.info("no email backend configured — skipping send to %s", to)
    return {"ok": False, "skipped": True, "reason": "no email backend configured"}
