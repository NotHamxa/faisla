"use client";
// M5: compare every way to pay. Runs lib/finance.ts in the browser (pure, instant) and saves the result to the store.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { decide } from "@/lib/finance";
import { formatLakh, formatPKR, formatPct, groupPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { ComparisonRow, DecideResult } from "@/lib/types";

const SHIFT_STEPS = Array.from({ length: 9 }, (_, i) => i * 0.005); // 0 → +4% in 0.5% steps

function payText(r: ComparisonRow): string {
  if (r.method === "cash") return `${groupPKR(r.upfront)} now`;
  if (r.method === "installments") {
    return `${r.months} × ${groupPKR(r.monthlyPayment)}${r.upfront > 0 ? " (1st on delivery)" : ""}`;
  }
  return `${groupPKR(r.upfront)} + ${r.months} × ${groupPKR(r.monthlyPayment)}`;
}

function verdictClass(r: ComparisonRow): string {
  if (r.recommended) return "badge-good";
  if (r.verdict.startsWith("Salaries")) return "badge-bad";
  if (r.verdict.startsWith("Hidden") || r.verdict.includes("drains") || r.verdict.startsWith("Tight")) return "badge-warn";
  return "badge-muted";
}

function runwayClass(m: number): string {
  if (m < 1.5) return "text-bad";
  if (m < 2) return "text-warn";
  return "text-good";
}

function runwayText(m: number | null): string {
  return m === null || !Number.isFinite(m) ? "—" : m.toFixed(2);
}

function methodName(r: ComparisonRow): string {
  if (r.method === "ltff") return "LTFF";
  if (r.method === "bank") return "The bank loan";
  if (r.method === "installments") return "The installment plan";
  return "Cash";
}

function feeText(feePct: number): string {
  return String(Number((feePct * 100).toFixed(2)));
}

// "1.5" → 1.5 (percent); null if not a sensible fee.
function parseFee(text: string): number | null {
  const pct = Number(text.trim() === "" ? "0" : text);
  return Number.isFinite(pct) && pct >= 0 && pct <= 10 ? pct : null;
}

function formatShift(s: number): string {
  return s === 0 ? "0%" : `+${formatPct(s)}`;
}

export default function ComparisonTable() {
  const { state, update } = useStore();
  const { offers, decision } = state;
  const shift = decision?.kiborShift ?? 0;
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Always computes from the latest store state; optional patch lets fee edits and recompute land together.
  const recompute = useCallback(
    (kiborShift: number, patch: Partial<FaislaState> = {}) => {
      update((s) => {
        const next = { ...s, ...patch };
        const result =
          next.offers.length > 0
            ? decide({ company: next.company, offers: next.offers, financing: next.financing, kiborShift })
            : null;
        // The memo quotes the decision's numbers, so any recompute makes it stale.
        return { ...patch, decision: result, memo: null };
      });
    },
    [update],
  );

  // Auto-compute when offers exist and nothing has been computed yet (or inputs changed and cleared it).
  useEffect(() => {
    if (offers.length > 0 && decision === null) recompute(0);
  }, [offers.length, decision, recompute]);

  // Unstressed result, to say whether the KIBOR shift changes the recommendation.
  const base = useMemo<DecideResult | null>(() => {
    if (!decision || shift === 0) return decision;
    return decide({ company: state.company, offers: state.offers, financing: state.financing, kiborShift: 0 });
  }, [decision, shift, state.company, state.offers, state.financing]);

  if (offers.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">Compare every way to pay</h2>
        <p className="card-sub mt-2">
          Confirm a quotation first. Once there is at least one offer, Faisla compares cash, the supplier&apos;s
          installments, a bank loan and LTFF here.
        </p>
      </section>
    );
  }

  const rec = decision?.rows.find((r) => r.recommended) ?? null;
  const baseline = decision?.rows.find((r) => r.id === decision.baselineId) ?? null;
  const baseRec = base?.rows.find((r) => r.recommended) ?? null;
  const recChanged = !!rec && !!baseRec && rec.id !== baseRec.id;
  const shiftedLoans = decision?.rows.filter((r) => r.method === "bank") ?? [];

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Compare every way to pay</h2>
          <p className="card-sub">
            Present value (PV) = today&apos;s cost of every future payment. After tax counts markup and depreciation
            savings{decision ? `, discounted at ${formatPct(decision.afterTaxDiscountRate, 2)}` : ""}. All maths by code,
            none by AI.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => recompute(shift)}>
          Compare
        </button>
      </div>

      {decision && rec && (
        <>
          <SummaryStrip decision={decision} rec={rec} baseline={baseline} />

          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Option</th>
                  <th className="py-2 pr-3 font-medium">Pay</th>
                  <th className="py-2 pr-3 text-right font-medium">PV before tax</th>
                  <th className="py-2 pr-3 text-right font-medium">PV after tax</th>
                  <th className="py-2 pr-3 text-right font-medium">Runway (months)</th>
                  <th className="py-2 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {decision.rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className={`border-b border-line align-top ${r.recommended ? "bg-brand-soft" : ""}`}>
                      <td className="py-3 pr-3">
                        <div className={`font-medium ${r.recommended ? "text-brand" : "text-ink"}`}>{r.label}</div>
                        <div className="text-xs text-muted">{r.supplierName}</div>
                        {r.hiddenYearlyRate !== null && r.hiddenYearlyRate > 0 && (
                          <span className="badge-warn mt-1">hidden {formatPct(r.hiddenYearlyRate)} a year</span>
                        )}
                        <button
                          type="button"
                          className="mt-1 block text-xs font-medium text-brand underline-offset-2 hover:underline"
                          onClick={() => toggle(r.id)}
                          aria-expanded={open.has(r.id)}
                        >
                          {open.has(r.id) ? "Hide calculation" : "Show calculation"}
                        </button>
                      </td>
                      <td className="num py-3 pr-3 whitespace-nowrap">{payText(r)}</td>
                      <td className="num py-3 pr-3 text-right">{groupPKR(r.pvBeforeTax)}</td>
                      <td className={`num py-3 pr-3 text-right ${r.recommended ? "font-semibold" : ""}`}>
                        {groupPKR(r.pvAfterTax)}
                      </td>
                      <td className={`num py-3 pr-3 text-right font-medium ${runwayClass(r.runwayMonths)}`}>
                        {runwayText(r.runwayMonths)}
                      </td>
                      <td className="py-3">
                        <span className={verdictClass(r)}>{r.verdict}</span>
                      </td>
                    </tr>
                    {open.has(r.id) && (
                      <tr className="border-b border-line bg-paper/60">
                        <td colSpan={6} className="px-3 py-3">
                          <CalculationList row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <PvChart rows={decision.rows} />

          <div className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="kibor-shift" className="label mb-0">
                Stress test: KIBOR shift
              </label>
              <span className="num text-sm font-semibold">{formatShift(shift)}</span>
            </div>
            <input
              id="kibor-shift"
              type="range"
              min={0}
              max={SHIFT_STEPS.length - 1}
              step={1}
              value={Math.round(shift / 0.005)}
              onChange={(e) => recompute(SHIFT_STEPS[Number(e.target.value)])}
              className="mt-2 w-full accent-brand"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>+2%</span>
              <span>+4%</span>
            </div>
            <p className="mt-2 text-sm">
              {shiftedLoans.map((r) => (
                <span key={r.id} className="mr-3">
                  {r.label}: EMI <span className="num">{groupPKR(r.monthlyPayment)}</span>, PV{" "}
                  <span className="num">{groupPKR(r.pvBeforeTax)}</span> before tax.
                </span>
              ))}
              {shift === 0 ? (
                <span className="text-muted">Move the slider to see what happens if KIBOR rises.</span>
              ) : recChanged ? (
                <span className="badge-bad">Recommendation changes to {rec.label}</span>
              ) : (
                <span className="badge-good">Recommendation unchanged: {rec.label}</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted">Only KIBOR-linked loans move; LTFF follows the SBP policy rate.</p>
          </div>

          <AssumptionsCard decision={decision} recompute={recompute} />
        </>
      )}
    </section>
  );
}

function SummaryStrip({
  decision,
  rec,
  baseline,
}: {
  decision: DecideResult;
  rec: ComparisonRow;
  baseline: ComparisonRow | null;
}) {
  const be = decision.breakEvenDiscountRate;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-brand-soft p-4">
        <div className="label">Recommended</div>
        <div className="text-lg font-semibold text-brand">{rec.label}</div>
        {decision.savingsVsBaseline && baseline && baseline.id !== rec.id ? (
          <p className="mt-1 text-sm">
            Saves <span className="num font-semibold">{formatPKR(decision.savingsVsBaseline.beforeTax)}</span> before
            tax, <span className="num font-semibold">{formatPKR(decision.savingsVsBaseline.afterTax)}</span> after tax
            vs the quoted plan ({baseline.label}).
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">This is the quoted plan itself.</p>
        )}
      </div>
      <div className="rounded-lg border border-line p-4">
        <div className="label">Cash runway</div>
        <p className="text-sm">
          Today <span className="num font-semibold">{runwayText(decision.runwayToday)}</span> months → after{" "}
          {rec.label} <span className={`num font-semibold ${runwayClass(rec.runwayMonths)}`}>{runwayText(rec.runwayMonths)}</span>{" "}
          months.
        </p>
        <p className="mt-1 text-xs text-muted">Counts no sales income, so it is a floor.</p>
      </div>
      <div className="rounded-lg border border-line p-4">
        <div className="label">Break-even discount rate</div>
        {be === null ? (
          <p className="text-sm text-muted">Not applicable: the recommended option is a cash payment.</p>
        ) : be === 0 ? (
          <p className="text-sm">{methodName(rec)} beats paying cash at any discount rate.</p>
        ) : (
          <p className="text-sm">
            {methodName(rec)} beats paying cash for any discount rate above{" "}
            <span className="num font-semibold">{formatPct(be)}</span> a year (ours is{" "}
            {formatPct(decision.company.discountRate)}).
          </p>
        )}
      </div>
    </div>
  );
}

function CalculationList({ row }: { row: ComparisonRow }) {
  return (
    <ol className="space-y-3">
      {row.calculation.map((s, i) => (
        <li key={i} className="text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{s.label}</span>
            <span className="num font-semibold">{String(s.result)}</span>
          </div>
          <div className="num text-xs text-muted">{s.formula}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Object.entries(s.inputs).map(([k, v]) => (
              <span key={k} className="badge-muted border border-line">
                {k} = <span className="num">{String(v)}</span>
              </span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PvChart({ rows }: { rows: ComparisonRow[] }) {
  const data = rows.map((r) => ({ label: r.label, pv: Math.round(r.pvAfterTax), recommended: r.recommended }));
  return (
    <div>
      <div className="label">PV after tax per option (lower is cheaper)</div>
      <div style={{ height: data.length * 44 + 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatLakh(v, 0)}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fontSize: 12, fill: "var(--ink)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--paper)" }}
              formatter={(v) => [formatPKR(Number(v)), "PV after tax"]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--line)", fontSize: 12 }}
            />
            <Bar dataKey="pv" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.recommended ? "var(--brand)" : "#b9c4bd"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AssumptionsCard({
  decision,
  recompute,
}: {
  decision: DecideResult;
  recompute: (kiborShift: number, patch?: Partial<FaislaState>) => void;
}) {
  const { state } = useStore();
  const current = state.financing[0]?.feePct ?? 0;
  const [draft, setDraft] = useState(() => feeText(current));

  // Re-sync when the stored fee changes elsewhere (localStorage load, reset). Every valid keystroke is saved
  // at once, so a valid draft that differs from the store can only mean an outside change.
  const draftPct = parseFee(draft);
  if (draftPct !== null && Math.abs(draftPct / 100 - current) > 1e-9) setDraft(feeText(current));

  function onFee(text: string) {
    setDraft(text);
    const pct = parseFee(text);
    if (pct === null) return;
    const financing = state.financing.map((f) => ({ ...f, feePct: pct / 100 }));
    recompute(decision.kiborShift, { financing, memo: null });
  }

  return (
    <div className="rounded-lg border border-line bg-paper/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-semibold">Assumptions</h3>
        <div className="w-40">
          <label htmlFor="fee-pct" className="label">
            Bank processing fee %
          </label>
          <input
            id="fee-pct"
            className="input num"
            inputMode="decimal"
            value={draft}
            onChange={(e) => onFee(e.target.value)}
          />
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {decision.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
