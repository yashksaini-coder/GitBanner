import type { DateWindow } from './types.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Build the date range a card is scoped to. Both bounds are inclusive whole
 * UTC days, so `--since 2026-08-03 --until 2026-08-09` covers all of the 9th.
 * Returns null when neither bound is given (an all-time card).
 */
export function buildWindow(since?: string, until?: string): DateWindow | null {
  if (!since && !until) return null;

  const from = since ? startOfDay(parse(since, '--since')) : new Date(0);
  const to = until ? endOfDay(parse(until, '--until')) : new Date();

  if (from.getTime() > to.getTime()) {
    throw new Error(`--since (${from.toISOString()}) is after --until (${to.toISOString()})`);
  }
  // contributionsCollection rejects a window longer than one year.
  const YEAR_MS = 366 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > YEAR_MS) {
    throw new Error('Date range must be one year or less (GitHub caps contribution windows at a year).');
  }

  return { since: from.toISOString(), until: to.toISOString(), label: label(from, to) };
}

function parse(value: string, flag: string): Date {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${flag} is not a valid date: ${value} (expected YYYY-MM-DD)`);
  }
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
}

/** "3–9 Aug 2026", or "28 Jul – 3 Aug 2026" when the range spans months. */
function label(from: Date, to: Date): string {
  const d1 = from.getUTCDate();
  const d2 = to.getUTCDate();
  const m1 = MONTHS[from.getUTCMonth()];
  const m2 = MONTHS[to.getUTCMonth()];
  const y1 = from.getUTCFullYear();
  const y2 = to.getUTCFullYear();

  if (y1 !== y2) return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
  if (m1 !== m2) return `${d1} ${m1} – ${d2} ${m2} ${y2}`;
  if (d1 === d2) return `${d1} ${m1} ${y2}`;
  return `${d1}–${d2} ${m1} ${y2}`;
}
