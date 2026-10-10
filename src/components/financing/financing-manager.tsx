"use client";
// Financing page body: financing preference (Islamic first), Islamic modes explained, SBP reference rates, editable
// financing options (saved to the company via the store) and a monthly installment calculator.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  MoonStarIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KIBOR, POLICY_RATE, demoFinancing, financingPresets } from "@/lib/demoData";
import {
  FINANCING_NAMES,
  SHARIAH_NOTES,
  emi,
  financingForPreference,
  isEligible,
  isIslamicType,
  paymentWord,
} from "@/lib/finance";
import { formatLakh, formatPKR, formatPct, groupPKR } from "@/lib/format";
import { type SaveStatus, useStore } from "@/lib/store";
import type { Company, FinancingOption, FinancingPreference, FinancingType } from "@/lib/types";
import { FinancingPreferenceToggle } from "@/components/ProfileForm";
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
const LTFF_DISCOUNT = 0.03; // Islamic LTFF / LTFF end-user rate = policy rate − 3%
const SAMPLE_PRINCIPAL = 48_24_000; // the demo: Rs 53.6 lakh less your 10% share
const KIBOR_STRESS = 0.02;

const LINKS = {
  kibor: "https://www.sbp.org.pk/ecodata/kibor_index.asp",
  policy: "https://www.sbp.org.pk/m_policy/index.htm",
  ltff: "https://www.abl.com/business-banking/trade-services/export-finances/",
  islamic: "https://www.meezanbank.com/commercial-banking/",
};

const TYPE_ORDER: FinancingType[] = ["diminishing_musharakah", "ijarah", "murabaha", "iltf", "bank", "ltff"];

const TYPE_BUTTON: Record<FinancingType, string> = {
  diminishing_musharakah: "Diminishing Musharakah",
  ijarah: "Ijarah",
  murabaha: "Murabaha",
  iltf: "Islamic LTFF",
  bank: "Conventional loan",
  ltff: "Conventional LTFF",
};

// Field wording per mode: Islamic modes never say "loan", "interest" or "down payment".
function fieldWords(type: FinancingType): { rate: string; down: string; downHint: string } {
  if (type === "ijarah") return { rate: "Rental rate", down: "Security deposit", downHint: "Adjusted against the purchase price at the end" };
  if (type === "murabaha") return { rate: "Profit rate", down: "Your advance", downHint: "Paid at delivery" };
  if (type === "diminishing_musharakah" || type === "iltf") return { rate: "Profit rate", down: "Your share", downHint: "Your co-ownership share at delivery" };
  return { rate: "Interest rate", down: "Down payment", downHint: "Paid at delivery" };
}

// Sensible defaults when switching mode; both switches stay editable.
function typeDefaults(type: FinancingType): { kiborLinked: boolean; requiresExporter: boolean } {
  if (type === "iltf" || type === "ltff") return { kiborLinked: false, requiresExporter: true };
  if (type === "murabaha") return { kiborLinked: false, requiresExporter: false };
  return { kiborLinked: true, requiresExporter: false };
}

export const ISLAMIC_MODES: { name: string; how: string; cost: string; tax: string }[] = [
  {
    name: "Diminishing Musharakah",
    how: "You and the bank co-own the machines. Each month you pay rent on the bank's share and buy a few of its units, until you own everything.",
    cost: "Profit rate benchmarked to KIBOR + spread, repriced periodically.",
    tax: "Rent (profit) is deductible; you claim depreciation as the owner.",
  },
  {
    name: "Ijarah",
    how: "The bank buys and leases the machines to you. You pay a security deposit and monthly rentals; at the end ownership passes to you by a separate sale or gift.",
    cost: "Rentals benchmarked to KIBOR + spread. The bank, as owner, arranges takaful.",
    tax: "Rentals are deductible as paid; no depreciation for you during the lease.",
  },
  {
    name: "Murabaha",
    how: "The bank buys the machines and sells them to you at cost plus an agreed profit, paid in installments. Banks use it mostly for raw materials and working capital.",
    cost: "The deferred price is fixed at the contract and never increased.",
    tax: "The profit part is deductible; you depreciate the machines as the owner.",
  },
  {
    name: "Islamic LTFF (ILTFF)",
    how: "SBP's Shariah-compliant counterpart of LTFF for exporters buying new machinery, offered through Islamic banks (for example by Diminishing Musharakah).",
    cost: "End-user profit rate set by SBP at policy rate − 3%.",
    tax: "Same as the mode the bank uses (Diminishing Musharakah here).",
  },
];

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
    shariahCompliant: isIslamicType(d.type),
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
      toast.error("Could not save the financing settings. Try again.");
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
    toast("Reset to Islamic defaults", {
      description:
        "Diminishing Musharakah and Ijarah at KIBOR + 3%, SBP Islamic LTFF at policy − 3%; conventional kept for comparison.",
      action: { label: "Undo", onClick: () => update({ financing: previous }) },
    });
  }

  function addOption(preset: FinancingOption) {
    setDrafts((ds) => [...ds, { ...toDraft(preset), id: `custom-${Date.now().toString(36)}` }]);
  }

  function setPreference(financingPreference: FinancingPreference) {
    if (financingPreference === company.financingPreference) return;
    awaitingSave.current =
      financingPreference === "islamic" ? "Showing Shariah-compliant financing only" : "Conventional financing added for comparison";
    update({ company: { ...company, financingPreference } });
  }

  const preference: FinancingPreference = company.financingPreference ?? "islamic";
  const hiddenConventional = preference === "islamic" ? drafts.filter((d) => !isIslamicType(d.type)).length : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" id="preference">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MoonStarIcon className="size-4 text-muted-foreground" />
              Islamic finance first
            </CardTitle>
            <CardDescription>
              Comparisons include Shariah-compliant financing by default. Pakistan&apos;s 26th Amendment sets eliminating
              riba before 1 January 2028.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinancingPreferenceToggle id="fin-preference" value={preference} onChange={setPreference} />
          </CardContent>
        </Card>
        <EligibilityCard company={company} options={valid} />
      </div>

      <IslamicModesCard />
      <RatesCard />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LandmarkIcon className="size-4 text-muted-foreground" />
            Financing options
          </CardTitle>
          <CardDescription>
            Each decision offers these on the cheapest supplier&apos;s price. Islamic LTFF is skipped for non-exporters
            {hiddenConventional > 0
              ? `; ${hiddenConventional} conventional option${hiddenConventional === 1 ? " is" : "s are"} left out while the preference is Shariah-compliant only`
              : ""}
            .
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={resetDefaults}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset to Islamic defaults
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {drafts.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No financing options. Comparisons will only show cash and the supplier&apos;s deferred-price plan.
            </p>
          )}
          {drafts.map((d, i) => (
            <OptionEditor
              key={d.id}
              index={i}
              draft={d}
              company={company}
              preference={preference}
              onChange={(patch) => patchDraft(d.id, patch)}
              onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Add:</span>
            {financingPresets.map((preset) => (
              <Button key={preset.id} variant="outline" size="sm" onClick={() => addOption(preset)}>
                <PlusIcon data-icon="inline-start" />
                {TYPE_BUTTON[preset.type]}
              </Button>
            ))}
          </div>
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

      <InstallmentCalculator options={financingForPreference(valid, preference)} company={company} />
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
      <div className="ledger-label">{label}</div>
      <div className="mt-1 font-mono text-3xl font-medium tabular-nums">{value}</div>
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
        <CardDescription>
          KIBOR is the benchmark Islamic banks use to price profit and rentals; the SBP policy rate sets Islamic LTFF.
          Code uses these; AI never sets a rate.
        </CardDescription>
        <CardAction>
          <Badge variant="warning">
            <TriangleAlertIcon data-icon="inline-start" />
            Verify before demo
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <RateTile label="KIBOR (benchmark)" value={formatPct(KIBOR)} href={LINKS.kibor} source="SBP KIBOR fixings" />
          <RateTile label="SBP policy rate" value={formatPct(POLICY_RATE)} href={LINKS.policy} source="SBP monetary policy" />
        </div>
        <div className="divide-y rounded-lg border text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>
              <span className="font-medium">Diminishing Musharakah / Ijarah</span>
              <span className="text-muted-foreground"> = KIBOR + bank spread; repriced when KIBOR moves</span>
            </span>
            <span className="font-mono tabular-nums">
              {formatPct(KIBOR)} + {formatPct(BANK_SPREAD, 0)} ={" "}
              <span className="font-semibold">{formatPct(KIBOR + BANK_SPREAD)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>
              <span className="font-medium">SBP Islamic LTFF</span>
              <span className="text-muted-foreground"> = policy rate − 3%; for exporters buying new machinery</span>
            </span>
            <span className="font-mono tabular-nums">
              {formatPct(POLICY_RATE)} − {formatPct(LTFF_DISCOUNT, 0)} ={" "}
              <span className="font-semibold">{formatPct(POLICY_RATE - LTFF_DISCOUNT)}</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Islamic LTFF and LTFF end-user rate:{" "}
          <a href={LINKS.ltff} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            &ldquo;3% less than the SBP policy rate&rdquo;
          </a>
          . SBP refinance schemes are being phased out over FY24–28, so the bank confirms the exact rate and approval time.
          Conventional loans use the same KIBOR + spread and are shown only when the preference includes them.
        </p>
      </CardContent>
    </Card>
  );
}

function IslamicModesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How Islamic machinery financing works</CardTitle>
        <CardDescription>
          Asset-backed: the bank buys, co-owns or leases the machines and earns profit or rent on them, instead of lending money.
        </CardDescription>
        <CardAction>
          <a
            href={LINKS.islamic}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            Example: Meezan Bank <ExternalLinkIcon className="size-3" />
          </a>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ISLAMIC_MODES.map((m) => (
            <div key={m.name} className="rounded-[2px] border border-t-[3px] border-t-primary p-3 text-sm">
              <div className="font-medium">{m.name}</div>
              <p className="mt-1 text-muted-foreground">{m.how}</p>
              <p className="mt-2 text-xs">
                <span className="font-medium">Cost: </span>
                <span className="text-muted-foreground">{m.cost}</span>
              </p>
              <p className="mt-1 text-xs">
                <span className="font-medium">Tax: </span>
                <span className="text-muted-foreground">{m.tax}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-3">
          <div className="ledger-label">Shariah notes</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {SHARIAH_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
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
          <Alert className="border-success/40 border-l-success">
            <BadgeCheckIcon className="text-success" />
            <AlertTitle className="text-success">Exporter: Islamic LTFF eligible</AlertTitle>
            <AlertDescription>
              Exporter-only options ({exporterOnly.length}) are included in every comparison. The bank confirms
              eligibility on the term sheet.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-warning/50 border-l-warning">
            <TriangleAlertIcon className="text-warning" />
            <AlertTitle className="text-warning">Not marked as an exporter</AlertTitle>
            <AlertDescription>
              Islamic LTFF requires export business, so exporter-only options ({exporterOnly.length}) are skipped in
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
  preference,
  onChange,
  onRemove,
}: {
  index: number;
  draft: OptionDraft;
  company: Company;
  preference: FinancingPreference;
  onChange: (patch: Partial<OptionDraft>) => void;
  onRemove: () => void;
}) {
  const errors = validate(d);
  const id = (field: string) => `fin-${d.id}-${field}`;
  const option = fromDraft(d);
  const eligible = option ? isEligible(company, option) : true;
  const islamic = isIslamicType(d.type);
  const words = fieldWords(d.type);

  function setType(type: FinancingType) {
    onChange({ type, ...typeDefaults(type) });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-[2px] border font-mono text-xs tabular-nums">
          {index + 1}
        </span>
        <div className="inline-flex flex-wrap rounded-lg border p-0.5" role="radiogroup" aria-label="Financing mode">
          {TYPE_ORDER.map((t) => (
            <Button
              key={t}
              size="xs"
              variant={d.type === t ? "default" : "ghost"}
              role="radio"
              aria-checked={d.type === t}
              onClick={() => setType(t)}
            >
              {TYPE_BUTTON[t]}
            </Button>
          ))}
        </div>
        {islamic ? (
          <Badge variant="success">Shariah-compliant</Badge>
        ) : (
          <Badge variant="muted">Conventional · interest-based</Badge>
        )}
        {!islamic && preference === "islamic" && <Badge variant="warning">Left out: Shariah-compliant only</Badge>}
        {!eligible && <Badge variant="warning">Skipped: not an exporter</Badge>}
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
          label={words.rate}
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
          label={words.down}
          hint={words.downHint}
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
            <FieldDescription className="text-xs">Repriced in the KIBOR stress test</FieldDescription>
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
            placeholder="Optional, e.g. KIBOR ≈ 11.8% + 3% spread, takaful by the bank"
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
  hint?: string;
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
      {props.error ? (
        <FieldDescription className="text-xs text-destructive">{props.error}</FieldDescription>
      ) : (
        props.hint && <FieldDescription className="text-xs">{props.hint}</FieldDescription>
      )}
    </Field>
  );
}

// ---------- calculator ----------

function InstallmentCalculator({ options, company }: { options: FinancingOption[]; company: Company }) {
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
          profit: repaid - principal,
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
  const title = `What does financing Rs ${formatLakh(principal, 2)}${tenors.length === 1 ? ` over ${tenors[0]} months` : ""} cost?`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{principal > 0 ? title : "Financing cost calculator"}</CardTitle>
        <CardDescription>
          Monthly installment or rental (i = rate ÷ 12 on the outstanding amount, never compounded) and the bank&apos;s
          total profit for each option. Before tax; each decision&apos;s comparison adds tax savings and present value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="calc-principal">Amount financed</FieldLabel>
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
            {principal > 0 ? `= ${formatLakh(principal, 2)} · ` : ""}Demo: Rs 53.6 lakh less your 10% share
          </FieldDescription>
        </Field>

        {rows.length === 0 || principal <= 0 ? (
          <p className="text-sm text-muted-foreground">Enter an amount and at least one valid financing option.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="min-w-[640px]">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Option</TableHead>
                  <TableHead className="text-right">Rate · tenor</TableHead>
                  <TableHead className="text-right">Per month</TableHead>
                  <TableHead className="text-right">Total profit</TableHead>
                  <TableHead className="pr-4 text-right">Profit + fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const best = cheapest?.option.id === r.option.id && rows.length > 1;
                  const conventional = !isIslamicType(r.option.type);
                  return (
                    <TableRow key={r.option.id} className={cn(best && "bg-muted/60 hover:bg-muted", !r.eligible && "opacity-60")}>
                      <TableCell className="py-3 pl-4 whitespace-normal">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{r.option.name}</span>
                          {best && <Badge>Cheapest</Badge>}
                          {conventional && <Badge variant="muted">Conventional · interest-based</Badge>}
                          {!r.eligible && <Badge variant="warning">Not eligible</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {FINANCING_NAMES[r.option.type]}, monthly {paymentWord(r.option.type)}
                          {r.stressed !== null && (
                            <>
                              {" "}· if KIBOR +2%: <span className="font-mono tabular-nums">{groupPKR(r.stressed)}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono tabular-nums">
                        {formatPct(r.option.annualRate)} · {r.option.tenorMonths} mo
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono font-semibold tabular-nums">{groupPKR(r.monthly)}</TableCell>
                      <TableCell className="py-3 text-right font-mono tabular-nums">{groupPKR(r.profit)}</TableCell>
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
