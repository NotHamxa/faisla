"use client";
// M3: is the quoted price fair? Quoted unit price vs the simulated benchmark median and cleaned web
// prices. Runs automatically once a quotation is confirmed; every number comes from /api/market (code).
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, ExternalLink, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Details } from "@/components/simple";
import { DEMO_MODEL } from "@/lib/demoData";
import { formatPKR, formatPct } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { MarketPrice, MarketResult } from "@/lib/types";
import { cn } from "@/lib/utils";

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
      <Card>
        <CardHeader>
          <CardTitle>Market price</CardTitle>
          <CardDescription>Confirm the quotation first.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pct = market?.pctAboveMarket ?? null;
  const webPrices = (market?.webPrices ?? []) as TaggedPrice[];
  const anySimulated = webPrices.some((p) => p.simulated);
  const tone = pct === null ? "muted" : pct > 0.05 ? "warn" : pct <= 0 ? "good" : "neutral";
  const typical = market?.benchmarkMedian ?? market?.webMedian ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market price</CardTitle>
        <CardDescription>{model}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void run()}
            disabled={loading}
          >
            {loading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {loading ? "Checking…" : market ? "Re-check" : "Check market price"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {loading && !market && (
          <div className="flex flex-col gap-3" aria-label="Checking market prices">
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        )}

        {market && (
          <>
            {pct !== null ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={tone === "warn" ? "warning" : tone === "good" ? "success" : "muted"}>
                    {tone === "warn" ? "Overpriced" : tone === "good" ? "Fair price" : "Close to market"}
                  </Badge>
                </div>
                <p
                  className={cn(
                    "flex items-start gap-2 font-heading text-xl leading-snug font-bold sm:text-2xl",
                    tone === "warn" && "text-warning",
                    tone === "good" && "text-success",
                  )}
                  data-testid="market-sentence"
                >
                  {pct >= 0 ? (
                    <TrendingUp className="mt-1 size-6 shrink-0" />
                  ) : (
                    <TrendingDown className="mt-1 size-6 shrink-0" />
                  )}
                  <span>
                    This price is about {formatPct(Math.abs(pct), 0)} {pct >= 0 ? "above" : "below"} the market
                  </span>
                </p>
                {typical != null && market.quotedUnitPrice != null && (
                  <p className="text-sm text-muted-foreground">
                    Quoted{" "}
                    <span className="font-mono text-foreground tabular-nums">{formatPKR(market.quotedUnitPrice)}</span>{" "}
                    each; others pay about{" "}
                    <span className="font-mono text-foreground tabular-nums">{formatPKR(typical)}</span>.
                  </p>
                )}
              </div>
            ) : (
              <Badge variant="secondary">Not enough market data</Badge>
            )}

            <Details
              title="See prices"
              hint={webPrices.length ? `${webPrices.length} listings` : undefined}
              className="-mb-4"
            >
              <div className="flex flex-col gap-3">
                {market.benchmarkMedian != null && market.webMedian != null && market.quotedUnitPrice != null && (
                  <p className="text-xs text-muted-foreground" data-testid="web-median-pct">
                    ~{formatPct(Math.abs(market.quotedUnitPrice / market.webMedian - 1), 0)}{" "}
                    {market.quotedUnitPrice >= market.webMedian ? "above" : "below"} the real web median
                  </p>
                )}
                <div className="@container">
                  <dl className="grid grid-cols-1 gap-3 @md:grid-cols-3">
                    <Stat label="Quoted (each)" value={market.quotedUnitPrice} />
                    <Stat
                      label="Benchmark median"
                      value={market.benchmarkMedian}
                      hint={
                        market.benchmarkCount ? `Simulated benchmark (${market.benchmarkCount} rows)` : "No benchmark"
                      }
                    />
                    <Stat
                      label="Web median"
                      value={market.webMedian}
                      hint={market.enoughData ? `${webPrices.length} listings` : "Not enough market data"}
                    />
                  </dl>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Web prices (new, exact model)</h3>
                  {anySimulated && <Badge variant="outline">simulated listings</Badge>}
                </div>
                {webPrices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No usable web prices found.</p>
                ) : (
                  <ul className="divide-y rounded-[2px] border">
                    {webPrices.map((p, i) => (
                      <li key={`${p.url}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                          >
                            <span className="truncate">{p.seller}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                          {p.title && <p className="truncate text-xs text-muted-foreground">{p.title}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {p.simulated && (
                            <Badge variant="outline" className="text-muted-foreground">
                              simulated
                            </Badge>
                          )}
                          <span className="font-mono tabular-nums">{formatPKR(p.price)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted-foreground">
                  {market.cached ? "From cached search results. " : "Live search. "}
                  {market.note} % above market = quoted ÷ benchmark median − 1, computed in code.
                </p>
              </div>
            </Details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="rounded-[2px] border bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums">{value != null ? formatPKR(value) : "—"}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
