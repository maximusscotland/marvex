import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import AssetsSidebar from "@/components/AssetsSidebar";

/**
 * MobileNav — hamburger toggle + slide-in drawer containing the AssetsSidebar,
 * so the 4 navigation buttons stay one tap away on phones where the desktop
 * rail is hidden. Renders nothing on ≥md viewports.
 *
 * Usage: drop <MobileNav /> once per page (same file where the desktop
 * <AssetsSidebar /> sits). Props are forwarded to the inner sidebar so the
 * Studio page can pass its `activeMapId` / `studioActive` / `onStudioClick`.
 */
const MobileNav = (props) => {
  const [open, setOpen] = useState(false);

  // Close on Esc for keyboard users, and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Hamburger — top-left, stays on top of page chrome */}
      <button
        data-testid="mobile-nav-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed top-3 left-3 z-40 w-10 h-10 rounded-lg grid place-items-center bg-[#0a1428] border border-cyan-500/40 text-cyan-200 hover:bg-[#0f1d38] hover:border-cyan-400 transition-all"
        style={{ boxShadow: "0 0 10px rgba(0,240,255,0.25)" }}
      >
        <Menu size={18} />
      </button>

      {/* Backdrop + drawer */}
      {open && (
        <div
          data-testid="mobile-nav-drawer"
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            data-testid="mobile-nav-backdrop"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ animation: "mobileNavFadeIn 180ms ease-out both" }}
          />
          <aside
            className="relative flex flex-col w-[260px] h-full border-r border-white/5 overflow-y-auto"
            style={{
              background: "linear-gradient(180deg, #060a1c 0%, #04060f 100%)",
              animation: "mobileNavSlideIn 220ms ease-out both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
              <div className="text-[12px] mono uppercase tracking-[0.2em] text-cyan-300/80">
                Marvex Studio
              </div>
              <button
                data-testid="mobile-nav-close"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="w-8 h-8 rounded-md grid place-items-center text-[#7a87ad] hover:text-cyan-300 hover:bg-cyan-500/10 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Close the drawer after the inner button's click handler runs
                (defer one macrotask so react-router's navigate() fires first). */}
            <div onClickCapture={() => setTimeout(() => setOpen(false), 0)}>
              <AssetsSidebar {...props} />
            </div>
          </aside>

          <style>{`
            @keyframes mobileNavSlideIn {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
            @keyframes mobileNavFadeIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default MobileNav;
