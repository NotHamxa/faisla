// Display formatting shared by the UI, the memo prompt and the memo number check.
// Keep every on-screen number going through these so the number check sees the same strings.

// South Asian digit grouping: 5567038 → "55,67,038".
export function groupPKR(value: number): string {
  const n = Math.round(Math.abs(value));
  const s = String(n);
  if (s.length <= 3) return (value < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (value < 0 ? "-" : "") + rest + "," + last3;
}

export function formatPKR(value: number): string {
  return "Rs " + groupPKR(value);
}

// 5_79_103 → "5.8 lakh"; 1_00_00_000 → "1 crore".
export function formatLakh(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${trim((value / 1_00_00_000).toFixed(digits))} crore`;
  return `${trim((value / 1_00_000).toFixed(digits))} lakh`;
}

// 0.1686 → "16.9%"
export function formatPct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatMonths(months: number): string {
  return `${months.toFixed(2)} months`;
}

function trim(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
