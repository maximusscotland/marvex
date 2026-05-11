import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download as DownloadIcon, Monitor, Apple, Server, Github, ExternalLink, ShieldAlert, Cpu, CheckCircle2, Lock, Sparkles } from "lucide-react";
import usePageMeta from "@/lib/usePageMeta";
import { useAuth } from "@/lib/auth";
import { useLicense } from "@/lib/license";

/**
 * Friendly download landing page. Detects the user's OS via `navigator.platform`
 * + `userAgent` AND their CPU architecture via `navigator.userAgentData` (where
 * supported) so we can highlight the exact installer they need — not just the
 * broad platform. Every installer is linked from the latest GitHub Release so
 * users always get the newest build — no manual version bumps needed here.
 *
 * GITHUB_REPO is read from .env (`REACT_APP_DESKTOP_GITHUB_REPO`) so you can
 * point at the actual repo without touching code.
 */

const REPO = process.env.REACT_APP_DESKTOP_GITHUB_REPO || "maximusscotland/marvex";
const REPO_CONFIGURED = !REPO.startsWith("YOUR_GITHUB_USERNAME");
const RELEASE_BASE = `https://github.com/${REPO}/releases/latest/download`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

const detectOs = () => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = `${navigator.userAgent} ${navigator.platform || ""}`.toLowerCase();
  if (/mac|darwin|iphone|ipad|ipod/.test(ua)) return "mac";
  if (/win/.test(ua)) return "windows";
  if (/linux|x11|ubuntu|fedora/.test(ua)) return "linux";
  return "unknown";
};

/**
 * Detect CPU architecture — used to auto-highlight "x64" vs "arm64" installer.
 *
 * Best effort: modern Chromium exposes `navigator.userAgentData.getHighEntropyValues`
 * which we await for an accurate answer. On older browsers / Safari / Firefox
 * we fall back to userAgent string patterns and default to x64 (the majority
 * platform on Windows + Linux, and still widely used on older Macs).
 *
 * Returns: "x64" | "arm64"
 */
const detectArch = async () => {
  // Modern API (Chrome, Edge, Brave 90+). Safari/Firefox don't support it.
  try {
    const uad = navigator.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === "function") {
      const info = await uad.getHighEntropyValues(["architecture", "bitness"]);
      const a = (info?.architecture || "").toLowerCase();
      if (a === "arm") return "arm64";
      if (a === "x86" && info?.bitness === "64") return "x64";
      if (a === "x86") return "x64"; // 32-bit Windows is vanishingly rare; ship x64
    }
  } catch { /* fall through */ }
  // Legacy fallback — Safari on Apple Silicon still identifies as "Intel" for
  // compatibility. We can't reliably detect ARM Macs from userAgent alone, so
  // on Safari/Firefox Mac we pick arm64 (the majority shipping Mac since 2020)
  // and x64 everywhere else (Windows + Linux still majority Intel).
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const plat = (navigator.platform || "").toLowerCase();
    if (/mac|darwin/.test(ua + plat)) {
      // Only treat old Intel-only Macs (10.x) as x64; everything else is likely ARM.
      if (/mac os x 10_1[0-5]|mac os x 10\.1[0-5]/.test(ua)) return "x64";
      return "arm64";
    }
    if (/arm64|aarch64/.test(ua)) return "arm64";
  } catch { /* ignore */ }
  return "x64";
};

// File names follow electron-builder's default pattern:
//   Marvex Studio-<version>-<arch>.<ext>
// We use the `-latest` convention where possible, falling back to the
// product-name prefix electron-builder emits.
//
// Each entry tags the target `arch` ("x64" | "arm64" | "any") so the detected
// architecture can auto-pick which of the multiple installers to highlight
// as "Recommended for you".
const BUILDS = {
  windows: [
    {
      label: "Windows Installer (x64)",
      sub:   "Standard Windows PCs · Intel / AMD 64-bit · .exe",
      href:  `${RELEASE_BASE}/Marvex-Studio-Setup-x64.exe`,
      arch:  "x64",
      installer: true,
    },
    {
      label: "Windows Installer (ARM64)",
      sub:   "Snapdragon / Surface Pro X / Surface Pro 9 5G · .exe",
      href:  `${RELEASE_BASE}/Marvex-Studio-Setup-arm64.exe`,
      arch:  "arm64",
      installer: true,
    },
    {
      label: "Windows Portable (x64)",
      sub:   "Run from USB / no-install · .exe",
      href:  `${RELEASE_BASE}/Marvex-Studio-Portable-x64.exe`,
      arch:  "x64",
      installer: false,
    },
  ],
  mac: [
    {
      label: "macOS — Apple Silicon",
      sub:   "M1 / M2 / M3 / M4 · .dmg",
      href:  `${RELEASE_BASE}/Marvex-Studio-arm64.dmg`,
      arch:  "arm64",
      installer: true,
    },
    {
      label: "macOS — Intel",
      sub:   "Pre-2020 Intel Macs · .dmg",
      href:  `${RELEASE_BASE}/Marvex-Studio-x64.dmg`,
      arch:  "x64",
      installer: true,
    },
  ],
  linux: [
    {
      label: "Linux — AppImage (x64)",
      sub:   "Any distro · chmod +x and go",
      href:  `${RELEASE_BASE}/Marvex-Studio-x86_64.AppImage`,
      arch:  "x64",
      installer: true,
    },
    {
      label: "Linux — .deb (x64)",
      sub:   "Ubuntu / Debian / Mint / Pop!_OS",
      href:  `${RELEASE_BASE}/Marvex-Studio-amd64.deb`,
      arch:  "x64",
      installer: false,
    },
    {
      label: "Linux — .rpm (x64)",
      sub:   "Fedora / RHEL / openSUSE",
      href:  `${RELEASE_BASE}/Marvex-Studio-x86_64.rpm`,
      arch:  "x64",
      installer: false,
    },
  ],
};

/**
 * Step-by-step install instructions, per OS. Shown inline below the
 * detected-OS card so the user doesn't have to hunt around. We intentionally
 * write them plain-language (no jargon) because many users installing a
 * desktop app for the first time get scared off by unfamiliar dialogs.
 */
const INSTALL_STEPS = {
  windows: {
    title: "How to install on Windows",
    steps: [
      "Click the highlighted Windows button above to download the .exe (around 85 MB).",
      "Double-click the downloaded file — usually in your Downloads folder.",
      "You'll see \"Windows protected your PC\" from SmartScreen. This is because the installer is unsigned in v1 (we'll add the $400/yr certificate once we have paying users — it's safe).",
      "Click \"More info\", then \"Run anyway\".",
      "Follow the installer — pick an install location, click Install, then Finish.",
      "Launch Marvex Studio from the Start Menu or the desktop shortcut.",
    ],
  },
  mac: {
    title: "How to install on macOS",
    steps: [
      "Click the highlighted macOS button above to download the .dmg (around 95 MB).",
      "Double-click the downloaded .dmg to mount the disk image.",
      "Drag \"Marvex Studio\" to the Applications folder (a shortcut to Applications appears in the disk image).",
      "Eject the disk image from Finder's sidebar.",
      "v0.1 is unsigned on macOS — the first launch shows \"Marvex cannot be opened because the developer cannot be verified\". This is expected for indie tools at launch.",
      "Right-click (or Ctrl-click) Marvex Studio in Applications → choose Open → click Open in the confirmation dialog.",
      "macOS remembers — every launch after that is silent, no warnings. Apple signing is coming in v0.2.",
    ],
  },
  linux: {
    title: "How to install on Linux",
    steps: [
      "Click the highlighted Linux button above to download the installer that matches your distro.",
      "AppImage (universal): open a terminal in your Downloads folder, run chmod +x Marvex*.AppImage, then ./Marvex*.AppImage to launch.",
      ".deb (Ubuntu/Debian/Mint): double-click to open in Software Centre, or run sudo apt install ./Marvex*.deb from terminal.",
      ".rpm (Fedora/RHEL): double-click, or sudo dnf install ./Marvex*.rpm from terminal.",
      "Launch from your applications menu, or just run Marvex Studio from terminal after install.",
    ],
  },
};

const ICONS = {
  windows: Monitor,
  mac:     Apple,
  linux:   Server,
};

const TITLES = {
  windows: "Windows",
  mac:     "macOS",
  linux:   "Linux",
};

export default function Download() {
  const [os, setOs] = useState("unknown");
  const [arch, setArch] = useState("x64");
  const { user, signIn, loading: authLoading } = useAuth();
  const license = useLicense();
  // Any paid tier (Lite / Pro / Founder / Lifetime) gets desktop access.
  // Lite users paying $9/mo are entitled to the desktop app — gating to
  // Pro-only would cheat them. License `active` is true for any paid plan;
  // `founder` covers manually granted lifetime accounts.
  const canDownload = license.active || license.founder;
  usePageMeta({
    title: "Download Marvex Studio · Pro feature · Windows, macOS & Linux",
    description: "Native desktop app for turning PDFs into beautiful mind-maps. Included with every paid Marvex plan (Lite · Pro · Founder · Lifetime). Windows, macOS (Apple Silicon + Intel), and Linux.",
    type: "website",
  });

  useEffect(() => {
    setOs(detectOs());
    detectArch().then((a) => setArch(a));
  }, []);

  const primaryKey = os === "unknown" ? "windows" : os;
  const ordered = ["windows", "mac", "linux"].sort((a, b) => {
    if (a === primaryKey) return -1;
    if (b === primaryKey) return 1;
    return 0;
  });

  // Pick the single recommended installer for the detected OS + arch. Falls
  // back to the first "installer: true" build if nothing matches exactly.
  const pickRecommended = (osKey) => {
    const list = BUILDS[osKey] || [];
    const match = list.find((b) => b.arch === arch && b.installer);
    return match || list.find((b) => b.installer) || list[0];
  };
  const recommendedHref = pickRecommended(primaryKey)?.href;

  const archLabel = arch === "arm64" ? "ARM64" : "64-bit Intel/AMD (x64)";
  const osLabel = TITLES[primaryKey] || "your system";

  return (
    <div className="min-h-screen bg-[#04060d] text-white" data-testid="download-page">
      {/* Header */}
      <header className="px-6 md:px-10 h-16 flex items-center gap-4 border-b border-white/10">
        <Link
          to="/"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5"
          data-testid="download-back"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="h-6 w-px bg-white/10" />
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
          Marvex Studio Desktop
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-16 pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-6">
            <DownloadIcon size={12} /> Native desktop app · v0.1
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Marvex Studio on{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-violet-400">
              your machine
            </span>
          </h1>
          <p className="text-[#a4b4d8] text-lg leading-relaxed mb-2">
            Same app, native window. Local-first maps, offline reading, OS-level menus,
            single-instance focus, and a manual "Check for updates" link in the app menu.
          </p>
          <p className="mono text-[10px] uppercase tracking-[0.22em] text-[#5e6a91]">
            Included with every paid plan · Windows · macOS · Linux
          </p>

          {/* PAYWALL — non-paying visitors see an upgrade panel instead of
              installer links. The web app stays free at marvex.app/app; the
              native desktop binary is reserved for paying subscribers
              (Lite $9/mo, Pro $15/mo, Founder $200, Lifetime).  */}
          {!authLoading && !canDownload && (
            <div
              data-testid="download-paywall"
              className="mt-8 mx-auto max-w-2xl rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/[0.10] via-violet-500/[0.05] to-cyan-500/[0.05] p-6 text-left shadow-[0_0_60px_rgba(255,106,213,0.12)]"
            >
              <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/90 mb-3">
                <Lock size={11} />
                <span>Paid plan required</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                The desktop app is reserved for subscribers
              </h2>
              <p className="text-[14px] text-[#cfdaf3] leading-relaxed mb-5">
                The native installers (Windows · macOS · Linux) ship with every Marvex paid plan
                — including Lite at <strong className="text-cyan-200">$9/month</strong>.
                The web app at <Link to="/app" className="text-cyan-300 underline">marvex.app/app</Link> stays
                free forever.
              </p>
              <ul className="space-y-1.5 text-[13px] text-[#cfdaf3] mb-5 pl-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-cyan-300 shrink-0" /> Local-first — your maps live in your filesystem
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-cyan-300 shrink-0" /> Works offline (AI features need internet)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-cyan-300 shrink-0" /> Auto-updates · OS keyboard shortcuts · double-click .mmap
                </li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/pricing"
                  data-testid="download-paywall-cta"
                  className="cta-pill flex-1 justify-center text-[13px] py-3"
                >
                  <Sparkles size={13} /> See plans &amp; unlock desktop
                </Link>
                {!user && (
                  <button
                    onClick={signIn}
                    data-testid="download-paywall-signin"
                    className="mono text-[10px] uppercase tracking-[0.22em] flex-1 justify-center px-3 py-3 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-200 hover:text-white hover:border-cyan-300/60 transition flex items-center"
                  >
                    Already paid? Sign in
                  </button>
                )}
              </div>
              <div className="mt-4 mono text-[9px] uppercase tracking-[0.22em] text-[#566187] text-center">
                {user
                  ? `Signed in as ${user.email || "you"} — your plan: ${license.tier || "free"}`
                  : "Free to try the web app · sign in to redeem an existing plan"}
              </div>
            </div>
          )}

          {/* Live detection banner + one-click recommended download.
              Removes all decision-making for the 95%-case user.
              Only rendered for entitled (paid) users. */}
          {canDownload && REPO_CONFIGURED && os !== "unknown" && recommendedHref && (
            <div
              data-testid="download-detection-panel"
              className="mt-8 mx-auto max-w-2xl rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/[0.08] via-violet-500/[0.04] to-fuchsia-500/[0.05] p-6 text-left shadow-[0_0_60px_rgba(0,240,255,0.10)]"
            >
              <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 mb-3">
                <Cpu size={11} />
                <span>We detected your system</span>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 size={16} className="text-cyan-300" />
                <div className="text-[15px] text-white">
                  <strong>{osLabel}</strong>
                  <span className="text-[#9aa7c7]"> · {archLabel}</span>
                </div>
              </div>
              <a
                href={recommendedHref}
                data-testid="download-recommended-cta"
                className="cta-pill w-full justify-center text-[14px] py-3.5"
              >
                <DownloadIcon size={14} />
                Download for {osLabel} ({arch})
              </a>
              <div className="text-center mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-3">
                Not the right one? Scroll down to see every build.
              </div>
            </div>
          )}

          {canDownload && !REPO_CONFIGURED && (
            <div
              data-testid="download-coming-soon"
              className="mt-8 mx-auto max-w-xl rounded-xl border border-amber-400/30 bg-amber-400/[0.04] px-5 py-4 text-left"
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300 mb-1.5">
                Coming Very Soon
              </div>
              <p className="text-sm text-[#cfdaf3] leading-relaxed">
                Native installers for Windows, macOS, and Linux are being signed and
                notarised right now. Drop your email on the{" "}
                <Link to="/" className="text-cyan-300 underline">homepage waitlist</Link>{" "}
                — we'll send a one-line note the moment the first download goes live.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Downloads — only rendered for paid (entitled) users.
          Non-paying visitors see only the paywall hero above. */}
      {canDownload && (
      <section className="px-6 md:px-10 pb-20">
        <div className="max-w-4xl mx-auto space-y-5">
          {ordered.map((key) => {
            const Icon = ICONS[key];
            const isDetected = os === key;
            const steps = INSTALL_STEPS[key];
            return (
              <div
                key={key}
                data-testid={`download-os-${key}`}
                data-detected={isDetected ? "true" : "false"}
                className={`rounded-2xl border p-6 md:p-7 transition ${
                  isDetected
                    ? "border-cyan-400/50 bg-gradient-to-br from-cyan-500/[0.07] to-fuchsia-500/[0.04] shadow-[0_0_60px_rgba(0,240,255,0.08)]"
                    : "border-white/10 bg-white/[0.015]"
                }`}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                    isDetected
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                      : "border-white/10 bg-white/[0.02] text-[#9aa7c7]"
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold">{TITLES[key]}</div>
                    {isDetected && (
                      <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
                        Detected · {archLabel}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {BUILDS[key].map((b) => {
                    // Highlight the exact arch-matched installer. On non-detected
                    // OS cards, highlight the first installer (x64) by default so
                    // there's always a visual anchor.
                    const isRecommended = isDetected
                      ? (b.arch === arch && b.installer)
                      : (b.installer && b.arch === "x64");
                    return (
                      <a
                        key={b.href}
                        href={REPO_CONFIGURED ? b.href : undefined}
                        onClick={(e) => { if (!REPO_CONFIGURED) e.preventDefault(); }}
                        aria-disabled={!REPO_CONFIGURED}
                        data-testid={`download-link-${key}-${b.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        data-recommended={isRecommended ? "true" : "false"}
                        className={`group rounded-lg border p-3.5 transition flex flex-col relative ${
                          !REPO_CONFIGURED
                            ? "border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed"
                            : isRecommended
                              ? "border-cyan-400/50 bg-cyan-500/[0.08] hover:bg-cyan-500/[0.12]"
                              : "border-white/10 bg-white/[0.02] hover:border-cyan-400/30"
                        }`}
                      >
                        {isRecommended && isDetected && (
                          <span className="absolute -top-2 right-3 mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-full bg-cyan-500/30 text-cyan-100 border border-cyan-400/50">
                            Recommended
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <DownloadIcon size={12} className={isRecommended ? "text-cyan-300" : "text-[#9aa7c7]"} />
                          <span className={`text-[13px] font-medium ${isRecommended ? "text-white" : "text-[#cfdaf3]"}`}>
                            {b.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#7a87ad] mt-1">{b.sub}</div>
                      </a>
                    );
                  })}
                </div>

                {/* Per-OS heads-up about install warnings. Honest about the
                    fact that v1 ships unsigned on all desktops. */}
                {key === "windows" && (
                  <div
                    data-testid="download-windows-warning"
                    className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-3 flex items-start gap-2.5"
                  >
                    <ShieldAlert size={14} className="text-amber-300 mt-0.5 shrink-0" />
                    <div className="text-[12px] text-amber-100/90 leading-relaxed">
                      <strong className="text-amber-200">Heads up:</strong> Windows SmartScreen will likely show
                      <em> "Windows protected your PC"</em> the first time you run the installer. This is because
                      we ship unsigned in v1 (a code-signing cert costs $200-400/yr — we'll add it once we have
                      paying users). Click <strong>"More info" → "Run anyway"</strong> to install. The installer
                      is safe; the warning fades as more people download.
                    </div>
                  </div>
                )}
                {key === "mac" && (
                  <div
                    data-testid="download-mac-note"
                    className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-3 flex items-start gap-2.5"
                  >
                    <ShieldAlert size={14} className="text-amber-300 mt-0.5 shrink-0" />
                    <div className="text-[12px] text-amber-100/90 leading-relaxed">
                      <strong className="text-amber-200">Heads up:</strong> v0.1 is <strong>unsigned</strong> on
                      macOS (Apple signing arrives in v0.2). First launch shows "cannot be opened because the
                      developer cannot be verified". <strong>Right-click the app → Open → Open</strong>. macOS
                      remembers — every launch after that is silent.
                    </div>
                  </div>
                )}
                {key === "linux" && (
                  <div
                    data-testid="download-linux-note"
                    className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.04] p-3 flex items-start gap-2.5"
                  >
                    <ShieldAlert size={14} className="text-cyan-300 mt-0.5 shrink-0" />
                    <div className="text-[12px] text-cyan-100/90 leading-relaxed">
                      No warnings on Linux — but you may need <code className="bg-black/30 px-1 rounded">chmod +x</code>{" "}
                      on the AppImage before it runs. The <code className="bg-black/30 px-1 rounded">.deb</code> and{" "}
                      <code className="bg-black/30 px-1 rounded">.rpm</code> packages install cleanly via your
                      distro's package manager.
                    </div>
                  </div>
                )}

                {/* Step-by-step install guide — only expanded on the user's
                    detected OS so we don't drown them in instructions they
                    don't need. Accessible via <details> for keyboard / screen-
                    reader users. */}
                {steps && (
                  <details
                    data-testid={`download-install-steps-${key}`}
                    open={isDetected}
                    className="mt-4 group"
                  >
                    <summary className="cursor-pointer mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 flex items-center gap-2 py-1 list-none">
                      <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                      {steps.title}
                    </summary>
                    <ol className="mt-3 space-y-2 text-[12.5px] text-[#cfdaf3] leading-relaxed list-decimal list-inside">
                      {steps.steps.map((s, i) => (
                        <li key={i} data-testid={`download-install-step-${key}-${i}`}>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            );
          })}

          {/* Misc links */}
          <div className="pt-6 flex flex-wrap items-center gap-5 justify-center mono text-[11px] uppercase tracking-[0.22em] text-[#7a87ad]">
            <a
              href={RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-300 flex items-center gap-1.5"
              data-testid="download-all-releases"
            >
              <Github size={11} /> All releases <ExternalLink size={9} />
            </a>
            <span className="text-white/10">·</span>
            <Link to="/library" className="hover:text-cyan-300" data-testid="download-use-browser">
              Or use it in your browser
            </Link>
          </div>

          {/* System requirements */}
          <div className="pt-8 max-w-2xl mx-auto text-center text-[12px] text-[#566187] leading-relaxed">
            Requires Windows 10+, macOS 10.15+, or a modern 64-bit Linux. Installer size ≈ 85 MB.
            To update: open the app menu → "Check for updates…" — you control when new versions install.
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
