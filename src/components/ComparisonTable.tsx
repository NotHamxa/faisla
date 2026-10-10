"use client";
// M5: compare every way to pay. Runs lib/finance.ts in the browser (pure, instant) and saves the result to the store.
// Leads with one answer (best way to pay + the numbers that matter); everything else sits under "How we worked this out".
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AlertTriangleIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  FINANCING_NAMES,
  SAFE_RUNWAY,
  SHARIAH_NOTES,
  chosenRowOf,
  decide,
  effectiveRow,
  extraCostAfterTax,
  isFinancedMethod,
  isShariahRow,
  overrideRow,
  paymentWord,
} from "@/lib/finance";
import { formatLakh, formatPKR, formatPct, groupPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { ComparisonRow, DecideResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Details, HelpTip, TermTip } from "@/components/simple";

const SHIFT_STEPS = Array.from({ length: 9 }, (_, i) => i * 0.005); // 0 → +4% in 0.5% steps

const TRUE_COST_HELP =
  "Every payment, now and later, turned into today's money (present value), after tax savings. Lower is cheaper.";
const CASH_LEFT_HELP = "How many months of fixed costs your bank balance covers after this purchase. Counts no sales.";

type Tone = "success" | "warning" | "destructive" | "muted";

// finance.ts writes full-sentence verdicts; the table shows a short plain tag (full sentence on hover).
function verdictTag(r: ComparisonRow): { text: string; tone: Tone } {
  const v = r.verdict;
  if (r.recommended) return { text: "Best choice", tone: "success" };
  if (v.startsWith("Interest-based")) return { text: "Comparison only", tone: "muted" };
  if (v.startsWith("Paying later")) return { text: "Hidden cost", tone: "warning" };
  if (v.startsWith("Cheapest price, drains")) return { text: "Cheapest, low cash", tone: "warning" };
  if (v.startsWith("Cheapest price")) return { text: "Cheapest price", tone: "muted" };
  if (v.startsWith("Salaries")) return { text: "Salaries at risk", tone: "destructive" };
  if (v.startsWith("Tight")) return { text: "Tight on cash", tone: "warning" };
  if (v.startsWith("Cheaper in today's money")) return { text: "Cheaper, uses financing", tone: "muted" };
  if (v.startsWith("Safe, dearer")) return { text: "Costs more", tone: "muted" };
  return { text: v, tone: "muted" };
}

function payText(r: ComparisonRow): string {
  if (r.method === "cash") return `${groupPKR(r.upfront)} now`;
  if (r.method === "installments") {
    return `${r.months} × ${groupPKR(r.monthlyPayment)}${r.upfront > 0 ? " (1st on delivery)" : ""}`;
  }
  return `${groupPKR(r.upfront)} now + ${r.months} × ${groupPKR(r.monthlyPayment)}`;
}

function runwayClass(m: number): string {
  if (m < 1.5) return "text-destructive";
  if (m < 2) return "text-warning";
  return "text-success";
}

function runwayText(m: number | null): string {
  return m === null || !Number.isFinite(m) ? "—" : m.toFixed(2);
}

// 'B, Islamic LTFF 8.5%' → 'Islamic LTFF 8.5%' (the supplier is named separately).
function planName(r: ComparisonRow): string {
  return r.label.replace(/^[A-Z],\s*/, "");
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
            ? decide({
                company: next.company,
                offers: next.offers,
                financing: next.financing,
                kiborShift,
              })
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
    return decide({
      company: state.company,
      offers: state.offers,
      financing: state.financing,
      kiborShift: 0,
    });
  }, [decision, shift, state.company, state.offers, state.financing]);

  if (offers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compare every way to pay</CardTitle>
          <CardDescription>Confirm a quotation first.</CardDescription>
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

  // The owner's own pick (null = go with the recommendation). Choosing the recommended row shows both tags.
  const chosenId = chosenRowOf(decision, state.chosenRowId)?.id ?? null;
  const override = overrideRow(decision, state.chosenRowId);

  // A different row changes what the memo is about, so a choice that moves the effective row clears it.
  function choose(id: string | null) {
    update((s) => {
      if (s.chosenRowId === id) return {};
      const moved = effectiveRow(s.decision, s.chosenRowId)?.id !== effectiveRow(s.decision, id)?.id;
      return moved ? { chosenRowId: id, memo: null } : { chosenRowId: id };
    });
  }

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
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
        data-testid="preference-note"
      >
        <span>
          Showing:{" "}
          <span className="font-medium text-foreground">
            {preference === "islamic" ? "Shariah-compliant only" : "Islamic + conventional"}
          </span>
        </span>
        <Link href="/financing#preference" className="text-primary underline-offset-4 hover:underline">
          Change
        </Link>
        {!profileChanged && decision && (
          <Button
            variant="link"
            size="xs"
            className="ml-auto h-auto px-0 text-muted-foreground"
            onClick={() => recompute(shift)}
          >
            Recalculate
          </Button>
        )}
      </div>

      {profileChanged && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-l-[3px] border-warning/50 border-l-warning bg-card px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-warning">
            <AlertTriangleIcon className="size-4 shrink-0" />
            Your company details changed since this was worked out.
          </span>
          <Button size="sm" variant="outline" onClick={() => recompute(shift)}>
            Recalculate
          </Button>
        </div>
      )}

      {decision && rec && (
        <>
          <AnswerCard
            decision={decision}
            rec={rec}
            chosen={override}
            baseline={baseline}
            onUseRecommended={() => choose(null)}
          />

          <Card>
            <CardHeader>
              <CardTitle>All the ways to pay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <OptionsTable rows={decision.rows} chosenId={chosenId} onChoose={choose} />
              {conventionalRows > 0 && (
                <p className="text-xs text-muted-foreground">
                  Conventional (interest-based) rows are for comparison only: Faisla never recommends them, but you
                  can still choose one.
                </p>
              )}

              <Details title="How we worked this out" testId="how-worked-out">
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    True cost = present value: every payment in today&apos;s money, after tax savings, discounted at{" "}
                    {formatPct(decision.afterTaxDiscountRate, 2)} a year. All maths by code, none by AI.
                  </p>

                  <DetailTable rows={decision.rows} open={open} toggle={toggle} />

                  <ExtraTiles decision={decision} rec={rec} />

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

                  <Assumptions decision={decision} recompute={recompute} shariahNotes={hasIslamicFinancing} />
                </div>
              </Details>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AnswerCard({
  decision,
  rec,
  chosen,
  baseline,
  onUseRecommended,
}: {
  decision: DecideResult;
  rec: ComparisonRow;
  chosen: ComparisonRow | null; // the owner's pick when it differs from the recommendation
  baseline: ComparisonRow | null;
  onUseRecommended: () => void;
}) {
  // Every figure on the card is for the row the owner goes ahead with.
  const row = chosen ?? rec;
  const savings = chosen
    ? baseline
      ? {
          afterTax: Math.round(baseline.pvAfterTax) - Math.round(row.pvAfterTax),
          beforeTax: Math.round(baseline.pvBeforeTax) - Math.round(row.pvBeforeTax),
        }
      : null
    : decision.savingsVsBaseline;
  const showSavings = !!savings && !!baseline && baseline.id !== row.id && savings.afterTax > 0;
  // "Pay in full when affordable" can pick cash over cheaper financing: say so, with the difference.
  const cheapest = decision.rows.find(isShariahRow) ?? null;
  const cheaperFinancing =
    rec.method === "cash" && cheapest && cheapest.id !== rec.id && isFinancedMethod(cheapest.method) ? cheapest : null;
  const hidden =
    baseline && baseline.id !== row.id && baseline.hiddenYearlyRate !== null && baseline.hiddenYearlyRate > 0
      ? baseline
      : null;

  const reason =
    chosen || rec.method === "cash"
      ? null
      : rec.runwayMonths >= SAFE_RUNWAY
        ? `Lowest true cost that still leaves ${SAFE_RUNWAY}+ months of cash.`
        : "Lowest true cost, but every option leaves little cash.";
  const extra = chosen ? extraCostAfterTax(chosen, rec) : 0;

  return (
    <section
      className="relative rounded-[2px] border border-foreground/30 bg-card p-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] before:bg-primary sm:p-6"
      data-testid="answer-card"
      data-chosen={chosen ? chosen.id : undefined}
    >
      <div className="ledger-label text-primary">{chosen ? "Your way to pay" : "Best way to pay"}</div>
      <h2 className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-2xl leading-tight font-bold sm:text-[1.75rem]">
        <span>
          {chosen && <span className="font-normal text-muted-foreground">Your choice: </span>}
          {planName(row)} <TermTip label={row.label} /> <span className="font-normal text-muted-foreground">with</span>{" "}
          {row.supplierName}
        </span>
      </h2>

      <dl className="mt-5 grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">
            {showSavings ? "Saves vs the quote" : "Compared with the quote"}
          </dt>
          {showSavings && savings ? (
            <dd className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-2xl font-semibold text-success tabular-nums sm:text-3xl">
                {formatPKR(savings.afterTax)}
              </span>
              <HelpTip>
                In today&apos;s money, after tax, vs {baseline!.label}. Before tax: {formatPKR(savings.beforeTax)}.
              </HelpTip>
            </dd>
          ) : (
            <dd className="mt-1 text-sm">
              {!decision.baselineId
                ? "No quotation to compare with."
                : baseline?.id === row.id
                  ? "This is the quoted plan itself."
                  : "No saving against the quoted plan."}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">You pay</dt>
          <dd className="mt-1 font-mono text-lg leading-snug font-medium tabular-nums">
            {row.method === "cash" ? (
              <>{formatPKR(row.upfront)} now</>
            ) : (
              <>
                {row.upfront > 0 && (
                  <>
                    {formatPKR(row.upfront)} now
                    <br />+{" "}
                  </>
                )}
                {formatPKR(row.monthlyPayment)} × {row.months}
                <span className="font-sans text-sm text-muted-foreground"> months</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-sm text-muted-foreground">
            Cash left
            <HelpTip>{CASH_LEFT_HELP}</HelpTip>
          </dt>
          <dd className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn("font-mono text-2xl font-semibold tabular-nums sm:text-3xl", runwayClass(row.runwayMonths))}
            >
              {runwayText(row.runwayMonths)}
            </span>
            <span className="text-sm text-muted-foreground">months (now {runwayText(decision.runwayToday)})</span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-1 border-t pt-3 text-sm text-muted-foreground">
        {chosen && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p data-testid="choice-cost" className="text-foreground">
              {extra > 0 ? (
                <>
                  Costs <span className="font-mono tabular-nums">{formatPKR(extra)}</span> more than {planName(rec)}{" "}
                  in today&apos;s money.
                </>
              ) : extra < 0 ? (
                <>
                  Costs <span className="font-mono tabular-nums">{formatPKR(-extra)}</span> less than {planName(rec)}{" "}
                  in today&apos;s money, but Faisla recommends {planName(rec)} to keep cash safe.
                </>
              ) : (
                <>Costs the same as {planName(rec)} in today&apos;s money.</>
              )}
            </p>
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0 text-muted-foreground"
              onClick={onUseRecommended}
              data-testid="use-recommended"
            >
              Use recommended
            </Button>
          </div>
        )}
        {chosen && !isShariahRow(chosen) && (
          <p className="text-warning">This is conventional (interest-based) financing, not Shariah-compliant.</p>
        )}
        {chosen && chosen.runwayMonths < SAFE_RUNWAY && (
          <p className="text-warning">
            Leaves {runwayText(chosen.runwayMonths)} months of cash, under the safe {SAFE_RUNWAY}.
          </p>
        )}
        {!chosen && rec.method === "cash" && (
          <p data-testid="pay-in-full-note">
            Paid in full from cash: no financing needed.
            {cheaperFinancing && decision.company.payInFullWhenAffordable && (
              <>
                {" "}
                You chose to pay in full when you can; {cheaperFinancing.label} would cost{" "}
                <span className="font-mono tabular-nums">
                  {formatPKR(Math.round(rec.pvAfterTax) - Math.round(cheaperFinancing.pvAfterTax))}
                </span>{" "}
                less after tax.
              </>
            )}
          </p>
        )}
        {reason && <p>{reason}</p>}
        {hidden && (
          <p className="text-warning">
            The quote&apos;s plan really costs {formatPct(hidden.hiddenYearlyRate!)} a year.
          </p>
        )}
        {chosen && chosen.hiddenYearlyRate !== null && chosen.hiddenYearlyRate > 0 && (
          <p className="text-warning">Paying later on this plan costs {formatPct(chosen.hiddenYearlyRate)} a year.</p>
        )}
      </div>
    </section>
  );
}

function OptionName({ r }: { r: ComparisonRow }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("font-medium", r.recommended && "font-semibold")}>{r.label}</span>
        <TermTip label={r.label} />
        {!isShariahRow(r) && <Badge variant="muted">Conventional · interest-based</Badge>}
      </div>
      <div className="text-xs text-muted-foreground">{r.supplierName}</div>
      {r.hiddenYearlyRate !== null && r.hiddenYearlyRate > 0 && (
        <Badge variant="warning" className="h-auto py-1 whitespace-normal">
          <AlertTriangleIcon data-icon="inline-start" />
          Paying later costs {formatPct(r.hiddenYearlyRate)} a year
        </Badge>
      )}
    </div>
  );
}

function Tag({ r }: { r: ComparisonRow }) {
  const t = verdictTag(r);
  return (
    <Badge variant={t.tone} title={r.verdict} className="h-auto min-h-5 py-1 text-left whitespace-normal">
      {r.recommended && <CheckIcon data-icon="inline-start" />}
      {t.text}
    </Badge>
  );
}

// The verdict tag, "Your choice" when the owner picked this row, else a small "Choose this" button.
function RowChoice({
  r,
  chosen,
  onChoose,
}: {
  r: ComparisonRow;
  chosen: boolean;
  onChoose: (id: string) => void;
}) {
  const conventional = !isShariahRow(r);
  return (
    <div className="flex flex-col items-end gap-1.5 sm:items-start">
      <Tag r={r} />
      {chosen ? (
        <Badge variant="outline" className="h-auto min-h-5 py-1" data-testid="your-choice">
          <CheckIcon data-icon="inline-start" />
          Your choice
        </Badge>
      ) : (
        <Button
          variant="outline"
          size="xs"
          className="h-6 whitespace-nowrap"
          onClick={() => onChoose(r.id)}
          aria-label={`Choose ${r.label}`}
          title={conventional ? "Conventional (interest-based): not Shariah-compliant" : undefined}
          data-testid="choose-row"
        >
          {conventional ? "Choose (interest-based)" : "Choose this"}
        </Button>
      )}
    </div>
  );
}

function OptionsTable({
  rows,
  chosenId,
  onChoose,
}: {
  rows: ComparisonRow[];
  chosenId: string | null;
  onChoose: (id: string) => void;
}) {
  return (
    <>
      {/* Phones: one block per option. */}
      <ul className="divide-y border-y sm:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn(
              "relative flex flex-col gap-2 py-3 pl-3",
              r.recommended && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
              !r.recommended &&
                r.id === chosenId &&
                "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-foreground",
              !isShariahRow(r) && "text-muted-foreground",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <OptionName r={r} />
              <RowChoice r={r} chosen={r.id === chosenId} onChoose={onChoose} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <dt className="text-muted-foreground">You pay</dt>
                <dd className="font-mono tabular-nums">{payText(r)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">True cost</dt>
                <dd className={cn("font-mono tabular-nums", r.recommended && "font-semibold text-primary")}>
                  {groupPKR(r.pvAfterTax)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cash left</dt>
                <dd className={cn("font-mono tabular-nums", runwayClass(r.runwayMonths))}>
                  {runwayText(r.runwayMonths)} mo
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="-mx-4 hidden border-y border-foreground/70 sm:block">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 pl-4">Option</TableHead>
              <TableHead className="h-10">You pay</TableHead>
              <TableHead className="h-10 text-right">
                <span className="inline-flex items-center gap-1">
                  True cost (today&apos;s money)
                  <HelpTip>{TRUE_COST_HELP}</HelpTip>
                </span>
              </TableHead>
              <TableHead className="h-10 text-right">
                <span className="inline-flex items-center gap-1">
                  Cash left (months)
                  <HelpTip>{CASH_LEFT_HELP}</HelpTip>
                </span>
              </TableHead>
              <TableHead className="h-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                data-recommended={r.recommended || undefined}
                data-chosen={r.id === chosenId || undefined}
                data-conventional={!isShariahRow(r) || undefined}
                className={cn(
                  "align-top",
                  !isShariahRow(r) && "text-muted-foreground",
                  (r.recommended || r.id === chosenId) && "bg-muted/40",
                )}
              >
                <TableCell
                  className={cn(
                    "relative py-3 pl-4 whitespace-normal",
                    r.recommended && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
                    !r.recommended &&
                      r.id === chosenId &&
                      "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-foreground",
                  )}
                >
                  <OptionName r={r} />
                </TableCell>
                <TableCell className="py-3 font-mono tabular-nums">{payText(r)}</TableCell>
                <TableCell className="py-3 text-right font-mono tabular-nums">
                  {/* The figure that decides it gets the accountant's double underline. */}
                  <span
                    className={cn(
                      r.recommended && "border-b-[3px] border-double border-primary pb-px font-semibold text-primary",
                    )}
                  >
                    {groupPKR(r.pvAfterTax)}
                  </span>
                </TableCell>
                <TableCell
                  className={cn("py-3 text-right font-mono font-medium tabular-nums", runwayClass(r.runwayMonths))}
                >
                  {runwayText(r.runwayMonths)}
                </TableCell>
                <TableCell className="py-3 pr-4">
                  <RowChoice r={r} chosen={r.id === chosenId} onChoose={onChoose} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// Inside "How we worked this out": both present values, the full verdict and the step-by-step calculation per row.
function DetailTable({
  rows,
  open,
  toggle,
}: {
  rows: ComparisonRow[];
  open: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto border-y">
      <Table className="min-w-[720px]" data-testid="detail-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 pl-4">Option</TableHead>
            <TableHead className="h-9 text-right">Total paid</TableHead>
            <TableHead className="h-9 text-right">PV before tax</TableHead>
            <TableHead className="h-9 text-right">PV after tax</TableHead>
            <TableHead className="h-9 pr-4">Why</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isOpen = open.has(r.id);
            return (
              <Fragment key={r.id}>
                <TableRow className="align-top">
                  <TableCell className="py-2.5 pl-4 whitespace-normal">
                    <div className="font-medium">{r.label}</div>
                    <Button
                      variant="link"
                      size="xs"
                      className="flex h-auto w-fit px-0"
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
                  <TableCell className="py-2.5 text-right font-mono tabular-nums">{groupPKR(r.totalPaid)}</TableCell>
                  <TableCell className="py-2.5 text-right font-mono tabular-nums">{groupPKR(r.pvBeforeTax)}</TableCell>
                  <TableCell className="py-2.5 text-right font-mono tabular-nums">{groupPKR(r.pvAfterTax)}</TableCell>
                  <TableCell className="py-2.5 pr-4 text-xs whitespace-normal text-muted-foreground">
                    {r.verdict}
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={5} className="px-4 py-4 whitespace-normal">
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
  );
}

function ExtraTiles({ decision, rec }: { decision: DecideResult; rec: ComparisonRow }) {
  const be = decision.breakEvenDiscountRate;
  return (
    <div className="grid gap-px overflow-hidden rounded-[2px] border bg-border md:grid-cols-2">
      <div className="flex flex-col gap-1.5 bg-card p-4">
        <div className="ledger-label">Cash left</div>
        <div className="flex items-baseline gap-2 font-mono text-xl font-medium tabular-nums">
          <span className="text-muted-foreground">{runwayText(decision.runwayToday)}</span>
          <span className="text-base text-muted-foreground">→</span>
          <span className={runwayClass(rec.runwayMonths)}>{runwayText(rec.runwayMonths)}</span>
          <span className="font-sans text-sm font-normal text-muted-foreground">months</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Today vs after {rec.label}. Counts no sales income, so it is a floor.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 bg-card p-4">
        <div className="ledger-label">Break-even discount rate</div>
        {be === null ? (
          <p className="text-sm text-muted-foreground">Not applicable: the recommended option is a cash payment.</p>
        ) : be === 0 ? (
          <p className="text-sm">{methodName(rec)} beats paying cash at any discount rate.</p>
        ) : (
          <>
            <div className="font-mono text-xl font-medium tabular-nums">{formatPct(be)}</div>
            <p className="text-xs text-muted-foreground">
              {methodName(rec)} beats paying cash for any discount rate above this (ours is{" "}
              <span className="font-mono tabular-nums">{formatPct(decision.company.discountRate)}</span>
              ).
            </p>
          </>
        )}
      </div>
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
  pv: { label: "True cost" },
} satisfies ChartConfig;

function PvChart({ rows }: { rows: ComparisonRow[] }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({
    label: r.label,
    pv: Math.round(r.pvAfterTax),
    recommended: r.recommended,
  }));
  return (
    <div className="h-full rounded-[2px] border p-4">
      <div className="ledger-label">True cost per option (lower is cheaper)</div>
      <ChartContainer
        config={chartConfig}
        className="mt-2 aspect-auto w-full"
        style={{ height: data.length * 44 + 40 }}
      >
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
                    <span className="text-muted-foreground">True cost</span>
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
        <label htmlFor="kibor-shift" className="ledger-label flex items-center gap-1">
          Stress test: KIBOR shift
          <HelpTip>KIBOR is the bank benchmark rate. Slide to see what happens if it rises.</HelpTip>
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
        <p className="text-sm text-muted-foreground">Move the slider to test higher rates.</p>
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

function Assumptions({
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
    <div className="grid gap-4 rounded-[2px] border p-4 md:grid-cols-[1fr_200px]">
      <div className="space-y-4">
        <div className="ledger-label">Assumptions</div>
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
    </div>
  );
}
