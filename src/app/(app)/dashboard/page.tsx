// Company dashboard: cash position, money found, what's due and what needs attention.
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FilePlus2,
  Info,
  PiggyBank,
  Timer,
  Wallet,
  ListChecks,
} from "lucide-react";
import { CashChart } from "@/components/dashboard/cash-chart";
import { LoadSampleButton } from "@/components/dashboard/load-sample-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadSampleData } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { buildDashboard, type AlertLevel, type DashboardAlert, type DashboardKpis, type UpcomingPayment } from "@/lib/dashboard";
import { SAFE_RUNWAY } from "@/lib/finance";
import { formatLakh, formatPKR } from "@/lib/format";
import { getCompany, listDecisions } from "@/lib/server/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard — Faisla" };

const TIME_ZONE = "Asia/Karachi";

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: TIME_ZONE }).format(new Date(iso));
}

function timeAgo(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  return formatDate(iso);
}

function months(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "∞";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [company, decisions] = await Promise.all([getCompany(user.companyId), listDecisions(user.companyId)]);
  if (!company) {
    return <p className="text-sm text-muted-foreground">Company profile not found. Sign out and sign in again.</p>;
  }
  const now = new Date();
  const dash = buildDashboard(company, decisions, now);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-foreground/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] leading-tight font-bold">
            {greeting(now)}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.name} · {company.city}
            {company.isExporter ? " · Exporter (Islamic LTFF eligible)" : ""} · figures as of {formatDate(now.toISOString())}
          </p>
        </div>
        {decisions.length > 0 && (
          <Button variant="outline" nativeButton={false} render={<Link href="/decisions" />}>
            All decisions
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>

      <KpiCards kpis={dash.kpis} />

      {decisions.length === 0 ? (
        <Card>
          <CardContent>
            <Empty className="border border-dashed border-foreground/25 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FilePlus2 />
                </EmptyMedia>
                <EmptyTitle className="text-base">No decisions yet</EmptyTitle>
                <EmptyDescription>
                  Upload a supplier&apos;s quotation and Faisla checks the market, finds other offers and compares every way to pay.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="sm:flex-row sm:justify-center">
                <Button nativeButton={false} render={<Link href="/decisions?new=1" />}>
                  <FilePlus2 data-icon="inline-start" />
                  Create your first decision
                </Button>
                <form action={loadSampleData}>
                  <LoadSampleButton />
                </form>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CashChart data={dash.cashProjection} monthlyFixedCosts={dash.kpis.monthlyFixedCosts} />
            </div>
            <AlertsCard alerts={dash.alerts} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <RecentDecisionsCard dash={dash} now={now} className="lg:col-span-2" />
            <UpcomingPaymentsCard payments={dash.upcomingPayments} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "warning" | "success";
  children?: React.ReactNode;
}) {
  // One cell of the statement strip; a warning cell carries an amber rule along its top edge.
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 bg-card px-4 pt-3.5 pb-4",
        tone === "warning" && "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-warning",
      )}
    >
      <div className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
        <Icon className={cn("size-3.5", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-muted-foreground")} />
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-[1.625rem] leading-none font-medium tabular-nums",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </div>
      <div className="mt-auto space-y-2 text-xs text-muted-foreground">
        {sub}
        {children}
      </div>
    </div>
  );
}

function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const tight = kpis.runwayAfterCommitments < SAFE_RUNWAY;
  // Runway meter: 6 months fills the bar; the tick marks the 2-month safety line.
  const meter = (m: number) => `${Math.max(0, Math.min(100, (Number.isFinite(m) ? m : 6) / 6 * 100))}%`;
  return (
    <div className="grid gap-px overflow-hidden rounded-[2px] border bg-border sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={Wallet}
        label="Cash in bank"
        value={formatPKR(kpis.cashBalance)}
        sub={
          <span>
            Fixed costs <span className="font-mono tabular-nums">{formatPKR(kpis.monthlyFixedCosts)}</span> a month
          </span>
        }
      />
      <KpiCard
        icon={Timer}
        label="Runway after commitments"
        tone={tight ? "warning" : "default"}
        value={
          <>
            {months(kpis.runwayAfterCommitments)}
            <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">months</span>
          </>
        }
      >
        <div className="relative h-1.5 overflow-hidden bg-foreground/10">
          <div className="absolute inset-y-0 left-0 bg-foreground/20" style={{ width: meter(kpis.runwayToday) }} />
          <div
            className={cn("absolute inset-y-0 left-0", tight ? "bg-warning" : "bg-primary")}
            style={{ width: meter(kpis.runwayAfterCommitments) }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: meter(SAFE_RUNWAY) }} />
        </div>
        <div className="flex justify-between gap-2">
          <span>
            Today <span className="font-mono text-foreground tabular-nums">{months(kpis.runwayToday)}</span> mo
          </span>
          <span className={cn(tight && "font-medium text-warning")}>{tight ? `Below ${SAFE_RUNWAY}-month safety line` : "No sales counted"}</span>
        </div>
      </KpiCard>
      <KpiCard
        icon={PiggyBank}
        label="Savings found (after tax)"
        tone={kpis.savingsFoundAfterTax > 0 ? "success" : "default"}
        value={formatPKR(kpis.savingsFoundAfterTax)}
        sub={
          <span>
            <span className="font-mono tabular-nums">{formatPKR(kpis.savingsFoundBeforeTax)}</span> before tax ·{" "}
            {kpis.decidedCount} decided
          </span>
        }
      />
      <KpiCard
        icon={ListChecks}
        label="Open decisions"
        value={kpis.openDecisions}
        sub={
          <Link href="/decisions" className="inline-flex items-center gap-1 hover:text-foreground">
            {kpis.openDecisions > 0 ? "Pick up where you left off" : "Nothing waiting"}
            <ArrowUpRight className="size-3" />
          </Link>
        }
      />
    </div>
  );
}

const ALERT_STYLE: Record<AlertLevel, { icon: React.ComponentType<{ className?: string }>; className: string; label: string }> = {
  high: { icon: AlertTriangle, className: "text-destructive", label: "High" },
  medium: { icon: CircleAlert, className: "text-warning", label: "Medium" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
};

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle>Alerts</CardTitle>
        <CardDescription>What needs your attention</CardDescription>
        {alerts.length > 0 && (
          <CardAction>
            <Badge variant="outline" className="font-mono tabular-nums">
              {alerts.length}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {alerts.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="size-6 text-success" />
            All clear. No costly deferred-price plans, red flags or expiring quotes.
          </div>
        ) : (
          <ul className="-mx-2 -my-1 divide-y">
            {alerts.slice(0, 6).map((alert, i) => {
              const style = ALERT_STYLE[alert.level];
              return (
                <li key={i}>
                  <Link href={alert.href} className="group flex gap-3 px-2 py-2.5 transition-colors hover:bg-muted">
                    <div className={cn("flex size-5 shrink-0 items-start justify-center pt-0.5", style.className)}>
                      <style.icon className="size-4" />
                      <span className="sr-only">{style.label}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm leading-snug font-medium">{alert.title}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{alert.detail}</div>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingPaymentsCard({ payments }: { payments: UpcomingPayment[] }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle>Upcoming payments</CardTitle>
        <CardDescription>From decided purchases</CardDescription>
        <CardAction>
          <CalendarClock className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {payments.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
            No installments or rentals scheduled.
          </div>
        ) : (
          <ul className="divide-y">
            {payments.map((p) => (
              <li key={`${p.decisionId}-${p.dueDate}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r py-0.5 pr-2 leading-none">
                  <span className="text-[0.6875rem] font-medium text-muted-foreground">{formatDate(p.dueDate, { month: "short" })}</span>
                  <span className="font-mono text-base font-semibold tabular-nums">{formatDate(p.dueDate, { day: "numeric" })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.label}</div>
                  <Link href={`/decisions/${p.decisionId}`} className="block truncate text-xs text-muted-foreground hover:text-foreground">
                    {p.title}
                  </Link>
                </div>
                <div className="font-mono text-sm font-medium tabular-nums">{formatPKR(p.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {payments.length > 0 && (
        <CardFooter className="rule-top-double justify-between border-t-0 bg-card text-xs text-muted-foreground">
          <span>Next {payments.length} payments</span>
          <span className="font-mono font-medium text-foreground tabular-nums">{formatPKR(total)}</span>
        </CardFooter>
      )}
    </Card>
  );
}

function RecentDecisionsCard({ dash, now, className }: { dash: ReturnType<typeof buildDashboard>; now: Date; className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="border-b">
        <CardTitle>Recent decisions</CardTitle>
        <CardDescription>Latest activity across your purchases</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/decisions" />}>
            View all
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="-mt-(--card-spacing) px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Decision</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Best option</TableHead>
              <TableHead className="text-right">Saved (after tax)</TableHead>
              <TableHead className="hidden pr-4 text-right lg:table-cell">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dash.recentDecisions.map((d) => (
              <TableRow key={d.id} className="group">
                <TableCell className="max-w-56 pl-4">
                  <Link href={`/decisions/${d.id}`} className="block truncate font-medium hover:underline">
                    {d.title}
                  </Link>
                  <StatusBadge status={d.status} className="mt-1 sm:hidden" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{d.recommendedLabel ?? "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {d.savingsAfterTax !== null && d.savingsAfterTax > 0 ? (
                    <span className="text-success" title={formatPKR(d.savingsAfterTax)}>
                      {formatLakh(d.savingsAfterTax)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden pr-4 text-right text-muted-foreground lg:table-cell">{timeAgo(d.updatedAt, now)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
