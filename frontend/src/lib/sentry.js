/**
 * Frontend Sentry bootstrap.
 *
 * Quiet no-op when REACT_APP_SENTRY_DSN is not set — local dev never
 * pays the SDK's overhead and no events leak to a live project.
 *
 * Production:
 *   * Browser tracing for route-change perf (~10% sampled).
 *   * Session Replay on errors (full capture for any error session,
 *     1% of healthy sessions for diversity).
 *   * Filters out network errors that the user can't action (offline,
 *     ad-block, abort-signal cancellations) — these flood the
 *     dashboard otherwise.
 *
 * Required env (frontend/.env):
 *   REACT_APP_SENTRY_DSN       Sentry → Settings → Client Keys
 *   REACT_APP_SENTRY_ENV       optional, defaults to NODE_ENV
 *   REACT_APP_VERSION          optional release tag
 */
import * as Sentry from "@sentry/react";

const DSN = process.env.REACT_APP_SENTRY_DSN || "";
let _enabled = false;

export function initSentry() {
  if (!DSN) return false;
  if (_enabled) return true;

  Sentry.init({
    dsn: DSN,
    environment: process.env.REACT_APP_SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.REACT_APP_VERSION || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
    beforeSend: (event, hint) => {
      const err = hint?.originalException;
      const msg = (err && (err.message || String(err))) || "";
      // ---- 1. Throw away noise that's not actionable ----
      if (
        /AbortError|NetworkError|Failed to fetch|Load failed|ChunkLoadError/i.test(msg)
      ) return null;
      // ---- 2. Browser-extension DOM mutation crashes ----
      // `NotFoundError: Failed to execute 'removeChild' / 'insertBefore'
      // on 'Node': The node to be removed/inserted is not a child of
      // this node.`  This is the classic React vs Google Translate /
      // Grammarly / Edge Translate / LastPass conflict — the extension
      // swaps text nodes inside the React tree and React then can't
      // reconcile the DOM.  Not a bug in our code, not actionable.
      // Studio/Timeline/PdfReader already opt out via translate="no";
      // any remaining occurrence is from a different extension we
      // can't control. Drop it.
      if (
        /NotFoundError.*removeChild.*not a child|NotFoundError.*insertBefore.*not a child/i.test(msg)
      ) return null;
      // ---- 3. ResizeObserver loop spam ----
      // Chrome emits "ResizeObserver loop limit exceeded" / "...loop
      // completed with undelivered notifications" for benign layout
      // thrash. The W3C even acknowledges this is harmless. Silence.
      if (/ResizeObserver loop/i.test(msg)) return null;
      // ---- 4. Only report from production-like environments ----
      // Dev / preview events pollute the dashboard and lead us to
      // chase bugs that only affect engineers, not paying users.
      // (`environment` is set at init() from REACT_APP_SENTRY_ENV.)
      if (event.environment && /^(local|development|preview)$/i.test(event.environment)) {
        return null;
      }
      return event;
    },
  });
  _enabled = true;
  return true;
}

export const isSentryEnabled = () => _enabled;

/** Manual capture wrapper safe to call when Sentry isn't configured. */
export function captureBugReport({ subject, description, email, source = "web", extra = {} }) {
  if (!_enabled) return null;
  Sentry.captureMessage(`Bug report: ${subject}`, {
    level: "warning",
    tags: { source, kind: "user_bug_report" },
    contexts: {
      report: { description, email, ...extra },
    },
  });
  return Sentry.lastEventId?.() || null;
}

export { Sentry };
