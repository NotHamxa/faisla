"use client";
// S2: what other buyers say. Reviews of every offer's supplier and of the machine model, scored by
// code (lib/reputation.ts). Stored in state.reputations keyed by supplier name; the model's entry is
// keyed by the model name. Red flags feed the memo's risks and never change the money figures.
import { useEffect, useRef, useState } from "react";
import { DEMO_MODEL } from "@/lib/demoData";
import { useStore } from "@/lib/store";
import type { ReputationFlag, ReputationResult } from "@/lib/types";

type Subject = { key: string; supplierName: string; model: string | null; kind: "Supplier" | "Machine model" };

const FLAG_BADGE: Record<ReputationFlag, { cls: string; text: string }> = {
  good: { cls: "badge-good", text: "Good" },
  mixed: { cls: "badge-warn", text: "Mixed" },
  red: { cls: "badge-bad", text: "Red flags" },
  not_enough: { cls: "badge-muted", text: "Not enough reviews" },
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
      <section className="card">
        <h2 className="card-title">Reputation</h2>
        <p className="card-sub mt-1">Confirm the quotation first. Faisla then checks what other buyers say.</p>
      </section>
    );
  }

  const anyRed = subjects.some((s) => state.reputations[s.key]?.flag === "red");

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="card-title">Reputation</h2>
        <p className="card-sub">Reviews of each supplier and the machine, scored by fixed rules</p>
      </div>

      <ul className="space-y-3">
        {subjects.map((s) => {
          const rep = state.reputations[s.key];
          const simulated = rep ? ((rep as ReputationResult & { simulated?: boolean }).simulated ?? rep.cached) : false;
          return (
            <li key={s.key} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{s.kind}</p>
                  <p className="font-medium">{s.supplierName || s.model}</p>
                </div>
                <div className="flex items-center gap-2">
                  {simulated && <span className="badge-muted">simulated reviews</span>}
                  {rep ? (
                    <span className={FLAG_BADGE[rep.flag].cls}>{FLAG_BADGE[rep.flag].text}</span>
                  ) : failed[s.key] ? (
                    <span className="badge-muted">Unavailable</span>
                  ) : (
                    <span className="badge-muted">Checking…</span>
                  )}
                </div>
              </div>

              {rep && (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="text-muted">
                    {rep.averageRating != null && (
                      <span className="num mr-2 font-semibold text-ink">★ {rep.averageRating.toFixed(1)} / 5</span>
                    )}
                    {rep.reasons.join(" ")}
                  </p>
                  {rep.reviews.length > 0 && (
                    <ul className="space-y-1">
                      {pickQuotes(rep).map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted">“</span>
                          <span className="min-w-0">
                            {r.quote}{" "}
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                              source
                            </a>
                            {r.complaintType !== "none" && (
                              <span className={`ml-2 ${["delivery", "warranty", "fraud"].includes(r.complaintType) ? "badge-warn" : "badge-muted"}`}>
                                {r.complaintType}
                              </span>
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
        <p className="badge-bad whitespace-normal rounded-md py-1">
          Red flags are listed as risks in the memo. They do not change the money figures.
        </p>
      )}
      <p className="text-xs text-muted">
        Rules: fewer than 3 reviews → not enough; any fraud, average below 3, or 3+ delivery/warranty/fraud complaints → red flags;
        average 4+ with at most 1 such complaint → good; otherwise mixed.
      </p>
    </section>
  );
}

// Up to 3 quotes: complaints first (they explain the flag), then the best-rated praise.
function pickQuotes(rep: ReputationResult) {
  const complaints = rep.reviews.filter((r) => r.complaintType !== "none");
  const praise = rep.reviews.filter((r) => r.complaintType === "none").sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return [...complaints.slice(0, 2), ...praise].slice(0, 3);
}
