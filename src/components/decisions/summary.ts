// Slim, list-friendly view of a decision. Built on the server so the list page doesn't ship whole workspaces.
import type { DecisionRecord, DecisionStatus } from "@/lib/types";

export type DecisionSummary = {
  id: string;
  title: string;
  status: DecisionStatus;
  updatedAt: string;
  suppliers: string[];
  bestOption: string | null;
  savingsAfterTax: number | null;
};

export function summarizeDecision(d: DecisionRecord): DecisionSummary {
  const suppliers = [...new Set(d.offers.map((o) => o.supplierName).filter(Boolean))];
  const best = d.decision
    ? (d.decision.rows.find((r) => r.recommended) ?? d.decision.rows.find((r) => r.id === d.decision?.recommendedId))
    : undefined;
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    updatedAt: d.updatedAt,
    suppliers,
    bestOption: best?.label ?? null,
    savingsAfterTax: d.decision?.savingsVsBaseline?.afterTax ?? null,
  };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

// "3 hours ago", "yesterday", "just now".
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), "minute");
}
