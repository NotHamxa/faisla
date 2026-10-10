"use client";
// M3: is the quoted price fair? Quoted unit price vs the simulated benchmark median and cleaned web
// prices. Runs automatically once a quotation is confirmed; every number comes from /api/market (code).
import { useCallback, useEffect, useState } from "react";
import { DEMO_MODEL } from "@/lib/demoData";
import { formatPKR, formatPct } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { MarketPrice, MarketResult } from "@/lib/types";

type TaggedPrice = MarketPrice & { simulated?: boolean };

export default function MarketCard() {
  const { state, update } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = state.quotation?.items[0] ?? null;
  const model = item?.model || DEMO_MODEL;
  const quotedUnitPrice = item?.unitPrice ?? null;
  const market = state.market;
  const stale = market !== null && (market.model !== model || market.quotedUnitPrice !== quotedUnitPrice);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, quotedUnitPrice }),
      });
      if (!res.ok) throw new Error(`Market check failed (${res.status})`);
      update({ market: (await res.json()) as MarketResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Market check failed");
    } finally {
      setLoading(false);
    }
  }, [model, quotedUnitPrice, update]);

  // Auto-run once the quotation is confirmed (and again if its model/price changed).
  useEffect(() => {
    if (!state.quotationConfirmed || !state.quotation || loading || error) return;
    if (market && !stale) return;
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [state.quotationConfirmed, state.quotation, market, stale, loading, error, run]);

  if (!state.quotationConfirmed || !state.quotation) {
    return (
      <section className="card">
        <h2 className="card-title">Market price</h2>
        <p className="card-sub mt-1">Confirm the quotation first. Faisla then compares its price with the market.</p>
      </section>
    );
  }

  const pct = market?.pctAboveMarket ?? null;
  const webPrices = (market?.webPrices ?? []) as TaggedPrice[];
  const anySimulated = webPrices.some((p) => p.simulated);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="card-title">Market price</h2>
          <p className="card-sub">{model}: quoted price vs what others pay</p>
        </div>
        <button className="btn-ghost" onClick={() => void run()} disabled={loading}>
          {loading ? "Checking…" : market ? "Re-check" : "Check market price"}
        </button>
      </div>

      {error && <p className="badge-bad whitespace-normal rounded-md py-1">{error}</p>}
      {loading && !market && <p className="card-sub">Checking cached web prices and the benchmark…</p>}

      {market && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {pct !== null ? (
              <>
                <span className={`num text-3xl font-bold ${pct > 0.05 ? "text-warn" : pct <= 0 ? "text-good" : "text-ink"}`}>
                  ~{formatPct(Math.abs(pct), 0)} {pct >= 0 ? "above" : "below"} market
                </span>
                <span className={pct > 0.05 ? "badge-warn" : pct <= 0 ? "badge-good" : "badge-muted"}>
                  {pct > 0.05 ? "Overpriced" : pct <= 0 ? "Fair price" : "Close to market"}
                </span>
              </>
            ) : (
              <span className="badge-muted">Not enough market data</span>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Quoted (per unit)" value={market.quotedUnitPrice} />
            <Stat
              label="Benchmark median"
              value={market.benchmarkMedian}
              hint={market.benchmarkCount ? `Simulated benchmark (${market.benchmarkCount} rows)` : "No benchmark"}
            />
            <Stat
              label="Web median"
              value={market.webMedian}
              hint={market.enoughData ? `${webPrices.length} listings` : "Not enough market data"}
            />
          </dl>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="label mb-0">Web prices (new, exact model)</h3>
              {anySimulated && <span className="badge-muted">simulated listings</span>}
            </div>
            {webPrices.length === 0 ? (
              <p className="card-sub">No usable web prices found.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {webPrices.map((p, i) => (
                  <li key={`${p.url}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-brand hover:underline">
                        {p.seller}
                      </a>
                      {p.title && <p className="truncate text-xs text-muted">{p.title}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.simulated && <span className="badge-muted">simulated</span>}
                      <span className="num">{formatPKR(p.price)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted">
            {market.cached ? "From cached search results. " : "Live search. "}
            {market.note}
            {" "}% above market = quoted ÷ benchmark median − 1, computed in code.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <dt className="label">{label}</dt>
      <dd className="num text-base font-semibold">{value != null ? formatPKR(value) : "—"}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
