import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * NavShortcuts — global Gmail-style "G then <letter>" keyboard navigation.
 *
 *   G → S  Studio          (/app)
 *   G → I  Intake          (/intake)
 *   G → L  Library         (/library)
 *   G → R  Reader          (/read)
 *   G → T  Tools           (/tools)
 *   G → H  Home / Landing  (/)
 *   ?      Show the cheatsheet toast
 *
 * Renders nothing. Mount once at the app root.
 */

const SHORTCUTS = {
  s: { path: "/app",     label: "Studio" },
  i: { path: "/intake",  label: "PDF Studio" },
  l: { path: "/library", label: "Library" },
  r: { path: "/read",    label: "Reader" },
  t: { path: "/tools",   label: "Tools" },
  h: { path: "/",        label: "Home" },
};

const CHEAT = "G → S Studio · I Intake · L Library · R Reader · T Tools · H Home  ·  Press ? anytime";

/** Skip the shortcut when the user is typing — inputs, textareas, contenteditable. */
const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
};

export default function NavShortcuts() {
  const navigate = useNavigate();
  const awaitingRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const cancelArming = () => {
      awaitingRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onKey = (e) => {
      // Skip modifier combos — those belong to other shortcuts (Cmd-K etc).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const k = (e.key || "").toLowerCase();

      // "?" opens the cheatsheet toast (Shift-? on most keyboards).
      if (k === "?") {
        e.preventDefault();
        toast(CHEAT, { duration: 4500 });
        return;
      }

      // Second key of a G-combo
      if (awaitingRef.current) {
        if (SHORTCUTS[k]) {
          e.preventDefault();
          const { path, label } = SHORTCUTS[k];
          cancelArming();
          navigate(path);
          toast(`→ ${label}`, { duration: 1200 });
        } else {
          cancelArming();
        }
        return;
      }

      // First key: the arm
      if (k === "g") {
        awaitingRef.current = true;
        timerRef.current = setTimeout(cancelArming, 1500);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelArming();
    };
  }, [navigate]);

  return null;
}
