"use client";
// Step 1 for a decision that starts from a need: the owner describes what they need in plain words,
// Faisla searches the web and reads listings (AI), code filters and ranks them, and the owner ticks
// 1–3 options that become offers. Prices are copied from listings; every total is qty × unit price in code.
import { useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, ExternalLink, Mail, Pencil, Phone, Search, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatLakh, formatPKR, groupPKR } from "@/lib/format";
import {
  budgetFit,
  MAX_SELECTED_OPTIONS,
  needToQuotation,
  optionToOffer,
  optionTotal,
  selectedOptions,
  type SourcingResponse,
  WEB_OFFER_PREFIX,
} from "@/lib/sourcing";
import { useStore } from "@/lib/store";
import type { NeedsOwnerInput, SourcedOption, SourcingResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "auto" | "form" | "results";
type SourcingApiResponse = SourcingResponse | NeedsOwnerInput | { error: string };

const REQUEST_TIMEOUT_MS = 75_000;

const EXAMPLES = [
  {
    label: "4 pattern sewing machines (demo)",
    text: "4 computer-controlled pattern sewing machines for my garment factory in Faisalabad, budget around 60 lakh",
  },
  { label: "2 embroidery machines", text: "2 industrial embroidery machines for Lahore, budget 20 lakh" },
  { label: "10 lockstitch machines", text: "10 single needle lockstitch sewing machines with servo motors, budget 6 lakh" },
];

export default function NeedStep() {
  const { state, update } = useStore();
  const sourcing = state.sourcing;
  const [view, setView] = useState<View>("auto");
  const [need, setNeed] = useState(sourcing?.request.need ?? "");
  const [qty, setQty] = useState<string>(sourcing?.request.qty ? String(sourcing.request.qty) : "");
  const [city, setCity] = useState(sourcing?.request.city ?? state.company.city);
  const [budget, setBudget] = useState<number>(sourcing?.request.budgetPkr ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(sourcing?.selectedIds ?? []);

  async function search() {
    const clean = need.trim();
    if (clean.length < 3 || loading) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const qtyNumber = parseInt(qty, 10);
      const res = await fetch("/api/sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          need: clean,
          qty: qtyNumber > 0 ? qtyNumber : null,
          city: city.trim() || null,
          budget: budget > 0 ? budget : null,
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as SourcingApiResponse | null;
      if (data && "options" in data) {
        const result: SourcingResult = { ...data, selectedIds: [] };
        update({ sourcing: result });
        setPicked([]);
        setView("results");
        toast.success(result.options.length ? `Found ${result.options.length} options` : "No usable listings found");
      } else if (data && "needsOwnerInput" in data) setError(data.reason);
      else if (data && "error" in data) setError(data.error);
      else setError(`Search failed (${res.status}). Try again, or upload a quotation instead.`);
    } catch {
      setError("The search took too long. Try again, or upload a quotation instead.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function applySelection(result: SourcingResult) {
    const chosen = selectedOptions(result.options, picked);
    if (!chosen.length) return;
    const ids = chosen.map((o) => o.id);
    // Same selection as before: keep the existing offers, comparison and memo.
    if (state.quotationConfirmed && ids.join() === result.selectedIds.join()) {
      setView("auto");
      return;
    }
    const webOffers = chosen.map((o, i) => optionToOffer(o, result.request.qty, i));
    update((s) => ({
      sourcing: { ...result, selectedIds: ids },
      quotation: needToQuotation(chosen[0], result.request),
      quotationConfirmed: true,
      // Replace earlier web offers (the selection may have changed); keep email replies.
      offers: [...webOffers, ...s.offers.filter((o) => !o.id.startsWith(WEB_OFFER_PREFIX))],
      decision: null,
      memo: null,
    }));
    setView("auto");
    toast.success(`${chosen.length} offer${chosen.length > 1 ? "s" : ""} added`, {
      description: "Faisla is checking the market price and reputation next.",
    });
  }

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SELECTED_OPTIONS ? p : [...p, id]));
  }

  const chosenView = view === "auto" && state.quotationConfirmed && sourcing && sourcing.selectedIds.length > 0;
  if (chosenView) {
    return (
      <ChosenSummary
        sourcing={sourcing}
        onChange={() => {
          setPicked(sourcing.selectedIds);
          setView("results");
        }}
      />
    );
  }

  if (sourcing && (view === "results" || view === "auto")) {
    return (
      <Results
        sourcing={sourcing}
        picked={picked}
        onToggle={togglePick}
        onUse={() => applySelection(sourcing)}
        onEdit={() => setView("form")}
        onCancel={state.quotationConfirmed && sourcing.selectedIds.length > 0 ? () => setView("auto") : undefined}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you need?</CardTitle>
        <CardDescription>
          Describe it in your own words. Faisla searches the web, reads the listings, and you pick the offers to compare.
        </CardDescription>
        {sourcing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setView("results")} disabled={loading}>
              Back to results
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="need-text">Your need</FieldLabel>
          <Textarea
            id="need-text"
            rows={3}
            maxLength={600}
            className="min-h-20"
            placeholder="e.g. 4 computer-controlled pattern sewing machines for my garment factory in Faisalabad, budget around 60 lakh"
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void search();
            }}
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Button
                key={ex.label}
                type="button"
                variant="outline"
                size="xs"
                className="text-muted-foreground"
                onClick={() => setNeed(ex.text)}
                disabled={loading}
              >
                {ex.label.includes("demo") && <Sparkles data-icon="inline-start" />}
                {ex.label}
              </Button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="need-qty">How many</FieldLabel>
            <Input
              id="need-qty"
              inputMode="numeric"
              className="font-mono tabular-nums placeholder:font-sans"
              placeholder="From your text"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="need-city">City</FieldLabel>
            <Input id="need-city" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="need-budget">Budget (total, optional)</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                Rs
              </span>
              <Input
                id="need-budget"
                className="pl-8 font-mono tabular-nums placeholder:font-sans"
                inputMode="numeric"
                placeholder="From your text"
                value={budget ? groupPKR(budget) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setBudget(digits ? Number(digits) : 0);
                }}
              />
            </div>
            <FieldDescription className="text-xs">{budget > 0 ? `= ${formatLakh(budget, 2)}` : " "}</FieldDescription>
          </Field>
        </div>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void search()} disabled={need.trim().length < 3 || loading}>
            {loading ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
            {loading ? "Searching…" : "Find options"}
          </Button>
          {loading && (
            <span className="text-sm text-muted-foreground" role="status">
              Searching the web and reading listings…
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Results ---------- */

function Results(props: {
  sourcing: SourcingResult;
  picked: string[];
  onToggle: (id: string) => void;
  onUse: () => void;
  onEdit: () => void;
  onCancel?: () => void;
}) {
  const { sourcing: s, picked } = props;
  const req = s.request;
  const pickedCount = selectedOptions(s.options, picked).length;

  return (
    <div className="flex flex-col gap-5">
      <Card size="sm">
        <CardHeader>
          <CardTitle>What Faisla understood</CardTitle>
          <CardDescription className="line-clamp-2">&ldquo;{req.need}&rdquo;</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={props.onEdit}>
              <Pencil data-icon="inline-start" />
              Edit need
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Fact label="Item" value={req.item} />
            <Fact label="How many" value={<span className="font-mono tabular-nums">{req.qty}</span>} />
            <Fact
              label="Budget"
              value={
                req.budgetPkr ? (
                  <span className="font-mono tabular-nums" title={formatLakh(req.budgetPkr, 2)}>
                    {formatPKR(req.budgetPkr)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not given</span>
                )
              }
            />
            <Fact label="City" value={req.city ?? <span className="text-muted-foreground">Any</span>} />
          </dl>
          {req.modelCandidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Models:
              {req.modelCandidates.map((m) => (
                <Badge key={m} variant="secondary">
                  {m}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Searched:
            {req.searchQueries.map((q) => (
              <Badge key={q} variant="outline" className="font-mono font-normal text-muted-foreground">
                {q}
              </Badge>
            ))}
            <span>· {s.cached ? "from cached search results" : "live web search"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Options found</CardTitle>
            <Badge variant="secondary" className="font-mono tabular-nums">
              {s.options.length}
            </Badge>
            {s.simulated && <Badge variant="outline">simulated listings</Badge>}
          </div>
          <CardDescription>
            Tick 1–{MAX_SELECTED_OPTIONS} options to compare. Each becomes an offer; you can still ask other suppliers later.
          </CardDescription>
          {props.onCancel && (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={props.onCancel}>
                Cancel
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <MedianLine sourcing={s} />

          {s.options.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No usable listings: none had a written PKR price for a new, matching machine. Edit the need and try other
              words, or switch to uploading a quotation.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.options.map((o) => (
                <OptionCard
                  key={o.id}
                  option={o}
                  qty={req.qty}
                  budget={req.budgetPkr}
                  checked={picked.includes(o.id)}
                  disabled={!picked.includes(o.id) && pickedCount >= MAX_SELECTED_OPTIONS}
                  onToggle={() => props.onToggle(o.id)}
                />
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            {s.note ? `${s.note} ` : ""}
            Prices are copied from the listings (AI reads, code checks the number is written there); totals = quantity ×
            unit price, computed in code.
          </p>
        </CardContent>
        {s.options.length > 0 && (
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground tabular-nums">{pickedCount}</span> of {MAX_SELECTED_OPTIONS} selected
            </span>
            <Button onClick={props.onUse} disabled={pickedCount === 0}>
              <CircleCheck data-icon="inline-start" />
              Use selected as offers
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}

function MedianLine({ sourcing: s }: { sourcing: SourcingResult }) {
  if (!s.options.length) return null;
  if (!s.enoughData || s.medianUnitPrice == null) {
    return (
      <p className="text-sm">
        <Badge variant="secondary">Not enough market data</Badge>{" "}
        <span className="text-muted-foreground">Fewer than 3 usable prices, so no market median.</span>
      </p>
    );
  }
  return (
    <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      Median of {s.options.length} listings:{" "}
      <span className="font-mono font-semibold text-foreground tabular-nums">{formatPKR(s.medianUnitPrice)}</span> per unit
      {s.minUnitPrice != null && (
        <>
          {" "}
          · lowest <span className="font-mono text-foreground tabular-nums">{formatPKR(s.minUnitPrice)}</span>
        </>
      )}
    </p>
  );
}

function OptionCard(props: {
  option: SourcedOption;
  qty: number;
  budget: number | null;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { option: o, qty } = props;
  const total = optionTotal(o, qty);
  const fit = budgetFit(total, props.budget);
  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border p-3 transition-colors",
        props.checked ? "border-primary bg-primary/5" : "bg-card",
        props.disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40",
      )}
      onClick={() => !props.disabled && props.onToggle()}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={() => props.onToggle()}
          aria-label={`Select ${o.seller}`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="truncate font-medium">{o.seller}</p>
            <p className="truncate text-xs text-muted-foreground">{o.title || o.model || o.item}</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold tabular-nums">
              {formatPKR(o.unitPrice)}
              <span className="font-sans text-xs font-normal text-muted-foreground"> /unit</span>
            </p>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {qty} × = {formatPKR(total)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {o.model && (
            <Badge variant="secondary" className="font-normal">
              {o.model}
            </Badge>
          )}
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {o.exactModel ? "Exact model" : "Similar model"}
          </Badge>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {o.condition === "new" ? "New" : "Condition not stated"}
          </Badge>
          {fit &&
            (fit.within ? (
              <Badge className="bg-success/10 text-success">Within budget</Badge>
            ) : (
              <Badge className="bg-warning/10 text-warning">
                Over budget by <span className="font-mono tabular-nums">{formatPKR(fit.over)}</span>
              </Badge>
            ))}
          {o.simulated && (
            <Badge variant="outline" className="text-muted-foreground">
              simulated
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {o.url && (
            <a
              href={o.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View listing
              <ExternalLink className="size-3" />
            </a>
          )}
          {o.contactPhone && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3" />
              {o.contactPhone}
            </span>
          )}
          {o.contactEmail && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Mail className="size-3" />
              {o.contactEmail}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- After choosing ---------- */

function ChosenSummary({ sourcing: s, onChange }: { sourcing: SourcingResult; onChange: () => void }) {
  const chosen = selectedOptions(s.options, s.selectedIds);
  const qty = s.request.qty;
  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle className="truncate">{s.request.item}</CardTitle>
          <Badge className="bg-success/10 text-success">
            <CircleCheck />
            {chosen.length} option{chosen.length > 1 ? "s" : ""} chosen
          </Badge>
          {s.simulated && <Badge variant="secondary">Demo data</Badge>}
        </div>
        <CardDescription>
          {qty} needed{s.request.city ? ` · ${s.request.city}` : ""}
          {s.request.budgetPkr ? ` · budget ${formatPKR(s.request.budgetPkr)}` : ""}
          {s.medianUnitPrice != null ? ` · market median ${formatPKR(s.medianUnitPrice)} per unit` : ""}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onChange}>
            <Pencil data-icon="inline-start" />
            Change selection
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {chosen.map((o, i) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="truncate font-medium">{o.seller}</span>
                {o.simulated && (
                  <Badge variant="outline" className="text-muted-foreground">
                    simulated
                  </Badge>
                )}
              </div>
              <span className="font-mono text-sm tabular-nums">
                {qty} × {formatPKR(o.unitPrice)} = {formatPKR(optionTotal(o, qty))}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
