// Memo number check: every number in the AI-written memo must come from the calculation.
// Pure code, no AI. Tokens are compared after normalisation ("Rs 49,87,935" → "4987935", "16.9%" → "16.9").

export type NumberToken = { raw: string; normalized: string; hasRs: boolean; isPct: boolean };

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const QUOTE_OPEN = `["“'‘]`;
const QUOTE_CLOSE = `["”'’]`;

// Harmless text removed before tokenising.
const IGNORE_PATTERNS: RegExp[] = [
  // dates: "11 Oct 2026", "11 October 2026", "Oct 11, 2026"
  new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\.?,?\\s+\\d{4}\\b`, "gi"),
  new RegExp(`\\b(?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b`, "gi"),
  // the supplier's "0%" claim, only when quoted: "0%", "0% markup", '0 % interest'
  new RegExp(`${QUOTE_OPEN}\\s*0(?:\\.0+)?\\s*%[^"“”'‘’\\n]{0,24}${QUOTE_CLOSE}`, "g"),
];

// List markers at line starts ("1. ", "## 2) "), keeping the prefix so the line stays readable.
const LIST_MARKER = /^(\s*(?:#{1,6}\s+)?(?:[-*+]\s+)?)\d{1,2}[.)](?=\s)/gm;

// A number not glued to letters/digits (so "F5-7" or "A1" are not numbers), optional Rs/PKR, optional %.
const NUMBER_TOKEN = /(?:(?<!\w)(Rs|PKR)\.?\s*|(?<!\w))(\d[\d,]*(?:\.\d+)?)(\s?%)?(?!\w)/gi;

const IGNORED_YEARS = new Set(["2025", "2026", "2027"]);

// "49,87,935" → "4987935"; "2.50" → "2.5"; "007" → "7".
export function normalizeNumber(digits: string): string {
  let s = digits.replace(/,/g, "");
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  s = s.replace(/^0+(?=\d)/, "");
  return s;
}

export function extractNumbers(text: string): NumberToken[] {
  let cleaned = text.replace(LIST_MARKER, "$1");
  for (const pattern of IGNORE_PATTERNS) cleaned = cleaned.replace(pattern, " ");

  const tokens: NumberToken[] = [];
  for (const match of cleaned.matchAll(NUMBER_TOKEN)) {
    const digits = match[2].replace(/,+$/, "");
    const hasRs = Boolean(match[1]);
    const isPct = Boolean(match[3]);
    if (!hasRs && !isPct && IGNORED_YEARS.has(digits)) continue;
    tokens.push({ raw: match[0].trim().replace(/,+$/, ""), normalized: normalizeNumber(digits), hasRs, isPct });
  }
  return tokens;
}

export function checkMemoNumbers(
  memo: string,
  allowed: Set<string>,
): { passed: boolean; unknownNumbers: string[] } {
  const unknown = new Set<string>();
  for (const token of extractNumbers(memo)) {
    if (!allowed.has(token.normalized)) unknown.add(token.raw);
  }
  return { passed: unknown.size === 0, unknownNumbers: [...unknown] };
}
