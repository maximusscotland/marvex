"""
Shared-map endpoints — users opt-in to publishing a read-only snapshot of
one of their maps under an unguessable slug. Viewers don't need to sign in.
"""
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional, Any, Dict, List

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response, HTMLResponse
from pydantic import BaseModel, Field, ConfigDict
from motor.motor_asyncio import AsyncIOMotorDatabase

from og_image import render_og_png, _count_branches

logger = logging.getLogger(__name__)

SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # unambiguous (no 0/O/1/l/i)
SLUG_LEN = 12
MAX_MAP_BYTES = 600_000  # ~600KB snapshot cap (Mongo doc limit is 16MB but UX-wise this is plenty)


def _new_slug() -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LEN))


class ShareCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    map: Dict[str, Any] = Field(..., description="Snapshot of the map tree")


class ShareResponse(BaseModel):
    slug: str
    view_count: int = 0
    created_at: str
    title: str = ""


def _public_projection() -> dict:
    # Explicitly exclude _id + owner to keep viewer response clean.
    # `owner_user_id` is needed temporarily to resolve the owner's
    # affiliate code; it's stripped before returning to the viewer.
    return {"_id": 0, "slug": 1, "map": 1, "view_count": 1, "created_at": 1, "title": 1, "owner_user_id": 1}


def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/share")

    @router.post("", response_model=ShareResponse)
    async def create_share(payload: ShareCreateRequest, user: dict = Depends(current_user_dep)):
        map_data = payload.map or {}
        if not isinstance(map_data, dict) or not map_data.get("title"):
            raise HTTPException(status_code=400, detail="Invalid map payload")

        # Size guard — avoid huge base64-image blobs.
        import json as _json
        raw = _json.dumps(map_data)
        if len(raw) > MAX_MAP_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Map is too large to share ({len(raw) // 1024} KB; limit {MAX_MAP_BYTES // 1024} KB). Remove large images first.",
            )

        # Generate unique slug (retry on the astronomically unlikely collision).
        for _ in range(5):
            slug = _new_slug()
            existing = await db.shared_maps.find_one({"slug": slug}, {"_id": 1})
            if not existing:
                break
        else:
            raise HTTPException(status_code=500, detail="Could not allocate a unique slug")

        now = datetime.now(timezone.utc).isoformat()
        await db.shared_maps.insert_one({
            "slug": slug,
            "owner_user_id": user["user_id"],
            "title": map_data.get("title", "Untitled"),
            "map": map_data,
            "view_count": 0,
            "created_at": now,
            "revoked": False,
        })
        return ShareResponse(slug=slug, view_count=0, created_at=now, title=map_data.get("title", ""))

    @router.get("/mine")
    async def list_my_shares(user: dict = Depends(current_user_dep)) -> List[Dict[str, Any]]:
        cursor = db.shared_maps.find(
            {"owner_user_id": user["user_id"], "revoked": {"$ne": True}},
            {"_id": 0, "slug": 1, "title": 1, "view_count": 1, "created_at": 1},
        ).sort("created_at", -1).limit(50)
        return [doc async for doc in cursor]

    @router.delete("/{slug}")
    async def revoke_share(slug: str, user: dict = Depends(current_user_dep)):
        res = await db.shared_maps.update_one(
            {"slug": slug, "owner_user_id": user["user_id"]},
            {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Share not found")
        return {"ok": True}

    @router.get("/{slug}/unfurl", response_class=HTMLResponse)
    async def unfurl_html(slug: str, request: Request):
        """
        Server-rendered crawler-friendly HTML for /share/:slug. Use this URL
        when sharing to services that do NOT execute JavaScript (Slackbot,
        Discordbot, iMessage, WhatsApp) — they'll parse the og:* tags from
        the initial HTML response. Human browsers get a <meta refresh>
        redirect to the real /share/:slug SPA viewer.
        """
        # Trust X-Forwarded-Proto (set by ingress/CF); fall back to https for
        # safety since OG crawlers penalise mixed-scheme meta URLs.
        proto = request.headers.get("x-forwarded-proto") or "https"
        host = request.headers.get("x-forwarded-host") or request.url.hostname
        if request.url.port and request.url.port not in (80, 443):
            host = f"{host}:{request.url.port}"
        base_url = f"{proto}://{host}"
        pretty_url = f"{base_url}/share/{slug}"
        og_image = f"{base_url}/api/share/{slug}/og.png"

        doc = await db.shared_maps.find_one(
            {"slug": slug, "revoked": {"$ne": True}},
            {"_id": 0, "title": 1, "map": 1, "view_count": 1},
        )
        if not doc:
            title = "This mind-map is no longer available"
            desc = "The owner may have revoked this share link. Create your own mind-map for free at marvex.app."
        else:
            title = (doc.get("title") or "Mind-Map")[:120]
            branches = len((doc.get("map") or {}).get("children") or [])
            desc = (
                f"A {branches}-branch mind-map shared on marvex.app. "
                f"Read-only · open-access. Turn any PDF into a research tree."
            )

        # Schema.org structured data — lets Google surface the shared map in
        # AI Overviews + rich snippets, and gives LLMs a clean citation target.
        created_at = (doc or {}).get("created_at") if doc else None
        import json as _json
        ld_json = _json.dumps({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            "name": title,
            "headline": title,
            "description": desc,
            "url": pretty_url,
            "image": og_image,
            "inLanguage": "en",
            "isFamilyFriendly": True,
            "isAccessibleForFree": True,
            **({"datePublished": created_at} if created_at else {}),
            "publisher": {
                "@type": "Organization",
                "name": "marvex.app",
                "url": "https://marvex.app",
            },
            "about": {"@type": "Thing", "name": title},
        }, separators=(",", ":"))

        # Basic HTML-escape (title/desc come from user input).
        def esc(s: str) -> str:
            return (
                (s or "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
            )

        html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)} · mind-mapper</title>
<meta name="description" content="{esc(desc)}" />
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="marvex.app" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(desc)}" />
<meta property="og:url" content="{esc(pretty_url)}" />
<meta property="og:image" content="{esc(og_image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{esc(title)}" />
<meta name="twitter:description" content="{esc(desc)}" />
<meta name="twitter:image" content="{esc(og_image)}" />
<!-- Redirect real browsers to the interactive SPA viewer -->
<meta http-equiv="refresh" content="0; url={esc(pretty_url)}" />
<link rel="canonical" href="{esc(pretty_url)}" />
<!-- Structured data for Google Rich Results / AI Overviews -->
<script type="application/ld+json">{ld_json}</script>
<style>body{{background:#03040a;color:#cfdaf3;font-family:system-ui,sans-serif;text-align:center;padding:80px 20px}}a{{color:#00f0ff}}</style>
</head>
<body>
<h1>{esc(title)}</h1>
<p>{esc(desc)}</p>
<p><a href="{esc(pretty_url)}">Open the interactive viewer →</a></p>
</body>
</html>"""
        return HTMLResponse(
            content=html,
            headers={
                "Cache-Control": "public, max-age=300",
                # Some crawlers respect this to avoid redirect chains.
                "X-Robots-Tag": "noindex",
            },
        )

    @router.get("/{slug}/og.png")
    async def og_image(slug: str):
        """Public OG unfurl image — no auth, 5 min browser cache."""
        doc = await db.shared_maps.find_one(
            {"slug": slug, "revoked": {"$ne": True}},
            {"_id": 0, "map": 1, "title": 1, "view_count": 1},
        )
        if not doc:
            # Return a generic branded card so crawlers don't get a 404 meta-image.
            png = render_og_png(title="This map is no longer available", branch_count=0, view_count=0)
            return Response(content=png, media_type="image/png", headers={
                "Cache-Control": "public, max-age=60",
            })
        png = render_og_png(
            title=doc.get("title") or "Mind-Map",
            branch_count=_count_branches(doc.get("map") or {}),
            view_count=int(doc.get("view_count") or 0),
            map_doc=doc.get("map") or None,
        )
        return Response(content=png, media_type="image/png", headers={
            "Cache-Control": "public, max-age=300",  # 5 min — balances freshness with unfurl-bot load
        })

    @router.get("/{slug}")
    async def get_share(slug: str) -> Dict[str, Any]:
        """Public read endpoint — no auth required. Increments view_count.

        We also surface the share-author's affiliate code so the share
        page can append `?ref=<code>` to its upgrade-CTAs (Premium UK
        Law badge, "Start free" link).  This turns every share into a
        commission-eligible link for its author — zero extra UX cost.
        """
        doc = await db.shared_maps.find_one(
            {"slug": slug, "revoked": {"$ne": True}},
            _public_projection(),
        )
        if not doc:
            raise HTTPException(status_code=404, detail="This share link has expired or was revoked")
        # Best-effort view count — swallow errors, don't block the read.
        try:
            await db.shared_maps.update_one({"slug": slug}, {"$inc": {"view_count": 1}})
        except Exception as e:  # pragma: no cover
            logger.warning(f"Could not increment view_count for {slug}: {e}")

        # Resolve the owner's affiliate code (if any). Strip owner_user_id
        # from the response — viewers should not be able to enumerate
        # who owns which share.
        ref_code = ""
        owner_id = doc.pop("owner_user_id", "")
        if owner_id:
            try:
                aff = await db.users.find_one(
                    {"user_id": owner_id},
                    {"_id": 0, "affiliate.code": 1},
                )
                ref_code = ((aff or {}).get("affiliate") or {}).get("code") or ""
            except Exception:
                pass
        doc["referral_code"] = ref_code
        return doc

    return router
