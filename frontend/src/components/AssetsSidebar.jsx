import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Library as LibraryIcon, Highlighter, StickyNote, CalendarDays, Workflow, Clock as ClockIcon } from "lucide-react";
import { countActiveReminders } from "@/lib/reminders";

/**
 * AssetsSidebar — the 4 "where do I want to go" buttons that live under the
 * sidebar's ASSETS heading: Marvex Studio · PDF Studio · Library · Reader.
 *
 * Glow on active:
 *   Uses useLocation() to pick the "you are here" button. Strong cyan halo on
 *   match, subtle ghost on the rest (matching the CREATE row's NEW/OPEN style).
 *
 * Props (all optional — gracefully degrades when the host page is not Studio):
 *   activeMapId   — currently-open map ID, used to deep-link Reader with ?map=
 *   studioActive  — when true AND we're on /app, shows the "STUDIO ON" badge
 *   onStudioClick — custom click handler for the Studio button (Studio.jsx uses
 *                   this to open its hidden JSON importer). Defaults to navigating
 *                   to /app.
 */
const AssetsSidebar = ({ activeMapId, studioActive = false, onStudioClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeRoute = (() => {
    const p = location.pathname || "/";
    if (p.startsWith("/intake")) return "intake";
    if (p.startsWith("/flowchart")) return "flowchart";
    if (p.startsWith("/timeline")) return "timeline";
    if (p.startsWith("/library")) return "library";
    if (p.startsWith("/output")) return "output";
    if (p.startsWith("/calendar")) return "calendar";
    if (p.startsWith("/read")) return "reader";
    return "studio";
  })();

  // Active reminder count — drives the OUTPUT button's amber dot.
  // Recomputed on every render so it stays in sync after a sticky is added/edited.
  const activeReminders = countActiveReminders();

  const entries = [
    {
      key: "studio",
      testid: "btn-pdf-studio",
      icon: Upload,
      label: t("studio.actions.mindMapperStudio"),
      onClick: onStudioClick || (() => navigate("/app")),
    },
    {
      key: "intake",
      testid: "btn-pdf-to-mindmap",
      icon: FileText,
      label: "PDF Studio",
      onClick: () => navigate("/intake"),
    },
    {
      key: "flowchart",
      testid: "btn-flowchart-studio",
      icon: Workflow,
      label: "Flowchart Studio",
      onClick: () => navigate("/flowchart"),
    },
    {
      key: "timeline",
      testid: "btn-timeline-studio",
      icon: ClockIcon,
      label: "Timeline Studio",
      onClick: () => navigate("/timeline"),
      // Beta indicator (matches the BETA pill in /timeline header).
      badge: "β",
    },
    {
      key: "library",
      testid: "btn-open-library",
      icon: LibraryIcon,
      label: t("studio.actions.library"),
      onClick: () => navigate("/library"),
    },
    {
      key: "output",
      testid: "btn-open-output",
      icon: StickyNote,
      label: "Requested Assets",
      onClick: () => navigate("/output"),
      badge: activeReminders > 0 ? String(activeReminders) : null,
    },
    {
      key: "calendar",
      testid: "btn-open-calendar",
      icon: CalendarDays,
      label: "Calendar",
      onClick: () => navigate("/calendar"),
    },
    {
      key: "reader",
      testid: "btn-open-reader",
      icon: Highlighter,
      label: t("studio.actions.reader"),
      onClick: () =>
        navigate(`/read${activeMapId ? `?map=${activeMapId}` : ""}`),
    },
  ];

  return (
    <div className="px-5 pt-7" data-testid="assets-sidebar">
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#566187] mb-3">
        {t("studio.sections.assets")}
      </div>
      <div className="flex flex-col gap-2">
        {entries.map(({ key, testid, icon: Icon, label, onClick, badge, tone }) => {
          const isActive = activeRoute === key;
          const isAmber = tone === "amber";
          return (
            <button
              key={key}
              data-testid={testid}
              onClick={onClick}
              aria-current={isActive ? "page" : undefined}
              className={
                "px-3 py-2.5 rounded-lg bg-[#0a1428] text-cyan-100 text-[12px] mono uppercase tracking-[0.18em] text-left flex items-center justify-between gap-2 transition-all duration-200 " +
                (isAmber
                  ? "hover:bg-[#1a1408] hover:text-amber-100 "
                  : "hover:bg-[#0f1d38] hover:text-cyan-200 ") +
                (isActive
                  ? isAmber
                    ? "border border-amber-300"
                    : "border border-cyan-400"
                  : isAmber
                    ? "border border-amber-500/40 hover:border-amber-300 hover:shadow-[0_0_14px_rgba(255,221,68,0.45),inset_0_0_10px_rgba(255,221,68,0.15)]"
                    : "border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_14px_rgba(0,240,255,0.45),inset_0_0_10px_rgba(0,240,255,0.15)]")
              }
              style={{
                boxShadow: isActive
                  ? isAmber
                    ? "0 0 22px rgba(255,221,68,0.55), inset 0 0 14px rgba(255,221,68,0.2)"
                    : "0 0 22px rgba(0,240,255,0.55), inset 0 0 14px rgba(0,240,255,0.2)"
                  : isAmber
                    ? "0 0 10px rgba(255,221,68,0.25), inset 0 0 8px rgba(255,221,68,0.08)"
                    : "0 0 10px rgba(0,240,255,0.25), inset 0 0 8px rgba(0,240,255,0.08)",
              }}
            >
              <span className="flex items-center gap-2">
                <Icon size={12} style={isAmber ? { color: "#ffec3d" } : undefined} /> {label}
              </span>
              {badge && (
                <span
                  data-testid={`${testid}-badge`}
                  title={`${badge} active reminder${badge === "1" ? "" : "s"} · click to view in Requested Assets`}
                  className="mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded bg-cyan-500/20 text-cyan-100 border border-cyan-400/40 font-bold tabular-nums"
                >
                  {badge}
                </span>
              )}
              {key === "studio" && isActive && studioActive && (
                <span
                  className="mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                  data-testid="studio-active-badge"
                >
                  {t("studio.actions.studioOn")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AssetsSidebar;
