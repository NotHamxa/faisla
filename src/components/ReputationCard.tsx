"use client";
// S2: what other buyers say. Reviews of every offer's supplier and of the machine model, scored by
// code (lib/reputation.ts). Stored in state.reputations keyed by supplier name; the model's entry is
// keyed by the model name. Red flags feed the memo's risks and never change the money figures.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, ShieldAlert, Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DEMO_MODEL } from "@/lib/demoData";
import { useStore } from "@/lib/store";
import type { ReputationFlag, ReputationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Subject = { key: string; supplierName: string; model: string | null; kind: "Supplier" | "Machine model" };

const FLAG_BADGE: Record<ReputationFlag, { cls: string; text: string }> = {
  good: { cls: "bg-success/10 text-success", text: "Good" },
  mixed: { cls: "bg-warning/10 text-warning", text: "Mixed" },
  red: { cls: "bg-destructive/10 text-destructive", text: "Red flags" },
  not_enough: { cls: "bg-secondary text-secondary-foreground", text: "Not enough reviews" },
};

export default function ReputationCard() {
  const { state, update } = useStore();
  const inFlight = useRef(new Set<string>());
  const [failed, setFailed] = useState<Record<string, string>>({});

  const model = state.quotation?.items[0]?.model || state.offers[0]?.model || DEMO_MODEL;
  const subjects: Subject[] = [];
  for (const o of state.offers) {
    if (!subjects.some((s) => s.key === o.supplierName)) {
      subjects.push({ key: o.supplierName, supplierName: o.supplierName, model: o.model, kind: "Supplier" });
    }
  }
  if (subjects.length) subjects.push({ key: model, supplierName: "", model, kind: "Machine model" });
  const missingKey = subjects
    .filter((s) => !state.reputations[s.key] && !failed[s.key])
    .map((s) => s.key)
    .join("|");

  // Fetch reviews for any supplier/model not yet in the store.
  useEffect(() => {
    if (!missingKey) return;
    for (const s of subjects) {
      if (!missingKey.split("|").includes(s.key) || inFlight.current.has(s.key)) continue;
      inFlight.current.add(s.key);
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName: s.supplierName, model: s.model }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Reviews failed (${res.status})`);
          const result = (await res.json()) as ReputationResult;
          update((st) => ({ reputations: { ...st.reputations, [s.key]: result } }));
        })
        .catch((e: unknown) => setFailed((f) => ({ ...f, [s.key]: e instanceof Error ? e.message : "Failed" })))
        .finally(() => inFlight.current.delete(s.key));
    }
    // subjects is derived from state.offers; missingKey captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, update]);

  if (subjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reputation</CardTitle>
          <CardDescription>Confirm the quotation first. Faisla then checks what other buyers say.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const anyRed = subjects.some((s) => state.reputations[s.key]?.flag === "red");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reputation</CardTitle>
        <CardDescription>Reviews of each supplier and the machine, scored by fixed rules</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {subjects.map((s) => {
            const rep = state.reputations[s.key];
            const simulated = rep ? ((rep as ReputationResult & { simulated?: boolean }).simulated ?? rep.cached) : false;
            return (
              <li key={s.key} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{s.kind}</p>
                    <p className="truncate font-medium">{s.supplierName || s.model}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {simulated && (
                      <Badge variant="outline" className="text-muted-foreground">
                        simulated reviews
                      </Badge>
                    )}
                    {rep ? (
                      <Badge className={FLAG_BADGE[rep.flag].cls}>{FLAG_BADGE[rep.flag].text}</Badge>
                    ) : failed[s.key] ? (
                      <Badge variant="secondary" title={failed[s.key]}>
                        Unavailable
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Spinner />
                        Checking…
                      </Badge>
                    )}
                  </div>
                </div>

                {!rep && !failed[s.key] && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                )}

                {rep && (
                  <div className="mt-2 flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">
                      {rep.averageRating != null && (
                        <span className="mr-2 inline-flex items-center gap-1 font-mono font-semibold text-foreground tabular-nums">
                          <Star className="size-3.5 fill-warning text-warning" />
                          {rep.averageRating.toFixed(1)} / 5
                        </span>
                      )}
                      {rep.reasons.join(" ")}
                    </p>
                    {rep.reviews.length > 0 && (
                      <ul className="flex flex-col gap-2">
                        {pickQuotes(rep).map((r, i) => (
                          <li key={i} className="border-l-2 pl-3 text-sm">
                            <span className="italic">&ldquo;{r.quote}&rdquo;</span>{" "}
                            <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                source
                                <ExternalLink className="size-3" />
                              </a>
                              {r.complaintType !== "none" && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    ["delivery", "warranty", "fraud"].includes(r.complaintType)
                                      ? "border-warning/30 bg-warning/10 text-warning"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {r.complaintType}
                                </Badge>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {anyRed && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertDescription className="text-destructive">
              Red flags are listed as risks in the memo. They do not change the money figures.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Rules: fewer than 3 reviews → not enough; any fraud, average below 3, or 3+ delivery/warranty/fraud complaints → red
        flags; average 4+ with at most 1 such complaint → good; otherwise mixed.
      </CardFooter>
    </Card>
  );
}

// Up to 3 quotes: complaints first (they explain the flag), then the best-rated praise.
function pickQuotes(rep: ReputationResult) {
  const complaints = rep.reviews.filter((r) => r.complaintType !== "none");
  const praise = rep.reviews.filter((r) => r.complaintType === "none").sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return [...complaints.slice(0, 2), ...praise].slice(0, 3);
}
