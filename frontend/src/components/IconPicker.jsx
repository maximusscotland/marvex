import React, { useState } from "react";
import {
  // Media
  Play,
  Image as ImageIcon,
  FileText,
  Music,
  // Research / decorative palette
  Book,
  BookOpen,
  Pen,
  PenTool,
  Brain,
  Microscope,
  FlaskConical,
  Atom,
  Clock,
  Calendar,
  Tag,
  Star,
  Heart,
  Lightbulb,
  Target,
  Map,
  Compass,
  Flag,
  Bookmark,
  Sparkles,
  Globe,
  Eye,
  Search,
  Zap,
  AlertCircle,
  CheckCircle2,
  Info,
  MessageCircle,
  Quote,
  X,
} from "lucide-react";

/**
 * Icon registry — used both by the picker and by the canvas renderer.
 * The `name` is what's persisted on the node (`node.icon`).
 *
 * Media icons render with distinctive accent colours so a video badge looks
 * like a video badge at a glance (red play, cyan image, amber PDF, fuchsia
 * music). Decorative icons render in cyan to match the rest of the cosmic
 * theme — they're for visual organisation, not signalling file type.
 *
 * Adding a new icon: import the lucide component above, add an entry here.
 */
export const ICON_REGISTRY = {
  // ---- Media (linkable) ----
  video:    { component: Play,        category: "media", label: "Video",   accent: "#ff4f5e" },
  image:    { component: ImageIcon,   category: "media", label: "Image",   accent: "#00f0ff" },
  pdf:      { component: FileText,    category: "media", label: "PDF",     accent: "#ffb547" },
  music:    { component: Music,       category: "media", label: "Music",   accent: "#ff6ad5" },

  // ---- Research / decorative ----
  book:        { component: Book,         category: "research", label: "Book" },
  bookOpen:    { component: BookOpen,     category: "research", label: "Open book" },
  pen:         { component: Pen,          category: "research", label: "Pen" },
  penTool:     { component: PenTool,      category: "research", label: "Author" },
  brain:       { component: Brain,        category: "research", label: "Brain" },
  microscope:  { component: Microscope,   category: "research", label: "Microscope" },
  flask:       { component: FlaskConical, category: "research", label: "Lab" },
  atom:        { component: Atom,         category: "research", label: "Science" },
  clock:       { component: Clock,        category: "research", label: "Clock" },
  calendar:    { component: Calendar,     category: "research", label: "Date" },
  tag:         { component: Tag,          category: "research", label: "Tag" },
  star:        { component: Star,         category: "research", label: "Star" },
  heart:       { component: Heart,        category: "research", label: "Favourite" },
  lightbulb:   { component: Lightbulb,    category: "research", label: "Idea" },
  target:      { component: Target,       category: "research", label: "Goal" },
  map:         { component: Map,          category: "research", label: "Map" },
  compass:     { component: Compass,      category: "research", label: "Direction" },
  flag:        { component: Flag,         category: "research", label: "Flag" },
  bookmark:    { component: Bookmark,     category: "research", label: "Bookmark" },
  sparkles:    { component: Sparkles,     category: "research", label: "Highlight" },
  globe:       { component: Globe,        category: "research", label: "Web" },
  eye:         { component: Eye,          category: "research", label: "Watch" },
  search:      { component: Search,       category: "research", label: "Search" },
  zap:         { component: Zap,          category: "research", label: "Action" },
  warning:     { component: AlertCircle,  category: "research", label: "Warning" },
  done:        { component: CheckCircle2, category: "research", label: "Done" },
  info:        { component: Info,         category: "research", label: "Info" },
  comment:     { component: MessageCircle,category: "research", label: "Note" },
  quote:       { component: Quote,        category: "research", label: "Quote" },
};

export const getIconConfig = (name) => ICON_REGISTRY[name] || null;

const CATEGORIES = [
  { id: "media",    label: "Media · linkable" },
  { id: "research", label: "Research & ideas" },
];

/**
 * Icon picker modal.
 *
 * Props:
 *  - current: string|null  — currently-selected icon name (highlighted in the grid)
 *  - onPick(name): called with the icon name (or null to clear)
 *  - onClose(): close without changing
 */
export default function IconPicker({ current, onPick, onClose }) {
  const [filter, setFilter] = useState("");
  const lower = filter.trim().toLowerCase();

  const filterFn = (entry) => {
    if (!lower) return true;
    return (
      entry.label.toLowerCase().includes(lower) ||
      entry.name.toLowerCase().includes(lower)
    );
  };

  const entriesByCategory = CATEGORIES.map((cat) => ({
    ...cat,
    icons: Object.entries(ICON_REGISTRY)
      .filter(([, v]) => v.category === cat.id)
      .map(([name, v]) => ({ name, ...v }))
      .filter(filterFn),
  }));

  return (
    <div
      data-testid="mm-icon-picker"
      className="fixed inset-0 z-[60] grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl p-6 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
              Pick an icon
            </div>
            <h3 className="text-lg font-semibold text-white">
              Mark this node with an icon
            </h3>
            <p className="text-[12px] text-[#7a87ad] mt-1 leading-relaxed">
              Media icons (video / image / PDF / music) render in a colour cue.
              When the node also has a link attached, click the icon to open it.
            </p>
          </div>
          <button
            data-testid="mm-icon-picker-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        <input
          data-testid="mm-icon-picker-search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search icons (book, brain, music, …)"
          className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187] mb-4"
        />

        <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {entriesByCategory.map((cat) =>
            cat.icons.length === 0 ? null : (
              <div key={cat.id} data-testid={`mm-icon-cat-${cat.id}`}>
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70 mb-2">
                  {cat.label}
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {cat.icons.map(({ name, component: Icon, label, accent }) => {
                    const isCurrent = current === name;
                    return (
                      <button
                        key={name}
                        data-testid={`mm-icon-${name}`}
                        onClick={() => onPick(name)}
                        title={label}
                        className={`group h-12 rounded-lg border flex items-center justify-center transition-all ${
                          isCurrent
                            ? "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_12px_rgba(0,240,255,0.35)]"
                            : "border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-500/5"
                        }`}
                      >
                        <Icon
                          size={18}
                          style={accent ? { color: accent } : undefined}
                          className={
                            accent ? "" : "text-cyan-300/90 group-hover:text-cyan-200"
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-white/5">
          <button
            data-testid="mm-icon-picker-clear"
            onClick={() => onPick(null)}
            className="text-[12px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!current}
          >
            Remove icon
          </button>
          <button
            data-testid="mm-icon-picker-cancel"
            onClick={onClose}
            className="text-[12px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-white/10 text-[#9aaad0] hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
