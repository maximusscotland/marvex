import "@/App.css";
import "@/i18n";
import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { getTutorial } from "@/lib/tutorials";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Learn from "@/pages/Learn";
import Press from "@/pages/Press";
import Redeem from "@/pages/Redeem";
import PdfToMindMap from "@/pages/PdfToMindMap";
import VsPage from "@/pages/VsPage";
import AuthCallback from "@/pages/AuthCallback";

// Heavy / authenticated routes are code-split — the visitor only downloads
// these chunks if they actually navigate there. Cuts the landing-page JS
// bundle by ~60% (Studio + PdfReader + Highlights pull in the SVG canvas,
// pdf.js, react-rnd, and several Radix widgets that nobody on /pdf-to-
// mind-map ever needs).
const Studio              = lazy(() => import("@/pages/Studio"));
const FlowchartStudio     = lazy(() => import("@/pages/FlowchartStudio"));
const IntakeStudio        = lazy(() => import("@/pages/IntakeStudio"));
const Library             = lazy(() => import("@/pages/Library"));
const Output              = lazy(() => import("@/pages/Output"));
const Calendar            = lazy(() => import("@/pages/Calendar"));
const PdfReader           = lazy(() => import("@/pages/PdfReader"));
const Tools               = lazy(() => import("@/pages/Tools"));
const Highlights          = lazy(() => import("@/pages/Highlights"));
const Memory              = lazy(() => import("@/pages/Memory"));
const SharedMap           = lazy(() => import("@/pages/SharedMap"));
const Download            = lazy(() => import("@/pages/Download"));
const LearnTutorial       = lazy(() => import("@/pages/LearnTutorial"));
const LearnArticle        = lazy(() => import("@/pages/LearnArticle"));
const AdminTestimonials   = lazy(() => import("@/pages/AdminTestimonials"));
const AdminAffiliates     = lazy(() => import("@/pages/AdminAffiliates"));
const AdminFamily         = lazy(() => import("@/pages/AdminFamily"));
const AdminReviewers      = lazy(() => import("@/pages/AdminReviewers"));
const AdminOps            = lazy(() => import("@/pages/AdminOps"));
const FeedbackForm        = lazy(() => import("@/pages/FeedbackForm"));
const Affiliate           = lazy(() => import("@/pages/Affiliate"));
const AffiliateResources  = lazy(() => import("@/pages/AffiliateResources"));
const Galaxy              = lazy(() => import("@/pages/Galaxy"));
const ReportBug           = lazy(() => import("@/pages/ReportBug"));
const Faq                 = lazy(() => import("@/pages/Faq"));
const Contact             = lazy(() => import("@/pages/Contact"));
const AuthMagic           = lazy(() => import("@/pages/AuthMagic"));
const SignIn              = lazy(() => import("@/pages/SignIn"));

/**
 * /learn/:slug router — try tutorial first, fall back to long-form
 * SEO article. Both live under the same URL prefix because Google
 * rewards a single coherent /learn/ topic-cluster more than two
 * disjoint sub-prefixes.
 */
function LearnSlugRouter() {
  const { slug } = useParams();
  return getTutorial(slug) ? <LearnTutorial /> : <LearnArticle />;
}

import AccessGate from "@/components/AccessGate";
import MaintenanceMode from "@/components/MaintenanceMode";
import OfflineBanner from "@/components/OfflineBanner";
import NavShortcuts from "@/components/NavShortcuts";
import AnalyticsRouterListener from "@/components/AnalyticsRouterListener";
import ReferralCapture from "@/components/ReferralCapture";
import CookieConsent from "@/components/CookieConsent";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

// Lightweight loading shell shown for ~50-200ms while a code-split
// chunk loads. Matches the cosmic background so the swap is invisible.
const RouteFallback = () => (
  <div className="min-h-screen cosmic-bg" data-testid="route-loading" />
);

// BrowserRouter relies on the HTML5 history API, which is broken when the
// Electron wrapper loads this bundle from file:// (the offline fallback).
// We quietly swap in HashRouter for that case so every route still works.
const Router =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? HashRouter
    : BrowserRouter;

export default function App() {
  // Re-apply Film Mode body class on every mount so the Emergent badge,
  // cookie banner, and onboarding tour stay hidden across page reloads /
  // route changes once the user has flipped the toggle in Studio.
  useEffect(() => {
    try {
      if (localStorage.getItem("mm.filmMode") === "1") {
        document.body.classList.add("film-mode");
        // Emergent badge has inline `display: inline-flex !important`, so
        // CSS can't hide it. Flip its inline display imperatively.
        const badge = document.getElementById("emergent-badge");
        if (badge) badge.style.setProperty("display", "none", "important");
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <Router>
      <AuthProvider>
        <MaintenanceMode>
          <AnalyticsRouterListener />
          <ReferralCapture />
          <NavShortcuts />
          <ScrollToTop />
          <CookieConsent />
          <OfflineBanner />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* PUBLIC marketing & legal — fully open so the URL is shareable */}
          <Route path="/" element={<Landing />} />
          {/* External referrals occasionally land on /landing (the route name
              we use in marketing copy / docs).  Redirect to / so the FAQ
              anchor + nav still work instead of falling through to the
              Studio shell. */}
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:slug" element={<LearnSlugRouter />} />
          <Route path="/share/:slug" element={<SharedMap />} />
          <Route path="/download" element={<Download />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/galaxy" element={<Galaxy />} />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/affiliate/resources" element={<AffiliateResources />} />
          <Route path="/vs/:slug" element={<VsPage />} />
          <Route path="/admin/ops" element={<AccessGate><AdminOps /></AccessGate>} />
          <Route path="/redeem" element={<Redeem />} />
          <Route path="/press" element={<Press />} />
          <Route path="/pdf-to-mind-map" element={<PdfToMindMap />} />
          <Route path="/report-bug" element={<ReportBug />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth/magic" element={<AuthMagic />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* GATED app surface — Studio, Library, Reader, etc. require either
              the access key (?unlock=…) or being on the waitlist allow-list.
              Until launch day, only access-key holders get through. */}
          <Route path="/app" element={<AccessGate><Studio /></AccessGate>} />
          <Route path="/flowchart" element={<AccessGate><FlowchartStudio /></AccessGate>} />
          <Route path="/intake" element={<AccessGate><IntakeStudio /></AccessGate>} />
          <Route path="/library" element={<AccessGate><Library /></AccessGate>} />
          <Route path="/output" element={<AccessGate><Output /></AccessGate>} />
          <Route path="/calendar" element={<AccessGate><Calendar /></AccessGate>} />
          <Route path="/read" element={<AccessGate><PdfReader /></AccessGate>} />
          <Route path="/highlights" element={<AccessGate><Highlights /></AccessGate>} />
          <Route path="/memory" element={<AccessGate><Memory /></AccessGate>} />
          <Route path="/feedback" element={<AccessGate><FeedbackForm /></AccessGate>} />

          {/* Admin — keyholder-only. (Same gate for now; can add a separate
              admin password later if the team grows.) */}
          <Route path="/admin/testimonials" element={<AccessGate><AdminTestimonials /></AccessGate>} />
          <Route path="/admin/affiliates" element={<AccessGate><AdminAffiliates /></AccessGate>} />
          <Route path="/admin/family" element={<AccessGate><AdminFamily /></AccessGate>} />
          <Route path="/admin/reviewers" element={<AccessGate><AdminReviewers /></AccessGate>} />

          {/* Aliases for shareable / inbound-link slugs that pre-date the
              /learn/ prefix. Cheap redirects so an inbound /ai-mind-map…
              link from a blog or social post doesn't render a blank screen. */}
          <Route path="/ai-mind-map-generator-explained" element={<Navigate to="/learn/ai-mind-map-generator-explained" replace />} />

          {/* Catch-all — unknown URLs fall back to the landing page rather
              than rendering nothing. Better for inbound traffic from typo'd
              backlinks, social shares, etc. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <Toaster theme="dark" position="bottom-center" />
        </MaintenanceMode>
      </AuthProvider>
    </Router>
  );
}
