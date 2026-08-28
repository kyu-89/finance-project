// Server-safe date helpers anchored to Asia/Seoul (KST, UTC+9), not the host process's local
// timezone. Vercel runs Node with TZ=UTC while every user is in KST, so any code that derives
// "today" or "this month" from `new Date()` local getters is wrong for 9 hours a day. Always go
// through these instead of `new Date().toISOString().slice(0, 10)` or `now.getMonth()`.

// `en-CA` is the one Intl locale whose date format is already YYYY-MM-DD, so no manual
// zero-padding/reassembly is needed.
const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Pure, injectable core so callers (and tests) can pin the instant being formatted instead of
// depending on the ambient clock — see formatDateInSeoul below for why this is exported.
export function formatDateInSeoul(date: Date): string {
  return SEOUL_DATE_FORMATTER.format(date);
}

export function todayInSeoul(): string {
  return formatDateInSeoul(new Date());
}

// Pure core for currentMonthRangeInSeoul: takes the "YYYY-MM-DD in Seoul" string directly
// (rather than a Date + timezone) so the last-day-of-month arithmetic stays entirely
// TZ-independent — Date.UTC(year, month, 0) gives the previous month's last day without ever
// touching the host's local timezone.
export function monthRangeFromSeoulDateString(seoulDateString: string): {
  fromDate: string;
  toDate: string;
} {
  const year = Number(seoulDateString.slice(0, 4));
  const month = Number(seoulDateString.slice(5, 7)); // 1-12

  const fromDate = `${seoulDateString.slice(0, 7)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const toDate = `${seoulDateString.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;

  return { fromDate, toDate };
}

export function currentMonthRangeInSeoul(): { fromDate: string; toDate: string } {
  return monthRangeFromSeoulDateString(todayInSeoul());
}
