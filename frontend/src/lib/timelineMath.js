/**
 * Tick auto-scaling for the timeline canvas.
 *
 * Given the viewport's start/end date, returns an array of tick objects
 * { dateMs, label, major } with a sensible granularity for the current
 * zoom level.  Major ticks render with a full vertical line + bold
 * label; minor ticks render as a thin tick + faded label.
 *
 * The strategy is simple: pick the largest unit (year → quarter → month
 * → week → day → hour) whose ticks-per-viewport land in [4, 18].
 */

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30.4375 * MS_DAY; // average
const MS_YEAR = 365.25 * MS_DAY;

const fmtDate = (d, opts) =>
  new Intl.DateTimeFormat(undefined, opts).format(d);

const TICK_LADDER = [
  // [unit, approxMs, ticksPerViewportTarget, formatter, majorEvery]
  { unit: "century", ms: 100 * MS_YEAR, fmt: (d) => `${d.getFullYear()}s`, majorEvery: 1 },
  { unit: "decade", ms: 10 * MS_YEAR, fmt: (d) => `${Math.floor(d.getFullYear() / 10) * 10}s`, majorEvery: 5 },
  { unit: "year", ms: MS_YEAR, fmt: (d) => `${d.getFullYear()}`, majorEvery: 5 },
  { unit: "quarter", ms: 3 * MS_MONTH, fmt: (d) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`, majorEvery: 4 },
  { unit: "month", ms: MS_MONTH, fmt: (d) => fmtDate(d, { month: "short", year: "2-digit" }), majorEvery: 6 },
  { unit: "week", ms: MS_WEEK, fmt: (d) => fmtDate(d, { day: "2-digit", month: "short" }), majorEvery: 4 },
  { unit: "day", ms: MS_DAY, fmt: (d) => fmtDate(d, { day: "2-digit", month: "short" }), majorEvery: 7 },
  { unit: "hour", ms: MS_HOUR, fmt: (d) => fmtDate(d, { hour: "2-digit", minute: "2-digit" }), majorEvery: 6 },
];

const snapToUnitStart = (date, unit) => {
  const d = new Date(date);
  switch (unit) {
    case "century":
      d.setFullYear(Math.floor(d.getFullYear() / 100) * 100, 0, 1);
      d.setHours(0, 0, 0, 0);
      break;
    case "decade":
      d.setFullYear(Math.floor(d.getFullYear() / 10) * 10, 0, 1);
      d.setHours(0, 0, 0, 0);
      break;
    case "year":
      d.setMonth(0, 1); d.setHours(0, 0, 0, 0); break;
    case "quarter":
      d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); d.setHours(0, 0, 0, 0); break;
    case "month":
      d.setDate(1); d.setHours(0, 0, 0, 0); break;
    case "week": {
      // ISO week — Monday as start
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case "day":
      d.setHours(0, 0, 0, 0); break;
    case "hour":
      d.setMinutes(0, 0, 0); break;
    default:
      break;
  }
  return d;
};

const stepUnit = (date, unit) => {
  const d = new Date(date);
  switch (unit) {
    case "century": d.setFullYear(d.getFullYear() + 100); break;
    case "decade":  d.setFullYear(d.getFullYear() + 10); break;
    case "year":    d.setFullYear(d.getFullYear() + 1); break;
    case "quarter": d.setMonth(d.getMonth() + 3); break;
    case "month":   d.setMonth(d.getMonth() + 1); break;
    case "week":    d.setDate(d.getDate() + 7); break;
    case "day":     d.setDate(d.getDate() + 1); break;
    case "hour":    d.setHours(d.getHours() + 1); break;
    default: break;
  }
  return d;
};

/**
 * Compute the optimal tick set for a viewport spanning [startMs, endMs].
 * Targets ~6-12 visible ticks; majors are spaced sparser so labels stay
 * legible even at very zoomed-out levels.
 */
export function computeTicks(startMs, endMs, viewportPx = 1600) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const span = endMs - startMs;
  // Target ~6-12 visible ticks at the given viewport width.
  const target = Math.max(6, Math.min(20, Math.floor(viewportPx / 130)));
  // Walk LARGEST-to-smallest. Pick the first unit where the span yields
  // at least `target/2` ticks — that's the coarsest sensible granularity
  // for the current zoom. Falls through to the finest (hour) if nothing
  // matches (extreme zoom-in).
  let chosen = TICK_LADDER[TICK_LADDER.length - 1];
  for (const t of TICK_LADDER) {
    const n = span / t.ms;
    if (n >= target / 2) {
      chosen = t;
      break;
    }
  }
  const ticks = [];
  let cursor = snapToUnitStart(new Date(startMs), chosen.unit);
  const safetyLimit = 500;
  let i = 0;
  while (cursor.getTime() <= endMs && ticks.length < safetyLimit) {
    if (cursor.getTime() >= startMs) {
      const yr = cursor.getFullYear();
      const mo = cursor.getMonth();
      const day = cursor.getDate();
      const hr = cursor.getHours();
      let major = false;
      if (chosen.unit === "year") major = yr % chosen.majorEvery === 0;
      else if (chosen.unit === "decade") major = (yr / 10) % chosen.majorEvery === 0;
      else if (chosen.unit === "century") major = true;
      else if (chosen.unit === "quarter") major = mo % 12 === 0;
      else if (chosen.unit === "month") major = mo % chosen.majorEvery === 0;
      else if (chosen.unit === "week") major = i % chosen.majorEvery === 0;
      else if (chosen.unit === "day") major = day === 1 || i % chosen.majorEvery === 0;
      else if (chosen.unit === "hour") major = hr % chosen.majorEvery === 0;
      ticks.push({
        dateMs: cursor.getTime(),
        label: chosen.fmt(cursor),
        major,
      });
    }
    cursor = stepUnit(cursor, chosen.unit);
    i++;
  }
  return ticks;
}

/**
 * Stack events that share (or nearly share) a date so cubes don't
 * overlap.  Mutates the events array in-place by setting a `lane`
 * field — 0 means "on the axis", 1, 2, 3 means stacked outward.
 *
 * Events with `position: 'below'` are stacked downward, `'above'` are
 * stacked upward.  Two events count as colliding if they fall within
 * `collideMs` of each other.
 */
export function assignLanes(events, collideMs = MS_DAY) {
  if (!Array.isArray(events) || events.length === 0) return events;
  const sorted = [...events].sort((a, b) => {
    const ad = new Date(a.dateISO).getTime();
    const bd = new Date(b.dateISO).getTime();
    return ad - bd;
  });
  const lanesAbove = []; // [lastDateMs] per lane index
  const lanesBelow = [];
  for (const e of sorted) {
    const ms = new Date(e.dateISO).getTime();
    const stack = e.position === "above" ? lanesAbove : lanesBelow;
    let lane = 0;
    while (lane < stack.length && stack[lane] !== undefined && (ms - stack[lane]) < collideMs) {
      lane++;
    }
    stack[lane] = ms;
    e.lane = lane;
  }
  return events;
}

export const MS = { MS_HOUR, MS_DAY, MS_WEEK, MS_MONTH, MS_YEAR };
