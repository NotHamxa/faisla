"use client";
// Payment-fraud check UI: the banner at the top of a decision, per-email badges, and the hook that feeds them.
// The rules live in lib/fraud.ts (code, not AI); this file only shows results and records phone confirmations.
import { useMemo } from "react";
import { PhoneCall, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { assessPaymentRisks, blockingRisks, type PaymentRisk } from "@/lib/fraud";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function usePaymentRisks() {
  const { state, update } = useStore();
  const risks = useMemo(
    () =>
      assessPaymentRisks({
        quotation: state.quotation,
        emails: state.emails,
        suppliers: state.suppliers,
        confirmations: state.paymentConfirmations,
      }),
    [state.quotation, state.emails, state.suppliers, state.paymentConfirmations],
  );
  const setConfirmed = (id: string, confirmed: boolean) =>
    update((s) => ({
      paymentConfirmations: confirmed
        ? [...new Set([...s.paymentConfirmations, id])]
        : s.paymentConfirmations.filter((x) => x !== id),
    }));
  return { risks, blocking: blockingRisks(risks), setConfirmed };
}

export function PaymentRiskBanner() {
  const { risks, setConfirmed } = usePaymentRisks();
  const shown = risks.filter((r) => r.level !== "low");
  if (!shown.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {shown.map((r) => (
        <RiskCard key={r.id} risk={r} onConfirm={(c) => setConfirmed(r.id, c)} />
      ))}
    </div>
  );
}

function RiskCard({ risk, onConfirm }: { risk: PaymentRisk; onConfirm: (confirmed: boolean) => void }) {
  const high = risk.level === "high";
  const tone = risk.confirmed
    ? "border-success/40 bg-success/5"
    : high
      ? "border-destructive/50 bg-destructive/5"
      : "border-warning/40 bg-warning/10";
  const Icon = risk.confirmed ? ShieldCheck : high ? ShieldAlert : TriangleAlert;
  return (
    <div role="alert" className={cn("rounded-xl border p-4 text-sm", tone)}>
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            risk.confirmed ? "text-success" : high ? "text-destructive" : "text-warning",
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {risk.confirmed
                ? `Payment details confirmed by phone: ${risk.supplierName}`
                : high
                  ? `Payment-fraud warning: ${risk.supplierName}`
                  : `Check payment details: ${risk.supplierName}`}
            </p>
            <RiskBadge risk={risk} />
          </div>
          {!risk.confirmed && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {risk.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {!risk.confirmed && high && (
            <p className="font-medium text-destructive">
              Do not pay. Payment and the bank term-sheet request are blocked until you confirm the account.
            </p>
          )}
          <label className="flex w-fit cursor-pointer items-center gap-2 pt-1">
            <Checkbox checked={risk.confirmed} onCheckedChange={(c) => onConfirm(Boolean(c))} />
            <PhoneCall className="size-3.5 text-muted-foreground" />
            <span>I confirmed this account by phone on a number I already had (not one from the email)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: PaymentRisk }) {
  if (risk.confirmed) return <Badge className="bg-success/10 text-success">Confirmed by phone</Badge>;
  if (risk.level === "high") return <Badge variant="destructive">High risk</Badge>;
  if (risk.level === "medium") return <Badge className="bg-warning/10 text-warning">Medium risk</Badge>;
  return <Badge variant="outline">Low risk</Badge>;
}
