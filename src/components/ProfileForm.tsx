"use client";
// M1: company profile. Edits a local draft; "Save" writes it to the store and collapses to one line.
import { useState } from "react";
import { demoCompany } from "@/lib/demoData";
import { formatLakh, formatPKR, groupPKR } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";

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

export default function ProfileForm() {
  const { state, update } = useStore();
  const company = state.company;
  const [editing, setEditing] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => toDraft(company));

  // Re-sync the draft when the store's company changes (localStorage load, demo reset).
  const [syncedCompany, setSyncedCompany] = useState(company);
  if (company !== syncedCompany) {
    setSyncedCompany(company);
    setDraft(toDraft(company));
  }

  const isDemo = sameCompany(company, demoCompany);
  const taxRate = parsePct(draft.taxPct);
  const discountRate = parsePct(draft.discountPct);
  const canSave = draft.name.trim() !== "" && taxRate !== null && discountRate !== null;

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
    // Company feeds the comparison, so any earlier decision/memo is stale.
    update({ company: next, decision: null, memo: null });
    setEditing(false);
  }

  function loadDemo() {
    update({ company: demoCompany, decision: null, memo: null });
    setDraft(toDraft(demoCompany));
  }

  if (!editing) {
    return (
      <section className="card flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <span className="font-semibold text-ink">{company.name}</span>
        <span className="text-sm text-muted">
          {company.city}
          {company.isExporter ? " · Exporter" : ""} · Cash <span className="num">{formatPKR(company.cashBalance)}</span> · Fixed
          costs <span className="num">{formatPKR(company.monthlyFixedCosts)}</span>/month · Tax{" "}
          <span className="num">{pctText(company.taxRate)}%</span> · Discount rate{" "}
          <span className="num">{pctText(company.discountRate)}%</span>
        </span>
        {isDemo && <span className="badge-muted">Demo data</span>}
        <button type="button" className="btn-ghost ml-auto px-3 py-1" onClick={() => setEditing(true)}>
          Edit
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Company profile</h2>
          <p className="card-sub">Used for cash runway, tax and the cost of money. Set it once.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && <span className="badge-muted">Demo data</span>}
          <button type="button" className="btn" onClick={loadDemo}>
            Load demo company
          </button>
        </div>
      </div>

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label className="label" htmlFor="pf-name">
            Business name
          </label>
          <input id="pf-name" className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pf-city">
            City
          </label>
          <input id="pf-city" className="input" value={draft.city} onChange={(e) => set("city", e.target.value)} />
        </div>

        <MoneyField
          id="pf-cash"
          label="Cash in bank"
          value={draft.cashBalance}
          onChange={(v) => set("cashBalance", v)}
        />
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

        <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={draft.isExporter}
            onChange={(e) => set("isExporter", e.target.checked)}
          />
          <span className="text-sm text-ink">
            We are an exporter <span className="text-muted">(eligible for SBP LTFF cheap machinery loans)</span>
          </span>
        </label>

        <div className="flex justify-end sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            Save profile
          </button>
        </div>
      </form>
    </section>
  );
}

function MoneyField(props: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>
        {props.label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">Rs</span>
        <input
          id={props.id}
          className="input num pl-9"
          inputMode="numeric"
          value={props.value ? groupPKR(props.value) : ""}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            props.onChange(digits ? Number(digits) : 0);
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {props.value > 0 ? `= ${formatLakh(props.value, 2)}` : ""}
        {props.value > 0 && props.hint ? " · " : ""}
        {props.hint}
      </p>
    </div>
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
    <div>
      <label className="label" htmlFor={props.id}>
        {props.label}
      </label>
      <div className="relative">
        <input
          id={props.id}
          className={`input num pr-8 ${props.invalid ? "border-bad" : ""}`}
          inputMode="decimal"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span>
      </div>
      <p className="mt-1 text-xs text-muted">{props.invalid ? "Enter a percentage between 0 and 100" : props.hint}</p>
    </div>
  );
}
