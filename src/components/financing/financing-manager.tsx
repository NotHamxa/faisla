"use client";
// Financing page body: SBP rates, editable loan options (saved to the company via the store) and an EMI calculator.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KIBOR, POLICY_RATE, demoFinancing } from "@/lib/demoData";
import { emi, isEligible } from "@/lib/finance";
import { formatLakh, formatPKR, formatPct, groupPKR } from "@/lib/format";
import { type SaveStatus, useStore } from "@/lib/store";
import type { Company, FinancingOption, FinancingType } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BANK_SPREAD = 0.03; // typical SME spread over KIBOR (spec §4.4)
const LTFF_DISCOUNT = 0.03; // LTFF end-user rate ≈ policy rate − 3%
const SAMPLE_PRINCIPAL = 48_24_000; // the demo loan: Rs 53.6 lakh less 10% down
const KIBOR_STRESS = 0.02;

const LINKS = {
  kibor: "https://www.sbp.org.pk/ecodata/kibor_index.asp",
  policy: "https://www.sbp.org.pk/m_policy/index.htm",
  ltff: "https://www.sbp.org.pk/smefd/circulars/",
};

// ---------- draft <-> option ----------

type OptionDraft = {
  id: string;
  name: string;
  type: FinancingType;
  ratePct: string;
  tenor: string;
  downPct: string;
  feePct: string;
  kiborLinked: boolean;
  requiresExporter: boolean;
  sourceLink: string;
  note: string;
};

type FieldKey = "name" | "ratePct" | "tenor" | "downPct" | "feePct";

function pctText(rate: number): string {
  return String(Number((rate * 100).toFixed(2)));
}

function toDraft(f: FinancingOption): OptionDraft {
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    ratePct: pctText(f.annualRate),
    tenor: String(f.tenorMonths),
    downPct: pctText(f.downPaymentPct),
    feePct: pctText(f.feePct),
    kiborLinked: f.kiborLinked,
    requiresExporter: f.requiresExporter,
    sourceLink: f.sourceLink ?? "",
    note: f.note ?? "",
  };
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Mirrors the PATCH /api/company schema; the fee cap matches the comparison's fee field.
function validate(d: OptionDraft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const rate = num(d.ratePct);
  const tenor = num(d.tenor);
  const down = num(d.downPct);
  const fee = num(d.feePct === "" ? "0" : d.feePct);
  if (!d.name.trim()) errors.name = "Name is required";
  if (rate === null || rate < 0 || rate > 100) errors.ratePct = "0 to 100";
  if (tenor === null || !Number.isInteger(tenor) || tenor < 1 || tenor > 240) errors.tenor = "1 to 240 months";
  if (down === null || down < 0 || down >= 100) errors.downPct = "0 to 99";
  if (fee === null || fee < 0 || fee > 10) errors.feePct = "0 to 10";
  return errors;
}

function fromDraft(d: OptionDraft): FinancingOption | null {
  if (Object.keys(validate(d)).length) return null;
  const option: FinancingOption = {
    id: d.id,
    name: d.name.trim(),
    type: d.type,
    annualRate: Number(d.ratePct) / 100,
    tenorMonths: Number(d.tenor),
    downPaymentPct: Number(d.downPct) / 100,
    feePct: Number(d.feePct === "" ? "0" : d.feePct) / 100,
    kiborLinked: d.kiborLinked,
    requiresExporter: d.requiresExporter,
    sourceLink: d.sourceLink.trim() || null,
  };
  if (d.note.trim()) option.note = d.note.trim();
  return option;
}

function sameOptions(a: FinancingOption[], b: FinancingOption[]): boolean {
  return JSON.stringify(a.map(toDraft)) === JSON.stringify(b.map(toDraft));
}

// ---------- page body ----------

export function FinancingManager() {
  const { state, update, saveStatus } = useStore();
  const { financing, company } = state;
  const [drafts, setDrafts] = useState<OptionDraft[]>(() => financing.map(toDraft));
  const awaitingSave = useRef<string | null>(null);

  // Re-sync drafts when the stored options change (after save, reset or undo).
  const [synced, setSynced] = useState(financing);
  if (financing !== synced) {
    setSynced(financing);
    setDrafts(financing.map(toDraft));
  }

  useEffect(() => {
    if (!awaitingSave.current) return;
    if (saveStatus === "saved") {
      toast.success(awaitingSave.current);
      awaitingSave.current = null;
    } else if (saveStatus === "error") {
      toast.error("Could not save the financing options. Try again.");
      awaitingSave.current = null;
    }
  }, [saveStatus]);

  const parsed = drafts.map(fromDraft);
  const allValid = parsed.every((p): p is FinancingOption => p !== null);
  const dirty = !allValid || drafts.length !== financing.length || !sameOptions(parsed as FinancingOption[], financing);
  const valid = parsed.filter((p): p is FinancingOption => p !== null);

  function patchDraft(id: string, patch: Partial<OptionDraft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function save() {
    if (!allValid) return;
    awaitingSave.current = "Financing options saved";
    update({ financing: parsed as FinancingOption[] });
  }

  function resetDefaults() {
    const previous = financing;
    update({ financing: demoFinancing });
    toast("Reset to SBP defaults", {
      description: "Bank KIBOR + 3% and LTFF policy − 3%, 10% down, 36 months.",
      action: { label: "Undo", onClick: () => update({ financing: previous }) },
    });
  }

  function addOption() {
    setDrafts((ds) => [
      ...ds,
      {
        id: `custom-${Date.now().toString(36)}`,
        name: "New bank loan",
        type: "bank",
        ratePct: pctText(KIBOR + BANK_SPREAD),
        tenor: "36",
        downPct: "10",
        feePct: "0",
        kiborLinked: true,
        requiresExporter: false,
        sourceLink: "",
        note: "",
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <RatesCard className="lg:col-span-2" />
        <EligibilityCard company={company} options={valid} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LandmarkIcon className="size-4 text-muted-foreground" />
            Loan options
          </CardTitle>
          <CardDescription>
            Each decision offers these loans on the cheapest supplier&apos;s price. LTFF is skipped for non-exporters.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={resetDefaults}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset to SBP defaults
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {drafts.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No loan options. Comparisons will only show cash and supplier installments.
            </p>
          )}
          {drafts.map((d, i) => (
            <OptionEditor
              key={d.id}
              index={i}
              draft={d}
              company={company}
              onChange={(patch) => patchDraft(d.id, patch)}
              onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addOption}>
            <PlusIcon data-icon="inline-start" />
            Add loan option
          </Button>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <SaveState dirty={dirty} valid={allValid} status={saveStatus} />
          <div className="flex gap-2">
            {dirty && (
              <Button variant="ghost" onClick={() => setDrafts(financing.map(toDraft))}>
                Discard
              </Button>
            )}
            <Button onClick={save} disabled={!dirty || !allValid}>
              <SaveIcon data-icon="inline-start" />
              Save changes
            </Button>
          </div>
        </CardFooter>
      </Card>

      <EmiCalculator options={valid} company={company} />
    </div>
  );
}

function SaveState({ dirty, valid, status }: { dirty: boolean; valid: boolean; status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner className="size-3.5" /> Saving…
      </span>
    );
  }
  if (!valid) return <span className="text-xs text-destructive">Fix the highlighted fields to save</span>;
  if (dirty) return <span className="text-xs text-warning">Unsaved changes</span>;
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <CircleAlertIcon className="size-3.5" /> Last save failed
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <CheckIcon className="size-3.5" /> All changes saved
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Saved to your company profile.</span>;
}

// ---------- rates ----------

function RateTile({ label, value, href, source }: { label: string; value: string; href: string; source: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
      >
        {source} <ExternalLinkIcon className="size-3" />
      </a>
    </div>
  );
}

function RatesCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Reference rates</CardTitle>
        <CardDescription>Where the loan rates come from. Code uses these; AI never sets a rate.</CardDescription>
        <CardAction>
          <Badge className="bg-warning/10 text-warning">
            <TriangleAlertIcon data-icon="inline-start" />
            Verify before demo
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <RateTile label="1-year KIBOR" value={formatPct(KIBOR)} href={LINKS.kibor} source="SBP KIBOR fixings" />
          <RateTile label="SBP policy rate" value={formatPct(POLICY_RATE)} href={LINKS.policy} source="SBP monetary policy" />
        </div>
        <div className="divide-y rounded-lg border text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>
              <span className="font-medium">Bank term loan</span>
              <span className="text-muted-foreground"> = KIBOR + bank spread; moves when KIBOR moves</span>
            </span>
            <span className="font-mono tabular-nums">
              {formatPct(KIBOR)} + {formatPct(BANK_SPREAD, 0)} ={" "}
              <span className="font-semibold">{formatPct(KIBOR + BANK_SPREAD)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>
              <span className="font-medium">SBP LTFF</span>
              <span className="text-muted-foreground"> = policy rate − 3%; fixed for exporters buying new machinery</span>
            </span>
            <span className="font-mono tabular-nums">
              {formatPct(POLICY_RATE)} − {formatPct(LTFF_DISCOUNT, 0)} ={" "}
              <span className="font-semibold">{formatPct(POLICY_RATE - LTFF_DISCOUNT)}</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          LTFF terms and eligibility:{" "}
          <a href={LINKS.ltff} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            SBP SME finance circulars
          </a>
          . The exact rate and approval time are confirmed by the bank.
        </p>
      </CardContent>
    </Card>
  );
}

function EligibilityCard({ company, options }: { company: Company; options: FinancingOption[] }) {
  const exporterOnly = options.filter((o) => o.requiresExporter);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eligibility</CardTitle>
        <CardDescription>{company.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {company.isExporter ? (
          <Alert className="border-success/30 bg-success/5">
            <BadgeCheckIcon className="text-success" />
            <AlertTitle className="text-success">Exporter: LTFF eligible</AlertTitle>
            <AlertDescription>
              Exporter-only options ({exporterOnly.length}) are included in every comparison. The bank confirms
              eligibility on the term sheet.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-warning/30 bg-warning/5">
            <TriangleAlertIcon className="text-warning" />
            <AlertTitle className="text-warning">Not marked as an exporter</AlertTitle>
            <AlertDescription>
              LTFF requires export business, so exporter-only options ({exporterOnly.length}) are skipped in
              comparisons.
            </AlertDescription>
          </Alert>
        )}
        <Button variant="outline" size="sm" render={<Link href="/settings#company" />} nativeButton={false}>
          Edit company profile
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- option editor ----------

function OptionEditor({
  index,
  draft: d,
  company,
  onChange,
  onRemove,
}: {
  index: number;
  draft: OptionDraft;
  company: Company;
  onChange: (patch: Partial<OptionDraft>) => void;
  onRemove: () => void;
}) {
  const errors = validate(d);
  const id = (field: string) => `fin-${d.id}-${field}`;
  const option = fromDraft(d);
  const eligible = option ? isEligible(company, option) : true;

  function setType(type: FinancingType) {
    // Sensible defaults when switching; both switches stay editable.
    onChange(type === "ltff" ? { type, kiborLinked: false, requiresExporter: true } : { type, kiborLinked: true, requiresExporter: false });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted font-mono text-xs tabular-nums">
          {index + 1}
        </span>
        <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label="Loan type">
          {(["bank", "ltff"] as const).map((t) => (
            <Button
              key={t}
              size="xs"
              variant={d.type === t ? "default" : "ghost"}
              role="radio"
              aria-checked={d.type === t}
              onClick={() => setType(t)}
            >
              {t === "bank" ? "Bank" : "LTFF"}
            </Button>
          ))}
        </div>
        {!eligible && <Badge className="bg-warning/10 text-warning">Skipped: not an exporter</Badge>}
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={onRemove}>
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field className="sm:col-span-2" data-invalid={!!errors.name || undefined}>
          <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
          <Input
            id={id("name")}
            value={d.name}
            aria-invalid={!!errors.name || undefined}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={id("source")}>Source link</FieldLabel>
          <Input
            id={id("source")}
            type="url"
            placeholder="https://www.sbp.org.pk/…"
            value={d.sourceLink}
            onChange={(e) => onChange({ sourceLink: e.target.value })}
          />
        </Field>

        <NumberField
          id={id("rate")}
          label="Annual rate"
          suffix="%"
          value={d.ratePct}
          error={errors.ratePct}
          onChange={(v) => onChange({ ratePct: v })}
        />
        <NumberField
          id={id("tenor")}
          label="Tenor"
          suffix="months"
          value={d.tenor}
          error={errors.tenor}
          integer
          onChange={(v) => onChange({ tenor: v })}
        />
        <NumberField
          id={id("down")}
          label="Down payment"
          suffix="%"
          value={d.downPct}
          error={errors.downPct}
          onChange={(v) => onChange({ downPct: v })}
        />
        <NumberField
          id={id("fee")}
          label="Processing fee"
          suffix="%"
          value={d.feePct}
          error={errors.feePct}
          onChange={(v) => onChange({ feePct: v })}
        />

        <Field orientation="horizontal" className="sm:col-span-2 lg:col-span-1">
          <Switch id={id("kibor")} checked={d.kiborLinked} onCheckedChange={(v) => onChange({ kiborLinked: v })} />
          <FieldContent>
            <FieldLabel htmlFor={id("kibor")}>KIBOR-linked</FieldLabel>
            <FieldDescription className="text-xs">Moves in the stress test</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal" className="sm:col-span-2 lg:col-span-1">
          <Switch
            id={id("exporter")}
            checked={d.requiresExporter}
            onCheckedChange={(v) => onChange({ requiresExporter: v })}
          />
          <FieldContent>
            <FieldLabel htmlFor={id("exporter")}>Exporters only</FieldLabel>
            <FieldDescription className="text-xs">Skipped for non-exporters</FieldDescription>
          </FieldContent>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={id("note")}>Note</FieldLabel>
          <Input
            id={id("note")}
            placeholder="Optional, e.g. KIBOR ≈ 11.8% + 3% bank spread"
            value={d.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  error?: string;
  integer?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Field data-invalid={!!props.error || undefined}>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <div className="relative">
        <Input
          id={props.id}
          inputMode={props.integer ? "numeric" : "decimal"}
          className={cn("font-mono tabular-nums", props.suffix === "%" ? "pr-7" : "pr-16")}
          value={props.value}
          aria-invalid={!!props.error || undefined}
          onChange={(e) => props.onChange(e.target.value.replace(props.integer ? /[^\d]/g : /[^\d.]/g, ""))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
          {props.suffix}
        </span>
      </div>
      {props.error && <FieldDescription className="text-xs text-destructive">{props.error}</FieldDescription>}
    </Field>
  );
}

// ---------- calculator ----------

function EmiCalculator({ options, company }: { options: FinancingOption[]; company: Company }) {
  const [principal, setPrincipal] = useState(SAMPLE_PRINCIPAL);

  const rows = useMemo(
    () =>
      options.map((o) => {
        const monthly = emi(principal, o.annualRate, o.tenorMonths);
        const repaid = monthly * o.tenorMonths;
        const fee = principal * o.feePct;
        return {
          option: o,
          monthly,
          markup: repaid - principal,
          fee,
          cost: repaid - principal + fee,
          stressed: o.kiborLinked ? emi(principal, o.annualRate + KIBOR_STRESS, o.tenorMonths) : null,
          eligible: isEligible(company, o),
        };
      }),
    [options, principal, company],
  );
  const cheapest = rows.filter((r) => r.eligible).reduce<(typeof rows)[number] | null>(
    (best, r) => (!best || r.cost < best.cost ? r : best),
    null,
  );
  const tenors = [...new Set(options.map((o) => o.tenorMonths))];
  const title = `What does Rs ${formatLakh(principal, 2)}${tenors.length === 1 ? ` over ${tenors[0]} months` : ""} cost?`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{principal > 0 ? title : "Loan cost calculator"}</CardTitle>
        <CardDescription>
          Monthly instalment (EMI, bank convention i = rate ÷ 12) and total markup for each option. Before tax; the
          comparison in each decision adds tax savings and present value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="calc-principal">Loan amount (principal)</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
              Rs
            </span>
            <Input
              id="calc-principal"
              inputMode="numeric"
              className="pl-8 font-mono tabular-nums"
              value={principal ? groupPKR(principal) : ""}
              placeholder="0"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setPrincipal(digits ? Number(digits) : 0);
              }}
            />
          </div>
          <FieldDescription className="text-xs">
            {principal > 0 ? `= ${formatLakh(principal, 2)} · ` : ""}Demo: Rs 53.6 lakh less 10% down
          </FieldDescription>
        </Field>

        {rows.length === 0 || principal <= 0 ? (
          <p className="text-sm text-muted-foreground">Enter a loan amount and at least one valid loan option.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="min-w-[640px]">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Option</TableHead>
                  <TableHead className="text-right">Rate · tenor</TableHead>
                  <TableHead className="text-right">EMI / month</TableHead>
                  <TableHead className="text-right">Total markup</TableHead>
                  <TableHead className="pr-4 text-right">Markup + fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const best = cheapest?.option.id === r.option.id && rows.length > 1;
                  return (
                    <TableRow key={r.option.id} className={cn(best && "bg-primary/5 hover:bg-primary/10", !r.eligible && "opacity-60")}>
                      <TableCell className="py-3 pl-4 whitespace-normal">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{r.option.name}</span>
                          {best && <Badge>Cheapest</Badge>}
                          {!r.eligible && <Badge className="bg-warning/10 text-warning">Not eligible</Badge>}
                        </div>
                        {r.stressed !== null && (
                          <div className="text-xs text-muted-foreground">
                            If KIBOR +2%: EMI <span className="font-mono tabular-nums">{groupPKR(r.stressed)}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono tabular-nums">
                        {formatPct(r.option.annualRate)} · {r.option.tenorMonths} mo
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono font-semibold tabular-nums">{groupPKR(r.monthly)}</TableCell>
                      <TableCell className="py-3 text-right font-mono tabular-nums">{groupPKR(r.markup)}</TableCell>
                      <TableCell className={cn("py-3 pr-4 text-right font-mono tabular-nums", best && "font-semibold text-primary")}>
                        {formatPKR(r.cost)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
