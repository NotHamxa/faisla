"use client";
// Step 1 for a decision that starts from a need: the owner describes what they need in plain words,
// Faisla searches new-item shops and reads the listings (AI), code checks prices and specs and ranks
// them, and the owner ticks 1–3 options that become offers. The owner can also paste a product link.
// Prices are copied from listings; every total is qty × unit price in code.
import { useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, ExternalLink, Link2, Pencil, Search, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Details, HelpTip } from "@/components/simple";
import { formatLakh, formatPKR, groupPKR } from "@/lib/format";
import {
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
type LinkApiResponse = { option: SourcedOption | null; offer: unknown; note?: string };

const REQUEST_TIMEOUT_MS = 75_000;

const EXAMPLES = [
  {
    label: "80 lockstitch machines (demo)",
    text: "80 direct-drive lockstitch sewing machines for my garment factory in Faisalabad, budget around 60 lakh",
  },
  { label: "2 embroidery machines", text: "2 industrial embroidery machines for Lahore, budget 20 lakh" },
  { label: "Gaming PC", text: "Gaming PC with current generation Intel Core i9 and RTX 4050, budget 6 lakh" },
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
        if (result.options.length) toast.success(`Found ${result.options.length} option${result.options.length > 1 ? "s" : ""}`);
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
    toast.success(`${chosen.length} offer${chosen.length > 1 ? "s" : ""} added`, { description: "Next: the price check." });
  }

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SELECTED_OPTIONS ? p : [...p, id]));
  }

  // A pasted link's option joins the list (cheapest-first order kept) and is ticked when there is room.
  function addLinkedOption(option: SourcedOption) {
    if (!sourcing || sourcing.options.some((o) => o.id === option.id || sameUrl(o.url) === sameUrl(option.url))) return;
    const options = [...sourcing.options, option];
    update({ sourcing: { ...sourcing, options } });
    // Ticked straight away when there is room, unless the page contradicts what was asked.
    if (option.specStatus !== "mismatch") setPicked((p) => (p.length < MAX_SELECTED_OPTIONS ? [...p, option.id] : p));
    toast.success("Link added", { description: `${option.seller} · ${formatPKR(option.unitPrice)}` });
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
        onAddOption={addLinkedOption}
        onCancel={state.quotationConfirmed && sourcing.selectedIds.length > 0 ? () => setView("auto") : undefined}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you need?</CardTitle>
        {sourcing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setView("results")} disabled={loading}>
              Back to results
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="need-text" className="sr-only">
            Your need
          </FieldLabel>
          <Textarea
            id="need-text"
            rows={3}
            maxLength={600}
            className="min-h-20"
            placeholder="In your own words, e.g. 2 embroidery machines for Lahore, budget 20 lakh"
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void search();
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
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

        <Details title="More details (optional)" className="mt-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="need-qty">How many</FieldLabel>
              <Input
                id="need-qty"
                inputMode="numeric"
                className="font-mono tabular-nums placeholder:font-sans"
                placeholder="From your words"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="need-city">City</FieldLabel>
              <Input id="need-city" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="need-budget">Total budget</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  Rs
                </span>
                <Input
                  id="need-budget"
                  className="pl-8 font-mono tabular-nums placeholder:font-sans"
                  inputMode="numeric"
                  placeholder="From your words"
                  value={budget ? groupPKR(budget) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                    setBudget(digits ? Number(digits) : 0);
                  }}
                />
              </div>
              {budget > 0 && <FieldDescription className="text-xs">= {formatLakh(budget, 2)}</FieldDescription>}
            </Field>
          </div>
        </Details>

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
              Checking shops. This can take up to a minute.
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
  onAddOption: (option: SourcedOption) => void;
  onCancel?: () => void;
}) {
  const { sourcing: s, picked } = props;
  const req = s.request;
  const pickedCount = selectedOptions(s.options, picked).length;

  return (
    <div className="flex flex-col gap-4">
      <Understood sourcing={s} onEdit={props.onEdit} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Options found</CardTitle>
            <Badge variant="secondary" className="font-mono tabular-nums">
              {s.options.length}
            </Badge>
          </div>
          {s.options.length > 0 && <CardDescription>Tick up to {MAX_SELECTED_OPTIONS} to compare.</CardDescription>}
          {props.onCancel && (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={props.onCancel}>
                Cancel
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {s.options.length === 0 ? (
            <p className="border border-dashed px-3 py-4 text-sm text-muted-foreground" data-testid="need-empty">
              {emptyLine(s)}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.options.map((o) => (
                <OptionCard
                  key={o.id}
                  option={o}
                  qty={req.qty}
                  checked={picked.includes(o.id)}
                  disabled={!picked.includes(o.id) && pickedCount >= MAX_SELECTED_OPTIONS}
                  onToggle={() => props.onToggle(o.id)}
                />
              ))}
            </ul>
          )}

          <AddLink sourcing={s} onAdd={props.onAddOption} />

          <Details title="Details">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              {s.medianUnitPrice != null && (
                <p>
                  Middle price of {s.options.length} listings:{" "}
                  <span className="font-mono text-foreground tabular-nums">{formatPKR(s.medianUnitPrice)}</span> per unit.
                </p>
              )}
              {s.note && s.options.length > 0 && <p>{s.note}</p>}
              <p>
                Prices are copied from each listing; code checks the number is written there and that the listing mentions what
                you asked for. Totals are quantity × price.
              </p>
              <p>
                Searched {s.cached ? "(saved results)" : "live"}: {req.searchQueries.join(" · ")}
              </p>
            </div>
          </Details>
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

// The honest one-liner when nothing is left (the route writes it; older saved results may not have it).
function emptyLine(s: SourcingResult): string {
  const first = s.note?.split(/(?<=quotation\.)\s/)[0];
  if (first && first.startsWith("No ")) return first;
  return "No new listings match what you asked. Try other words, paste a link you found, or upload a quotation.";
}

// "What Faisla understood": one compact line of tags, with an Edit link.
function Understood({ sourcing: s, onEdit }: { sourcing: SourcingResult; onEdit: () => void }) {
  const req = s.request;
  const specs = (req.requirements ?? []).filter((r) => r.mustHave);
  return (
    <div className="flex flex-wrap items-center gap-1.5 border bg-card px-3 py-2 text-sm" data-testid="need-understood">
      <span className="ledger-label mr-1">Looking for</span>
      <Badge variant="outline">{req.item}</Badge>
      <Badge variant="outline" className="font-mono tabular-nums">
        {req.qty} ×
      </Badge>
      {specs.map((r) => (
        <Badge key={r.label} variant="secondary" title={`Listings must mention: ${r.anyOf.join(", ")}`}>
          {r.label}
        </Badge>
      ))}
      {req.condition && <Badge variant="outline">{req.condition === "used" ? "Used OK" : "New"}</Badge>}
      {req.budgetPkr ? (
        <Badge variant="outline" className="font-mono tabular-nums" title={formatLakh(req.budgetPkr, 2)}>
          Budget {formatPKR(req.budgetPkr)}
        </Badge>
      ) : null}
      {req.city && <Badge variant="outline">{req.city}</Badge>}
      <HelpTip label="How Faisla checks">
        {specs.length
          ? "Every listing must mention each grey tag. Listings that say something else (like a lower model) are left out."
          : "Faisla shows new listings with a price written on the page."}
      </HelpTip>
      <Button variant="link" size="sm" className="ml-auto h-auto px-1" onClick={onEdit}>
        <Pencil data-icon="inline-start" />
        Edit
      </Button>
    </div>
  );
}

function MatchBadge({ option: o }: { option: SourcedOption }) {
  const status = o.specStatus ?? (o.exactModel ? "matched" : "unverified");
  if (status === "matched") return <Badge variant="success">Matches what you asked</Badge>;
  if (status === "mismatch") return <Badge variant="warning">Doesn&apos;t match</Badge>;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="muted">Couldn&apos;t check</Badge>
      <HelpTip label="Why couldn't Faisla check?">
        {o.missingSpecs?.length
          ? `The listing doesn't say: ${o.missingSpecs.join(", ")}. Open it to check.`
          : "The listing has too little text to check. Open it to check."}
      </HelpTip>
    </span>
  );
}

function OptionCard(props: { option: SourcedOption; qty: number; checked: boolean; disabled: boolean; onToggle: () => void }) {
  const { option: o, qty } = props;
  const total = optionTotal(o, qty);
  return (
    <li
      className={cn(
        "flex gap-3 border p-3 transition-colors",
        props.checked ? "border-primary border-l-[3px] bg-card" : "bg-card",
        props.disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40",
      )}
      onClick={() => !props.disabled && props.onToggle()}
      data-testid="need-option"
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
            <p className="line-clamp-2 text-xs text-muted-foreground" title={o.title}>
              {o.title || o.model || o.item}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold tabular-nums">{formatPKR(o.unitPrice)}</p>
            {qty > 1 && (
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                Total {formatPKR(total)} for {qty}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MatchBadge option={o} />
          {o.url && (
            <a
              href={o.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
              data-testid="open-listing"
            >
              Open listing
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- Paste your own link ---------- */

// The same page with or without tracking parameters or a trailing slash.
function sameUrl(u: string): string {
  return u.replace(/[?#].*$/, "").replace(/\/$/, "");
}

function AddLink({ sourcing: s, onAdd }: { sourcing: SourcingResult; onAdd: (option: SourcedOption) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    const clean = url.trim();
    if (!clean || busy) return;
    if (s.options.some((o) => sameUrl(o.url) === sameUrl(clean))) {
      setNote("That link is already in the list.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/listing/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean, qty: s.request.qty, requirements: s.request.requirements ?? null }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => null)) as LinkApiResponse | null;
      const listed = data?.option && s.options.some((o) => o.id === data.option!.id || sameUrl(o.url) === sameUrl(data.option!.url));
      if (data?.option && !listed) {
        onAdd(data.option);
        setUrl("");
      }
      setNote(
        listed
          ? "That link is already in the list."
          : (data?.note ?? (data?.option ? null : `Couldn't read that page (${res.status}). Enter the price yourself.`)),
      );
    } catch {
      setNote("That page took too long to open. Enter the price yourself.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor="need-link" className="text-sm">
        Add a link you found
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          id="need-link"
          type="url"
          inputMode="url"
          placeholder="https://shop.pk/product/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          disabled={busy}
        />
        <Button variant="outline" onClick={() => void add()} disabled={!url.trim() || busy}>
          {busy ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          {busy ? "Reading…" : "Add"}
        </Button>
      </div>
      {note && (
        <p className="text-xs text-muted-foreground" role="status" data-testid="link-note">
          {note}
        </p>
      )}
    </div>
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
          <Badge variant="success">
            <CircleCheck />
            {chosen.length} option{chosen.length > 1 ? "s" : ""} chosen
          </Badge>
        </div>
        <CardDescription>
          {qty} needed{s.request.city ? ` · ${s.request.city}` : ""}
          {s.request.budgetPkr ? ` · budget ${formatPKR(s.request.budgetPkr)}` : ""}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onChange}>
            <Pencil data-icon="inline-start" />
            Change selection
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y border">
          {chosen.map((o, i) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-[2px] border border-primary/50 font-mono text-[11px] font-semibold text-primary">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="truncate font-medium">{o.seller}</span>
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
