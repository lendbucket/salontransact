// ---------------------------------------------------------------------------
// Billing Period Helpers — lib/subscriptions/billing-period.ts
//
// Pure functions for computing billing dates. No DB, no async, no
// side effects.
//
// Used by:
//   - POST /api/subscriptions (compute initial period + nextBillingDate)
//   - PATCH /api/subscriptions/[id] (recompute nextBillingDate on resume)
//   - Phase 2 billing-engine-tick cron (advance period after charge)
//
// Design doc: docs/subscriptions-platform-design.md Section 4
// (anchor day semantics) and Section 6 (billing engine).
// ---------------------------------------------------------------------------

/**
 * Compute the next billing date for a subscription.
 *
 * MONTHLY: next occurrence of anchorDay (1-28) that is strictly after
 *   fromDate. If anchorDay is today, advance to next interval (today's
 *   charge already fired or is about to).
 *
 * WEEKLY: next occurrence of anchorDay (0=Sun, 6=Sat) strictly after
 *   fromDate. Same "today means next" rule.
 *
 * ANNUAL: anchorDay is day-of-year (1-365). Convert to month+day,
 *   find next future occurrence. NOTE: ANNUAL semantics may be refined
 *   in future versions (leap year handling, day > 365).
 */
export function computeNextBillingDate(
  interval: "WEEKLY" | "MONTHLY" | "ANNUAL",
  intervalCount: number,
  anchorDay: number,
  fromDate: Date
): Date {
  if (interval === "MONTHLY") {
    return computeNextMonthly(anchorDay, intervalCount, fromDate);
  }
  if (interval === "WEEKLY") {
    return computeNextWeekly(anchorDay, intervalCount, fromDate);
  }
  // ANNUAL
  return computeNextAnnual(anchorDay, intervalCount, fromDate);
}

/**
 * Compute the end of a billing period given its start date.
 *
 * MONTHLY: periodStart + intervalCount months (same day-of-month,
 *   capped at 28 by anchorDay constraint).
 * WEEKLY: periodStart + (intervalCount * 7) days.
 * ANNUAL: periodStart + intervalCount years.
 */
export function computePeriodEnd(
  periodStart: Date,
  interval: "WEEKLY" | "MONTHLY" | "ANNUAL",
  intervalCount: number
): Date {
  const end = new Date(periodStart);

  if (interval === "MONTHLY") {
    end.setUTCMonth(end.getUTCMonth() + intervalCount);
    return end;
  }
  if (interval === "WEEKLY") {
    end.setUTCDate(end.getUTCDate() + intervalCount * 7);
    return end;
  }
  // ANNUAL
  end.setUTCFullYear(end.getUTCFullYear() + intervalCount);
  return end;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeNextMonthly(
  anchorDay: number,
  intervalCount: number,
  fromDate: Date
): Date {
  let year = fromDate.getUTCFullYear();
  let month = fromDate.getUTCMonth(); // 0-indexed

  // Build a candidate date in the current month
  const candidate = new Date(Date.UTC(year, month, anchorDay));

  if (candidate <= fromDate) {
    // anchorDay already passed this month (or is today) — advance
    month += intervalCount;
    // Handle year rollover
    year += Math.floor(month / 12);
    month = month % 12;
  }

  return new Date(Date.UTC(year, month, anchorDay));
}

function computeNextWeekly(
  anchorDay: number, // 0=Sun, 6=Sat
  intervalCount: number,
  fromDate: Date
): Date {
  const currentDay = fromDate.getUTCDay(); // 0=Sun
  let daysUntil = anchorDay - currentDay;

  if (daysUntil <= 0) {
    // anchorDay is today or already passed this week — advance
    daysUntil += 7 * intervalCount;
  }

  const next = new Date(fromDate);
  next.setUTCDate(next.getUTCDate() + daysUntil);
  // Zero out time to get start of day
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function computeNextAnnual(
  anchorDay: number, // 1-365 day-of-year
  intervalCount: number,
  fromDate: Date
): Date {
  let year = fromDate.getUTCFullYear();

  // Convert day-of-year to a Date
  const candidate = dayOfYearToDate(anchorDay, year);

  if (candidate <= fromDate) {
    // Already passed this year — advance
    year += intervalCount;
  }

  return dayOfYearToDate(anchorDay, year);
}

function dayOfYearToDate(dayOfYear: number, year: number): Date {
  // Jan 1 = day 1. Create Jan 0 (= Dec 31 of prev year) then add days.
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(dayOfYear); // handles month rollover correctly
  return date;
}
