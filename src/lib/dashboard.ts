// Dashboard figures for one company, built from its profile and decisions. Pure: no I/O, no AI.
// Every rupee here comes from finance.ts results already stored on the decisions.
import { assessPaymentRisks, blockingRisks } from "./fraud";
import {
  FINANCING_NAMES,
  hiddenMonthlyRate,
  isFinancedMethod,
  offerCashPrice,
  runwayMonths,
  SAFE_RUNWAY,
  yearlyFromMonthly,
} from "./finance";
import { formatLakh, formatPct } from "./format";
import type { CompanyRecord, ComparisonRow, DecisionRecord, DecisionStatus } from "./types";

export type DashboardKpis = {
  cashBalance: number;
  monthlyFixedCosts: number;
  runwayToday: number; // cash ÷ fixed costs
  runwayAfterCommitments: number; // after decided purchases' upfront + monthly payments
  committedUpfront: number;
  committedMonthly: number; // monthly payments of decided purchases still running
  savingsFoundAfterTax: number;
  savingsFoundBeforeTax: number;
  openDecisions: number;
  decidedCount: number;
};

export type UpcomingPayment = {
  decisionId: string;
  title: string;
  label: string; // "Islamic LTFF installment 2 of 36"
  dueDate: string; // ISO
  amount: number;
};

export type ProjectionPoint = {
  month: string; // "2026-11"
  label: string; // "Nov"
  committed: number; // payments due that month from decided purchases
  cashFloor: number; // cash left at month end with no sales income (a floor, not a forecast)
};

export type AlertLevel = "high" | "medium" | "info";

export type DashboardAlert = {
  level: AlertLevel;
  title: string;
  detail: string;
  href: string;
};

export type RecentDecision = {
  id: string;
  title: string;
  status: DecisionStatus;
  updatedAt: string;
  recommendedLabel: string | null;
  savingsAfterTax: number | null;
  savingsBeforeTax: number | null;
};

export type Dashboard = {
  kpis: DashboardKpis;
  upcomingPayments: UpcomingPayment[];
  cashProjection: ProjectionPoint[];
  alerts: DashboardAlert[];
  recentDecisions: RecentDecision[];
};

const DAY = 24 * 60 * 60 * 1000;
const QUOTE_EXPIRY_WARNING_DAYS = 5;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Calendar-month shift that keeps the day where possible (31 Jan + 1 → 28/29 Feb).
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes()));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function recommendedRow(d: DecisionRecord): ComparisonRow | null {
  const result = d.decision;
  if (!result) return null;
  return result.rows.find((r) => r.id === result.recommendedId) ?? result.rows.find((r) => r.recommended) ?? null;
}

// Short product name for alerts and payment labels ("Islamic LTFF", "Ijarah", "conventional loan").
function facilityName(row: ComparisonRow): string {
  if (row.method === "bank") return "conventional loan";
  if (row.method === "ltff") return "LTFF";
  return isFinancedMethod(row.method) ? FINANCING_NAMES[row.method] : "supplier";
}

function paymentName(row: ComparisonRow): string {
  if (row.method === "ijarah") return "Ijarah rental";
  if (isFinancedMethod(row.method)) return `${facilityName(row)} installment`;
  return "Installment";
}

// Every scheduled monthly payment of a decided purchase (upfront excluded: paid at delivery).
function paymentSchedule(d: DecisionRecord): UpcomingPayment[] {
  const row = recommendedRow(d);
  if (d.status !== "decided" || !row || row.months <= 0 || row.monthlyPayment <= 0) return [];
  const start = new Date(d.decidedAt ?? d.updatedAt);
  const offer = d.offers.find((o) => o.id === row.offerId);
  const onDelivery = row.method === "installments" && !!offer?.firstInstallmentOnDelivery;
  const first = onDelivery ? 0 : 1;
  const out: UpcomingPayment[] = [];
  for (let k = 0; k < row.months; k++) {
    out.push({
      decisionId: d.id,
      title: d.title,
      label: `${paymentName(row)} ${k + 1} of ${row.months}`,
      dueDate: addMonths(start, first + k).toISOString(),
      amount: row.monthlyPayment,
    });
  }
  return out;
}

// Effective yearly cost of paying later on each supplier deferred-price plan in a decision: from the comparison rows if computed, else from the offers.
function hiddenRates(d: DecisionRecord): { label: string; supplierName: string; rate: number }[] {
  if (d.decision) {
    return d.decision.rows
      .filter((r) => r.method === "installments" && r.hiddenYearlyRate !== null)
      .map((r) => ({ label: r.label, supplierName: r.supplierName, rate: r.hiddenYearlyRate! }));
  }
  return d.offers
    .filter((o) => (o.installmentMonths ?? 0) > 0 && (o.installmentAmount ?? 0) > 0)
    .map((o) => {
      const monthly = hiddenMonthlyRate(offerCashPrice(o), o.installmentAmount!, o.installmentMonths!, o.firstInstallmentOnDelivery);
      return { label: `${o.supplierName} deferred-price plan`, supplierName: o.supplierName, rate: yearlyFromMonthly(monthly) };
    });
}

function buildAlerts(decisions: DecisionRecord[], kpis: DashboardKpis, now: Date): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (kpis.decidedCount > 0 && kpis.runwayAfterCommitments < SAFE_RUNWAY) {
    alerts.push({
      level: "high",
      title: `Runway drops to ${kpis.runwayAfterCommitments.toFixed(1)} months`,
      detail: `Decided purchases leave less than ${SAFE_RUNWAY} months of fixed costs in the bank (no sales counted).`,
      href: "/settings",
    });
  }

  for (const d of decisions) {
    const href = `/decisions/${d.id}`;
    const open = d.status !== "decided";
    const rec = recommendedRow(d);

    // Payment-fraud check: unconfirmed high-risk payment emails come first.
    for (const risk of blockingRisks(
      assessPaymentRisks({ quotation: d.quotation, emails: d.emails, suppliers: d.suppliers, confirmations: d.paymentConfirmations }),
    )) {
      alerts.push({
        level: "high",
        title: `Payment-fraud warning: ${risk.supplierName}`,
        detail: `${d.title}: an email asks for payment to different bank details. Confirm by phone before paying.`,
        href: `${href}?step=offers`,
      });
    }

    if (open) {
      for (const plan of hiddenRates(d)) {
        if (plan.rate <= 0.005) continue;
        alerts.push({
          level: "high",
          title: `‘0%’ plan: paying later costs ${formatPct(plan.rate)} a year`,
          detail: `${d.title}: ${plan.supplierName}'s deferred-price plan costs more than paying cash.`,
          href,
        });
      }
    }

    // Reputation: every supplier in open decisions; only the chosen supplier once decided.
    for (const rep of Object.values(d.reputations)) {
      if (rep.flag !== "red" && rep.flag !== "mixed") continue;
      if (!open && rep.supplierName !== rec?.supplierName) continue;
      const who = rep.supplierName || rep.model || "Product";
      alerts.push({
        level: rep.flag === "red" ? "high" : "medium",
        title: rep.flag === "red" ? `Red flag on ${who}` : `Mixed reviews for ${who}`,
        detail: rep.reasons[0] ?? `${d.title}: check what other buyers say before paying.`,
        href,
      });
    }

    if (!open && rec && isFinancedMethod(rec.method)) {
      const asked = d.emails.some((e) => e.direction === "out" && /term sheet/i.test(e.subject));
      if (!asked) {
        const name = facilityName(rec);
        const rate = rec.method === "bank" || rec.method === "ltff" ? "rate" : rec.method === "ijarah" ? "rental" : "profit rate";
        alerts.push({
          level: "medium",
          title: `Request the ${name} term sheet`,
          detail: `${d.title}: the bank must confirm the ${name} ${rate}, fees, takaful and approval time.`,
          href,
        });
      }
    }

    const q = d.quotation;
    if (open && q?.quoteDate && q.validityDays) {
      const expires = new Date(new Date(`${q.quoteDate}T00:00:00Z`).getTime() + q.validityDays * DAY);
      const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / DAY);
      if (daysLeft <= QUOTE_EXPIRY_WARNING_DAYS) {
        alerts.push({
          level: daysLeft <= 1 ? "high" : "medium",
          title: daysLeft < 0 ? "Quotation has expired" : `Quotation expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          detail: `${d.title}: ${q.supplierName}'s prices were valid for ${q.validityDays} days.`,
          href,
        });
      }
    }

    if (d.status === "comparing" && rec) {
      alerts.push({
        level: "info",
        title: "Comparison ready to confirm",
        detail: `${d.title}: ${rec.label} leads on after-tax cost.`,
        href,
      });
    }
  }

  const order: Record<AlertLevel, number> = { high: 0, medium: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

export function buildDashboard(company: CompanyRecord, decisions: DecisionRecord[], now = new Date()): Dashboard {
  const decided = decisions.filter((d) => d.status === "decided");
  const schedules = decided.map(paymentSchedule).flat();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const future = schedules.filter((p) => new Date(p.dueDate) >= today);

  let committedUpfront = 0;
  let committedMonthly = 0;
  let savingsFoundAfterTax = 0;
  let savingsFoundBeforeTax = 0;
  for (const d of decided) {
    const rec = recommendedRow(d);
    if (rec) {
      committedUpfront += rec.upfront;
      // Only plans that still have payments ahead weigh on the monthly burn.
      if (future.some((p) => p.decisionId === d.id)) committedMonthly += rec.monthlyPayment;
    }
    savingsFoundAfterTax += d.decision?.savingsVsBaseline?.afterTax ?? 0;
    savingsFoundBeforeTax += d.decision?.savingsVsBaseline?.beforeTax ?? 0;
  }

  const kpis: DashboardKpis = {
    cashBalance: company.cashBalance,
    monthlyFixedCosts: company.monthlyFixedCosts,
    runwayToday: runwayMonths(company.cashBalance, 0, company.monthlyFixedCosts, 0),
    runwayAfterCommitments: runwayMonths(company.cashBalance, committedUpfront, company.monthlyFixedCosts, committedMonthly),
    committedUpfront,
    committedMonthly,
    savingsFoundAfterTax,
    savingsFoundBeforeTax,
    openDecisions: decisions.length - decided.length,
    decidedCount: decided.length,
  };

  const upcomingPayments = [...future].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);

  // Calendar months from this one: committed payments and the no-sales cash floor.
  const cashProjection: ProjectionPoint[] = [];
  let cash = company.cashBalance - committedUpfront;
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const key = monthKey(monthStart);
    const committed = future.filter((p) => monthKey(new Date(p.dueDate)) === key).reduce((s, p) => s + p.amount, 0);
    cash -= company.monthlyFixedCosts + committed;
    cashProjection.push({ month: key, label: MONTH_LABELS[monthStart.getUTCMonth()], committed, cashFloor: cash });
  }

  const recentDecisions: RecentDecision[] = [...decisions]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      updatedAt: d.updatedAt,
      recommendedLabel: recommendedRow(d)?.label ?? null,
      savingsAfterTax: d.decision?.savingsVsBaseline?.afterTax ?? null,
      savingsBeforeTax: d.decision?.savingsVsBaseline?.beforeTax ?? null,
    }));

  return { kpis, upcomingPayments, cashProjection, alerts: buildAlerts(decisions, kpis, now), recentDecisions };
}

// Short money label for chart axes: "15.2 lakh".
export function axisLakh(value: number): string {
  return value === 0 ? "0" : formatLakh(value);
}
