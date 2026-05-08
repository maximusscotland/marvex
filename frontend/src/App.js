import "@/App.css";
import "@/i18n";
import { useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Studio from "@/pages/Studio";
import FlowchartStudio from "@/pages/FlowchartStudio";
import IntakeStudio from "@/pages/IntakeStudio";
import Library from "@/pages/Library";
import Output from "@/pages/Output";
import Calendar from "@/pages/Calendar";
import PdfReader from "@/pages/PdfReader";
import Tools from "@/pages/Tools";
import Highlights from "@/pages/Highlights";
import Memory from "@/pages/Memory";
import SharedMap from "@/pages/SharedMap";
import AuthCallback from "@/pages/AuthCallback";
import Download from "@/pages/Download";
import Pricing from "@/pages/Pricing";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Learn from "@/pages/Learn";
import LearnTutorial from "@/pages/LearnTutorial";
import LearnArticle from "@/pages/LearnArticle";
import { useParams } from "react-router-dom";
import { getTutorial } from "@/lib/tutorials";

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
import AdminTestimonials from "@/pages/AdminTestimonials";
import AdminAffiliates from "@/pages/AdminAffiliates";
import AdminFamily from "@/pages/AdminFamily";
import AdminReviewers from "@/pages/AdminReviewers";
import Redeem from "@/pages/Redeem";
import Press from "@/pages/Press";
import PdfToMindMap from "@/pages/PdfToMindMap";
import FeedbackForm from "@/pages/FeedbackForm";
import Affiliate from "@/pages/Affiliate";
import AffiliateResources from "@/pages/AffiliateResources";
import VsPage from "@/pages/VsPage";
import AdminOps from "@/pages/AdminOps";
import Galaxy from "@/pages/Galaxy";
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
          <CookieConsent />
          <OfflineBanner />
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
        </Routes>
        <Toaster theme="dark" position="bottom-center" />
        </MaintenanceMode>
      </AuthProvider>
    </Router>
  );
}
