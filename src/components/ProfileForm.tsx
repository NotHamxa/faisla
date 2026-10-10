"use client";
// M1: company profile (Settings). Edits a local draft; "Save" writes it to the store, which autosaves it to MongoDB.
import { useEffect, useRef, useState } from "react";
import { Building2Icon, CheckIcon, CircleAlertIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { demoCompany } from "@/lib/demoData";
import { formatLakh, groupPKR } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

type Draft = {
  name: string;
  city: string;
  isExporter: boolean;
  cashBalance: number;
  monthlyFixedCosts: number;
  taxPct: string; // "29"
  discountPct: string; // "15"
};

function toDraft(c: Company): Draft {
  return {
    name: c.name,
    city: c.city,
    isExporter: c.isExporter,
    cashBalance: c.cashBalance,
    monthlyFixedCosts: c.monthlyFixedCosts,
    taxPct: pctText(c.taxRate),
    discountPct: pctText(c.discountRate),
  };
}

// 0.148 → "14.8" (avoids 14.799999999)
function pctText(rate: number): string {
  return String(Number((rate * 100).toFixed(2)));
}

function parsePct(s: string): number | null {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n / 100 : null;
}

function sameCompany(a: Company, b: Company): boolean {
  return (Object.keys(a) as (keyof Company)[]).every((k) => a[k] === b[k]);
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k]);
}

export default function ProfileForm() {
  const { state, update, saveStatus } = useStore();
  const company = state.company;
  const [draft, setDraft] = useState<Draft>(() => toDraft(company));
  const awaitingSave = useRef<string | null>(null); // toast message to show once the save lands

  // Re-sync the draft when the store's company changes (demo load, edits elsewhere).
  const [syncedCompany, setSyncedCompany] = useState(company);
  if (company !== syncedCompany) {
    setSyncedCompany(company);
    setDraft(toDraft(company));
  }

  // Toast when the autosave that follows a Save / demo load finishes.
  useEffect(() => {
    if (!awaitingSave.current) return;
    if (saveStatus === "saved") {
      toast.success(awaitingSave.current);
      awaitingSave.current = null;
    } else if (saveStatus === "error") {
      toast.error("Could not save the company profile. Check your connection and try again.");
      awaitingSave.current = null;
    }
  }, [saveStatus]);

  const isDemo = sameCompany(company, demoCompany);
  const taxRate = parsePct(draft.taxPct);
  const discountRate = parsePct(draft.discountPct);
  const dirty = !sameDraft(draft, toDraft(company));
  const canSave = dirty && draft.name.trim() !== "" && taxRate !== null && discountRate !== null;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (!canSave) return;
    const next: Company = {
      name: draft.name.trim(),
      city: draft.city.trim(),
      isExporter: draft.isExporter,
      cashBalance: draft.cashBalance,
      monthlyFixedCosts: draft.monthlyFixedCosts,
      taxRate: taxRate!,
      discountRate: discountRate!,
    };
    awaitingSave.current = "Company profile saved";
    // Company feeds the comparison, so any earlier decision/memo is stale.
    update({ company: next, decision: null, memo: null });
  }

  function loadDemo() {
    if (isDemo) {
      setDraft(toDraft(demoCompany));
      return;
    }
    awaitingSave.current = "Demo company loaded";
    update({ company: demoCompany, decision: null, memo: null });
    setDraft(toDraft(demoCompany));
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Building2Icon className="size-4 text-muted-foreground" />
          Company profile
        </CardTitle>
        <CardDescription>Used for cash runway, tax and the cost of money. Set it once.</CardDescription>
        <CardAction className="flex items-center gap-2">
          {isDemo && <Badge variant="outline">Demo data</Badge>}
          <Button variant="outline" size="sm" onClick={loadDemo}>
            <RotateCcwIcon data-icon="inline-start" />
            Load demo company
          </Button>
        </CardAction>
      </CardHeader>

      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pf-name">Business name</FieldLabel>
              <Input
                id="pf-name"
                value={draft.name}
                aria-invalid={draft.name.trim() === "" || undefined}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pf-city">City</FieldLabel>
              <Input id="pf-city" value={draft.city} onChange={(e) => set("city", e.target.value)} />
            </Field>

            <MoneyField id="pf-cash" label="Cash in bank" value={draft.cashBalance} onChange={(v) => set("cashBalance", v)} />
            <MoneyField
              id="pf-fixed"
              label="Monthly fixed costs"
              hint="Salaries, rent, utilities, loan payments"
              value={draft.monthlyFixedCosts}
              onChange={(v) => set("monthlyFixedCosts", v)}
            />

            <PctField
              id="pf-tax"
              label="Tax rate"
              value={draft.taxPct}
              invalid={taxRate === null}
              onChange={(v) => set("taxPct", v)}
            />
            <PctField
              id="pf-discount"
              label="Discount rate (cost of money)"
              hint="≈ your bank borrowing rate, KIBOR + 3%"
              value={draft.discountPct}
              invalid={discountRate === null}
              onChange={(v) => set("discountPct", v)}
            />

            <Field orientation="horizontal" className="rounded-lg border p-3 sm:col-span-2">
              <Switch id="pf-exporter" checked={draft.isExporter} onCheckedChange={(v) => set("isExporter", v)} />
              <FieldContent>
                <FieldLabel htmlFor="pf-exporter">We are an exporter</FieldLabel>
                <FieldDescription>Eligible for SBP LTFF cheap machinery loans (policy rate − 3%).</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-between gap-3">
          <SaveState dirty={dirty} status={saveStatus} />
          <Button type="submit" disabled={!canSave}>
            <SaveIcon data-icon="inline-start" />
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SaveState({ dirty, status }: { dirty: boolean; status: ReturnType<typeof useStore>["saveStatus"] }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner className="size-3.5" /> Saving…
      </span>
    );
  }
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
  return <span className="text-xs text-muted-foreground">Changes apply to new comparisons.</span>;
}

function MoneyField(props: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          Rs
        </span>
        <Input
          id={props.id}
          className="pl-8 font-mono tabular-nums"
          inputMode="numeric"
          value={props.value ? groupPKR(props.value) : ""}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            props.onChange(digits ? Number(digits) : 0);
          }}
        />
      </div>
      <FieldDescription className="text-xs">
        {props.value > 0 ? `= ${formatLakh(props.value, 2)}` : ""}
        {props.value > 0 && props.hint ? " · " : ""}
        {props.hint}
      </FieldDescription>
    </Field>
  );
}

function PctField(props: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Field data-invalid={props.invalid || undefined}>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <div className="relative">
        <Input
          id={props.id}
          className="pr-8 font-mono tabular-nums"
          inputMode="decimal"
          value={props.value}
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
          %
        </span>
      </div>
      <FieldDescription className="text-xs">
        {props.invalid ? "Enter a percentage between 0 and 100" : props.hint}
      </FieldDescription>
    </Field>
  );
}
