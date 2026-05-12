/**
 * Video URL detection + embed helpers.
 *
 * Supports YouTube (youtube.com, youtu.be, youtube.com/shorts/) and
 * Vimeo (vimeo.com/{id}, player.vimeo.com/video/{id}).  Returns a
 * canonical embed URL when the input is a recognised video URL,
 * otherwise null.  We deliberately use the privacy-enhanced YouTube
 * domain (`youtube-nocookie.com`) so visitors don't pick up a third-
 * party cookie just from opening a map — keeps the local-first /
 * "no tracking" promise honest, and means we don't have to add a
 * GDPR consent layer for embedded video.
 *
 * Usage:
 *   import { detectVideoEmbed } from "@/lib/videoEmbed";
 *   const info = detectVideoEmbed(url);
 *   if (info) { <iframe src={info.embedUrl} ... /> }
 */

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

/** Pull the 11-char YouTube video id from any YouTube URL flavour. */
const youTubeIdFromUrl = (u) => {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    if (!YT_HOSTS.includes(host)) return null;
    // youtu.be/{id}
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    // /watch?v={id}
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{6,}$/.test(v)) return v;
    // /shorts/{id} or /embed/{id} or /v/{id}
    const m = url.pathname.match(/^\/(shorts|embed|v|live)\/([\w-]{6,})/);
    if (m) return m[2];
    return null;
  } catch { return null; }
};

/** Pull the numeric Vimeo video id. */
const vimeoIdFromUrl = (u) => {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    if (!VIMEO_HOSTS.includes(host)) return null;
    // player.vimeo.com/video/{id}
    let m = url.pathname.match(/^\/video\/(\d+)/);
    if (m) return m[1];
    // vimeo.com/{id} (or vimeo.com/channels/foo/{id})
    m = url.pathname.match(/\/(\d{6,12})(?:\/|$)/);
    if (m) return m[1];
    return null;
  } catch { return null; }
};

/**
 * Detect whether a URL is an embeddable video.  Returns:
 *   { provider: "youtube"|"vimeo", videoId, embedUrl, originalUrl }
 * or `null` if not recognised.
 */
export function detectVideoEmbed(url) {
  if (!url || typeof url !== "string") return null;
  // Reject data: / mailto: / file: up front
  if (/^(data|mailto|file):/i.test(url)) return null;

  const yt = youTubeIdFromUrl(url);
  if (yt) {
    return {
      provider: "youtube",
      videoId: yt,
      // youtube-nocookie.com + rel=0 (no related-video panel pulling
      // suggestions from other channels) + modestbranding for a less
      // YouTube-y chrome.  Autoplay is OFF — user clicks ▶ in our
      // wrapper to play, matching the small-player UX they asked for.
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`,
      originalUrl: url,
    };
  }

  const vm = vimeoIdFromUrl(url);
  if (vm) {
    return {
      provider: "vimeo",
      videoId: vm,
      // dnt=1 ("Do Not Track") tells Vimeo to skip its analytics
      // cookies, keeping us GDPR-friendly.  title/byline/portrait=0
      // strips the busy header chrome so the player blends with the
      // cosmic dark canvas.
      embedUrl: `https://player.vimeo.com/video/${vm}?dnt=1&title=0&byline=0&portrait=0`,
      originalUrl: url,
    };
  }

  return null;
}

/** Convenience predicate. */
export const isVideoEmbedUrl = (url) => detectVideoEmbed(url) !== null;
