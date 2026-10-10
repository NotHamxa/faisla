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
  // A ruled notice: hairline frame, a heavy bar on the left in the risk colour, no tinted wash.
  const tone = risk.confirmed
    ? "border-success/45 border-l-success"
    : high
      ? "border-destructive/60 border-l-destructive"
      : "border-warning/55 border-l-warning";
  const Icon = risk.confirmed ? ShieldCheck : high ? ShieldAlert : TriangleAlert;
  return (
    <div role="alert" className={cn("rounded-[2px] border border-l-[5px] bg-card px-4 py-3.5 text-sm", tone)}>
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            risk.confirmed ? "text-success" : high ? "text-destructive" : "text-warning",
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-[0.9375rem] font-bold">
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
            <p className="border-t border-destructive/30 pt-2 font-semibold text-destructive">
              Do not pay. Payment and the bank term-sheet request are blocked until you confirm the account.
            </p>
          )}
          <label className="flex w-fit cursor-pointer items-start gap-2 pt-1 sm:items-center">
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
  if (risk.confirmed) return <Badge variant="success">Confirmed by phone</Badge>;
  if (risk.level === "high") return <Badge className="bg-destructive text-white">High risk</Badge>;
  if (risk.level === "medium") return <Badge variant="warning">Medium risk</Badge>;
  return <Badge variant="muted">Low risk</Badge>;
}
