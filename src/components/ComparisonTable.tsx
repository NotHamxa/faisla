"use client";
// M5: compare every way to pay. Runs lib/finance.ts in the browser (pure, instant) and saves the result to the store.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AlertTriangleIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { FINANCING_NAMES, SHARIAH_NOTES, decide, isFinancedMethod, isShariahRow, paymentWord } from "@/lib/finance";
import { formatLakh, formatPKR, formatPct, groupPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { ComparisonRow, DecideResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SHIFT_STEPS = Array.from({ length: 9 }, (_, i) => i * 0.005); // 0 → +4% in 0.5% steps

// Semantic tones as tag variants (theme tokens, so they work in light and dark).
const TONE = {
  success: "success",
  warning: "warning",
  danger: "destructive",
  muted: "muted",
} as const;

type Tone = (typeof TONE)[keyof typeof TONE];

function payText(r: ComparisonRow): string {
  if (r.method === "cash") return `${groupPKR(r.upfront)} now`;
  if (r.method === "installments") {
    return `${r.months} × ${groupPKR(r.monthlyPayment)}${r.upfront > 0 ? " (1st on delivery)" : ""}`;
  }
  return `${groupPKR(r.upfront)} + ${r.months} × ${groupPKR(r.monthlyPayment)}`;
}

function verdictTone(r: ComparisonRow): Tone {
  if (r.recommended) return TONE.success;
  if (r.verdict.startsWith("Salaries")) return TONE.danger;
  if (
    r.verdict.startsWith("Paying later") ||
    r.verdict.startsWith("Hidden") ||
    r.verdict.includes("drains") ||
    r.verdict.startsWith("Tight")
  )
    return TONE.warning;
  return TONE.muted;
}

function runwayClass(m: number): string {
  if (m < 1.5) return "text-destructive";
  if (m < 2) return "text-warning";
  return "text-success";
}

function runwayText(m: number | null): string {
  return m === null || !Number.isFinite(m) ? "—" : m.toFixed(2);
}

function methodName(r: ComparisonRow): string {
  if (r.method === "installments") return "The deferred-price plan";
  if (r.method === "cash") return "Cash";
  if (r.method === "bank") return "The conventional loan";
  return FINANCING_NAMES[r.method] ?? "This financing";
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
      <Card>
        <CardHeader>
          <CardTitle>Compare every way to pay</CardTitle>
          <CardDescription>
            Confirm a quotation first. Once there is at least one offer, Faisla compares cash, the supplier&apos;s
            deferred-price plan and Shariah-compliant financing (Diminishing Musharakah, Ijarah, Islamic LTFF) here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rec = decision?.rows.find((r) => r.recommended) ?? null;
  const baseline = decision?.rows.find((r) => r.id === decision.baselineId) ?? null;
  const baseRec = base?.rows.find((r) => r.recommended) ?? null;
  const recChanged = !!rec && !!baseRec && rec.id !== baseRec.id;
  const kiborLinkedIds = new Set(state.financing.filter((f) => f.kiborLinked).map((f) => f.id));
  const shiftedLoans = decision?.rows.filter((r) => r.financingId !== null && kiborLinkedIds.has(r.financingId)) ?? [];
  const preference = state.company.financingPreference ?? "islamic";
  const conventionalRows = decision?.rows.filter((r) => !isShariahRow(r)).length ?? 0;
  const hasIslamicFinancing = !!decision?.rows.some((r) => isFinancedMethod(r.method) && isShariahRow(r));
  // A saved comparison goes stale when the company profile or financing preference changes after it was calculated.
  const profileChanged =
    !!decision &&
    ((["isExporter", "cashBalance", "monthlyFixedCosts", "taxRate", "discountRate"] as const).some(
      (key) => decision.company[key] !== state.company[key],
    ) ||
      !!decision.company.payInFullWhenAffordable !== !!state.company.payInFullWhenAffordable ||
      (decision.financingPreference ?? "both") !== preference);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl font-bold">Compare every way to pay</CardTitle>
          <CardDescription>
            Present value (PV) = today&apos;s cost of every future payment. After tax counts profit, rental and
            depreciation savings{decision ? `, discounted at ${formatPct(decision.afterTaxDiscountRate, 2)}` : ""}. All
            maths by code, none by AI.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground" data-testid="preference-note">
            <Badge variant="success">
              {preference === "islamic" ? "Shariah-compliant only" : "Islamic + conventional for comparison"}
            </Badge>
            <span>
              {preference === "islamic"
                ? "Conventional (interest-based) financing is left out."
                : "Conventional rows are labelled and never recommended."}{" "}
              <Link href="/financing#preference" className="text-primary underline-offset-2 hover:underline">
                Change preference
              </Link>
            </span>
          </div>
          <CardAction>
            <Button onClick={() => recompute(shift)}>
              <RefreshCwIcon data-icon="inline-start" />
              Compare
            </Button>
          </CardAction>
        </CardHeader>

        {decision && rec && (
          <CardContent className="space-y-5">
            {profileChanged && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-l-[3px] border-warning/50 border-l-warning bg-card px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-warning">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  Your company profile or financing preference changed since this comparison was calculated.
                </span>
                <Button size="sm" variant="outline" onClick={() => recompute(shift)}>
                  Recalculate
                </Button>
              </div>
            )}
            <SummaryTiles decision={decision} rec={rec} baseline={baseline} />

            <div className="-mx-4 border-y border-foreground/70">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 pl-4">Option</TableHead>
                    <TableHead className="h-10">Pay</TableHead>
                    <TableHead className="h-10 text-right">PV before tax</TableHead>
                    <TableHead className="h-10 text-right">PV after tax</TableHead>
                    <TableHead className="h-10 text-right">Runway (months)</TableHead>
                    <TableHead className="h-10 pr-4">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decision.rows.map((r) => {
                    const isOpen = open.has(r.id);
                    return (
                      <Fragment key={r.id}>
                        <TableRow
                          data-recommended={r.recommended || undefined}
                          data-conventional={!isShariahRow(r) || undefined}
                          className={cn("align-top", !isShariahRow(r) && "text-muted-foreground")}
                        >
                          <TableCell
                            className={cn(
                              "relative py-3 pl-4 whitespace-normal",
                              r.recommended && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={cn("font-medium", r.recommended && "font-semibold")}>{r.label}</span>
                              {r.recommended && (
                                <Badge>
                                  <CheckIcon data-icon="inline-start" />
                                  Recommended
                                </Badge>
                              )}
                              {!isShariahRow(r) && <Badge variant="muted">Conventional · interest-based</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.supplierName}</div>
                            {r.hiddenYearlyRate !== null && r.hiddenYearlyRate > 0 && (
                              <Badge variant={TONE.warning} className="mt-1.5">
                                <AlertTriangleIcon data-icon="inline-start" />
                                paying later costs {formatPct(r.hiddenYearlyRate)} a year
                              </Badge>
                            )}
                            <Button
                              variant="link"
                              size="xs"
                              className="mt-1 flex h-auto w-fit px-0"
                              onClick={() => toggle(r.id)}
                              aria-expanded={isOpen}
                            >
                              <span className="inline-flex items-center gap-1">
                                <CalculatorIcon />
                                {isOpen ? "Hide calculation" : "Show calculation"}
                                <ChevronDownIcon className={cn("transition-transform", isOpen && "rotate-180")} />
                              </span>
                            </Button>
                          </TableCell>
                          <TableCell className="py-3 font-mono tabular-nums">{payText(r)}</TableCell>
                          <TableCell className="py-3 text-right font-mono tabular-nums">{groupPKR(r.pvBeforeTax)}</TableCell>
                          <TableCell className="py-3 text-right font-mono tabular-nums">
                            {/* The figure that decides it gets the accountant's double underline. */}
                            <span className={cn(r.recommended && "border-b-[3px] border-double border-primary pb-px font-semibold text-primary")}>
                              {groupPKR(r.pvAfterTax)}
                            </span>
                          </TableCell>
                          <TableCell
                            className={cn("py-3 text-right font-mono font-medium tabular-nums", runwayClass(r.runwayMonths))}
                          >
                            {runwayText(r.runwayMonths)}
                          </TableCell>
                          <TableCell className="py-3 pr-4">
                            <Badge variant={verdictTone(r)} className="h-auto min-h-5 py-1 text-left whitespace-normal">{r.verdict}</Badge>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/60 hover:bg-muted/60">
                            <TableCell colSpan={6} className="px-4 py-4 whitespace-normal">
                              <CalculationList row={r} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {conventionalRows > 0 && (
              <p className="text-xs text-muted-foreground">
                {conventionalRows} conventional (interest-based) row{conventionalRows === 1 ? " is" : "s are"} shown for
                comparison only; the recommendation is always Shariah-compliant.
              </p>
            )}

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <PvChart rows={decision.rows} />
              </div>
              <div className="lg:col-span-2">
                <StressTest
                  shift={shift}
                  onShift={(s) => recompute(s)}
                  loans={shiftedLoans}
                  rec={rec}
                  recChanged={recChanged}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {decision && <AssumptionsCard decision={decision} recompute={recompute} shariahNotes={hasIslamicFinancing} />}
    </div>
  );
}

function StatTile({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 bg-card p-4",
        highlight && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
      )}
    >
      <div className={cn("ledger-label", highlight && "text-primary")}>{label}</div>
      {children}
    </div>
  );
}

function SummaryTiles({
  decision,
  rec,
  baseline,
}: {
  decision: DecideResult;
  rec: ComparisonRow;
  baseline: ComparisonRow | null;
}) {
  const be = decision.breakEvenDiscountRate;
  const showSavings = decision.savingsVsBaseline && baseline && baseline.id !== rec.id;
  // "Pay in full when affordable" can pick cash over cheaper financing: say so, with the difference.
  const cheapest = decision.rows.find(isShariahRow) ?? null;
  const cheaperFinancing =
    rec.method === "cash" && cheapest && cheapest.id !== rec.id && isFinancedMethod(cheapest.method) ? cheapest : null;
  return (
    <div className="grid gap-px overflow-hidden rounded-[2px] border bg-border md:grid-cols-3">
      <StatTile label="Recommended" highlight>
        <div className="font-heading text-base font-bold">{rec.label}</div>
        {rec.method === "cash" && (
          <p className="text-xs text-muted-foreground" data-testid="pay-in-full-note">
            Paid in full from cash: no financing needed.
            {cheaperFinancing && decision.company.payInFullWhenAffordable && (
              <>
                {" "}
                You chose to pay in full when affordable (Settings); {cheaperFinancing.label} would cost{" "}
                <span className="font-mono tabular-nums">
                  {formatPKR(Math.round(rec.pvAfterTax) - Math.round(cheaperFinancing.pvAfterTax))}
                </span>{" "}
                less after tax.
              </>
            )}
          </p>
        )}
        {showSavings && decision.savingsVsBaseline ? (
          <>
            <div className="font-mono text-2xl font-medium tabular-nums">
              {formatPKR(decision.savingsVsBaseline.beforeTax)}
            </div>
            <p className="text-xs text-muted-foreground">
              saved before tax ·{" "}
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatPKR(decision.savingsVsBaseline.afterTax)}
              </span>{" "}
              after tax vs the quoted plan ({baseline.label})
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {decision.baselineId ? "This is the quoted plan itself." : "No supplier quotation to measure savings against."}
          </p>
        )}
      </StatTile>

      <StatTile label="Cash runway">
        <div className="flex items-baseline gap-2 font-mono text-2xl font-medium tabular-nums">
          <span className="text-muted-foreground">{runwayText(decision.runwayToday)}</span>
          <span className="text-base text-muted-foreground">→</span>
          <span className={runwayClass(rec.runwayMonths)}>{runwayText(rec.runwayMonths)}</span>
          <span className="font-sans text-sm font-normal text-muted-foreground">months</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Today vs after {rec.label}. Counts no sales income, so it is a floor.
        </p>
      </StatTile>

      <StatTile label="Break-even discount rate">
        {be === null ? (
          <p className="text-sm text-muted-foreground">Not applicable: the recommended option is a cash payment.</p>
        ) : be === 0 ? (
          <p className="text-sm">{methodName(rec)} beats paying cash at any discount rate.</p>
        ) : (
          <>
            <div className="font-mono text-2xl font-medium tabular-nums">{formatPct(be)}</div>
            <p className="text-xs text-muted-foreground">
              {methodName(rec)} beats paying cash for any discount rate above this (ours is{" "}
              <span className="font-mono tabular-nums">{formatPct(decision.company.discountRate)}</span>).
            </p>
          </>
        )}
      </StatTile>
    </div>
  );
}

function CalculationList({ row }: { row: ComparisonRow }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {row.calculation.map((s, i) => (
        <li key={i} className="rounded-[2px] border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">
              <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
              {s.label}
            </span>
            <span className="font-mono font-semibold tabular-nums">{String(s.result)}</span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{s.formula}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(s.inputs).map(([k, v]) => (
              <Badge key={k} variant="outline" className="font-normal">
                {k} = <span className="font-mono tabular-nums">{String(v)}</span>
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

const chartConfig = {
  pv: { label: "PV after tax" },
} satisfies ChartConfig;

function PvChart({ rows }: { rows: ComparisonRow[] }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({ label: r.label, pv: Math.round(r.pvAfterTax), recommended: r.recommended }));
  return (
    <div className="h-full rounded-[2px] border p-4">
      <div className="ledger-label">PV after tax per option (lower is cheaper)</div>
      <ChartContainer config={chartConfig} className="mt-2 aspect-auto w-full" style={{ height: data.length * 44 + 40 }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatLakh(v, 0)}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={isMobile ? 130 : 210}
            tick={{ fontSize: isMobile ? 10 : 12 }}
            axisLine={false}
            tickLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(v) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">PV after tax</span>
                    <span className="font-mono font-medium tabular-nums">{formatPKR(Number(v))}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="pv" radius={0} maxBarSize={20}>
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={d.recommended ? "var(--chart-1)" : "var(--chart-5)"}
                fillOpacity={d.recommended ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function StressTest({
  shift,
  onShift,
  loans,
  rec,
  recChanged,
}: {
  shift: number;
  onShift: (shift: number) => void;
  loans: ComparisonRow[];
  rec: ComparisonRow;
  recChanged: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[2px] border p-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="kibor-shift" className="ledger-label">
          Stress test: KIBOR shift
        </label>
        <span className="font-mono text-lg font-medium tabular-nums">{formatShift(shift)}</span>
      </div>
      <Slider
        id="kibor-shift"
        aria-label="KIBOR shift"
        min={0}
        max={SHIFT_STEPS.length - 1}
        step={1}
        value={[Math.round(shift / 0.005)]}
        onValueChange={(v) => {
          const idx = Array.isArray(v) ? v[0] : v;
          const next = SHIFT_STEPS[idx] ?? 0;
          if (Math.abs(next - shift) > 1e-9) onShift(next);
        }}
      />
      <div className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
        <span>0%</span>
        <span>+2%</span>
        <span>+4%</span>
      </div>

      {shift === 0 ? (
        <p className="text-sm text-muted-foreground">Move the slider to see what happens if KIBOR, the benchmark, rises.</p>
      ) : recChanged ? (
        <div className="flex items-start gap-2 border-l-[3px] border-destructive py-1 pl-3 text-sm font-medium text-destructive">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>Recommendation changes to {rec.label}</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 border-l-[3px] border-success py-1 pl-3 text-sm font-medium text-success">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <span>Recommendation unchanged: {rec.label}</span>
        </div>
      )}

      {loans.length > 0 && (
        <ul className="space-y-1 text-sm">
          {loans.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-x-3">
              <span className="text-muted-foreground">{r.label}</span>
              <span>
                {paymentWord(r.method) === "rental" ? "Rental" : "Installment"}{" "}
                <span className="font-mono tabular-nums">{groupPKR(r.monthlyPayment)}</span>, PV{" "}
                <span className="font-mono tabular-nums">{groupPKR(r.pvBeforeTax)}</span> before tax
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-xs text-muted-foreground">
        Only KIBOR-linked financing moves (Diminishing Musharakah, Ijarah); Islamic LTFF follows the SBP policy rate and
        a Murabaha price is fixed at the contract.
      </p>
    </div>
  );
}

function AssumptionsCard({
  decision,
  recompute,
  shariahNotes,
}: {
  decision: DecideResult;
  recompute: (kiborShift: number, patch?: Partial<FaislaState>) => void;
  shariahNotes: boolean;
}) {
  const { state } = useStore();
  const current = state.financing[0]?.feePct ?? 0;
  const [draft, setDraft] = useState(() => feeText(current));

  // Re-sync when the stored fee changes elsewhere (financing page, reset). Every valid keystroke is saved
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
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Assumptions</CardTitle>
        <CardDescription>What the comparison takes as given. Edit the fee to see it flow through.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {decision.assumptions
              .filter((a) => !(shariahNotes && a.startsWith("Shariah notes:")))
              .map((a) => (
                <li key={a}>{a}</li>
              ))}
          </ul>
          {shariahNotes && (
            <div className="rounded-[2px] border border-l-[3px] border-l-primary p-3" data-testid="shariah-notes">
              <div className="ledger-label text-primary">Shariah notes</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {SHARIAH_NOTES.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Field data-invalid={draftPct === null || undefined}>
          <FieldLabel htmlFor="fee-pct">Processing fee %</FieldLabel>
          <Input
            id="fee-pct"
            className="font-mono tabular-nums"
            inputMode="decimal"
            value={draft}
            aria-invalid={draftPct === null || undefined}
            onChange={(e) => onFee(e.target.value)}
          />
          <FieldDescription className="text-xs">
            {draftPct === null ? "Enter 0 to 10" : "Applied to every financing option"}
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}
