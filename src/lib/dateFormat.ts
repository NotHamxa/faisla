// Date display with a fixed locale and time zone, so server-rendered and hydrated text always match.
const TIME_ZONE = "Asia/Karachi";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });

const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" });

function valid(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "11 Oct 2026, 11:25"
export function formatDateTime(iso: string | null | undefined): string {
  const d = valid(iso);
  return d ? dateTime.format(d) : "—";
}

// "11 Oct 2026"
export function formatDate(iso: string | null | undefined): string {
  const d = valid(iso);
  return d ? dateOnly.format(d) : "—";
}

// "11 Oct"
export function formatShortDate(iso: string | null | undefined): string {
  const d = valid(iso);
  return d ? shortDate.format(d) : "—";
}
