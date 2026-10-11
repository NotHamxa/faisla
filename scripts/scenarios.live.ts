// Runs the real finance engine on decision combinations for judge prep (no AI, no network).
import fs from "node:fs";
import { test } from "vitest";
import { decide } from "@/lib/finance";
import { demoCompany, demoFinancing, demoOfferA, demoOfferB } from "@/lib/demoData";
import type { DecideInput } from "@/lib/types";

const base: DecideInput = { company: demoCompany, offers: [demoOfferA, demoOfferB], financing: demoFinancing };
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const scenarios: [string, DecideInput][] = [
  ["Base demo (exporter, Shariah-only)", base],
  ["Not an exporter", { ...base, company: { ...demoCompany, isExporter: false } }],
  ["Preference: Islamic + conventional", { ...base, company: { ...demoCompany, financingPreference: "both" } }],
  ["Pay in full ON, cash 1 crore", { ...base, company: { ...demoCompany, payInFullWhenAffordable: true } }],
  ["Pay in full ON, cash 2 crore", { ...base, company: { ...demoCompany, payInFullWhenAffordable: true, cashBalance: 2_00_00_000 } }],
  ["Pay in full OFF, cash 2 crore", { ...base, company: { ...demoCompany, cashBalance: 2_00_00_000 } }],
  ["Cash only 50 lakh", { ...base, company: { ...demoCompany, cashBalance: 50_00_000 } }],
  ["First installment due on delivery", { ...base, offers: [{ ...demoOfferA, firstInstallmentOnDelivery: true }, demoOfferB] }],
  ["Discount rate 8%", { ...base, company: { ...demoCompany, discountRate: 0.08 } }],
  ["Discount rate 20%", { ...base, company: { ...demoCompany, discountRate: 0.2 } }],
  ["Tax rate 0%", { ...base, company: { ...demoCompany, taxRate: 0 } }],
  ["KIBOR +2%", { ...base, kiborShift: 0.02 }],
  ["KIBOR +4%", { ...base, kiborShift: 0.04 }],
  ["Processing fee 2% on financing", { ...base, financing: demoFinancing.map((f) => ({ ...f, feePct: 0.02 })) }],
  ["Only Supplier A's quote (no B)", { ...base, offers: [demoOfferA] }],
  ["Only Supplier A, not exporter", { ...base, offers: [demoOfferA], company: { ...demoCompany, isExporter: false } }],
];
const out: string[] = [];
test("scenarios", () => {
  for (const [name, input] of scenarios) {
    const r = decide(input);
    const rec = r.rows.find((x) => x.recommended)!;
    out.push(`### ${name}`);
    out.push(`Recommended: ${rec.label} | true cost after tax ${fmt(rec.pvAfterTax)} | cash left ${rec.runwayMonths.toFixed(2)} | savings vs quote ${r.savingsVsBaseline ? fmt(r.savingsVsBaseline.beforeTax) + " / " + fmt(r.savingsVsBaseline.afterTax) : "n/a"} | break-even ${r.breakEvenDiscountRate == null ? "n/a" : (r.breakEvenDiscountRate * 100).toFixed(2) + "%"}`);
    for (const row of r.rows) out.push(`  - ${row.label}: pay ${fmt(row.upfront)}${row.months ? ` + ${row.months}×${fmt(row.monthlyPayment)}` : ""} | PV pre ${fmt(row.pvBeforeTax)} | PV after ${fmt(row.pvAfterTax)} | cash ${row.runwayMonths.toFixed(2)} | ${row.verdict}${row.hiddenYearlyRate ? ` | hidden ${(row.hiddenYearlyRate * 100).toFixed(2)}%` : ""}`);
  }
  fs.writeFileSync("scripts/bench-results.txt", out.join("\n") + "\n");
});
