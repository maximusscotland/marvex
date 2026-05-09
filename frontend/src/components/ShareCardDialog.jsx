import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Download, Copy, Check, Twitter, Linkedin, Loader2 } from "lucide-react";
import {
  buildShareCardBlob,
  buildTwitterIntent,
  buildLinkedInIntent,
  copyBlobToClipboard,
  downloadBlob,
} from "@/lib/shareCard";

/**
 * ShareCardDialog — rasterises the active map into a 1200×630 branded PNG
 * and offers Download / Copy / Tweet / LinkedIn actions. Designed to be
 * auto-opened after a successful streaming research run so users are prompted
 * to share the mind-map they just generated (viral acquisition loop).
 */
export default function ShareCardDialog({ open, map, shareSlug, onClose }) {
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !map) return undefined;
    let cancelled = false;
    let createdUrl = null;
    setLoading(true);
    setCopied(false);
    buildShareCardBlob(map)
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        createdUrl = URL.createObjectURL(b);
        setPreviewUrl(createdUrl);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Could not build share card");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, map]);

  // Escape to close
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !map) return null;

  const siteUrl = shareSlug
    ? `${window.location.origin}/api/share/${shareSlug}/unfurl`
    : "https://marvex.app";

  const handleDownload = () => {
    if (!blob) return;
    const safe = (map.title || "mindmap").replace(/[^\w\-]+/g, "_").slice(0, 60);
    downloadBlob(blob, `${safe}-share.png`);
    toast.success("PNG downloaded");
  };

  const handleCopy = async () => {
    if (!blob) return;
    try {
      await copyBlobToClipboard(blob);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Share card copied");
    } catch (err) {
      toast.error(err?.message || "Copy failed");
    }
  };

  const openIntent = (url) => {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
  };

  return (
    <div
      data-testid="share-card-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl p-6 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.25)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
              Share card
            </div>
            <h3 id="share-card-title" className="text-xl font-bold text-white">
              Flex your new map <span className="gradient-text">✨</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            data-testid="share-card-close"
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div
          className="rounded-xl overflow-hidden border border-white/10 bg-[#02040a] aspect-[1200/630] flex items-center justify-center mb-4"
          data-testid="share-card-preview-wrap"
        >
          {loading && (
            <div className="flex items-center gap-2 text-[#9aa7c7] text-[13px]">
              <Loader2 size={16} className="animate-spin text-cyan-300" />
              Building share card…
            </div>
          )}
          {!loading && previewUrl && (
            <img
              src={previewUrl}
              alt="Marvex Studio share card preview — exported mind map ready for social sharing"
              data-testid="share-card-preview"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <button
            onClick={handleDownload}
            disabled={!blob}
            data-testid="share-card-download"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Download size={12} /> PNG
          </button>
          <button
            onClick={handleCopy}
            disabled={!blob}
            data-testid="share-card-copy"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => openIntent(buildTwitterIntent({ title: map.title, url: siteUrl }))}
            data-testid="share-card-tweet"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-sky-400/40 text-sky-200 hover:bg-sky-400/10 transition flex items-center justify-center gap-1.5"
          >
            <Twitter size={12} /> Tweet
          </button>
          <button
            onClick={() => openIntent(buildLinkedInIntent({ url: siteUrl }))}
            data-testid="share-card-linkedin"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-blue-400/40 text-blue-200 hover:bg-blue-400/10 transition flex items-center justify-center gap-1.5"
          >
            <Linkedin size={12} /> LinkedIn
          </button>
        </div>

        <div className="text-[11.5px] text-[#7a87ad] leading-relaxed">
          {shareSlug ? (
            <>Share links auto-include your public viewer URL. Viewers don&apos;t need an account.</>
          ) : (
            <>Tip: generate a <strong className="text-cyan-300">share link</strong> first (Studio → Share), then come back here — your tweet will carry the live link.</>
          )}
        </div>
      </div>
    </div>
  );
}
