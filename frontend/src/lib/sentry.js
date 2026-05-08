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
      // Throw away noise that's not actionable.
      if (
        /AbortError|NetworkError|Failed to fetch|Load failed|ChunkLoadError/i.test(msg)
      ) return null;
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
