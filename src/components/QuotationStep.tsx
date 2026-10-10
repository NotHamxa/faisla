"use client";
// M2: upload a quotation → AI extraction → owner checks every field → confirmed offer.
// Arithmetic checks run live in code on every edit; the AI never computes a total.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { demoQuotation } from "@/lib/demoData";
import { formatPKR, groupPKR } from "@/lib/format";
import {
  checkArithmetic,
  emptyQuotation,
  lineAmount,
  quotationCashPrice,
  quotationListTotal,
  quotationToOffer,
} from "@/lib/quotation";
import { useStore } from "@/lib/store";
import type { ArithmeticIssue, NeedsOwnerInput, Quotation, QuotationItem } from "@/lib/types";

type View = "auto" | "upload" | "confirm";
type DraftSource = "ai" | "demo" | "manual" | "edit";
type Preview = { url: string | null; name: string; isPdf: boolean };
type ExtractOk = { quotation: Quotation; issues: ArithmeticIssue[]; source: "ai" | "demo" };
type ExtractResponse = ExtractOk | NeedsOwnerInput | { error: string };

const MAX_BYTES = 10 * 1024 * 1024;
const READABLE_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const REQUEST_TIMEOUT_MS = 75_000;

export default function QuotationStep() {
  const { state, update, upsertOffer } = useStore();
  const [view, setView] = useState<View>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Quotation | null>(null);
  const [source, setSource] = useState<DraftSource | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Free the previous preview's object URL when it is replaced or the component unmounts.
  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);

  function openForm(q: Quotation, from: DraftSource, why: string | null = null) {
    setDraft(q);
    setSource(from);
    setReason(why);
    setError(null);
    setView("confirm");
  }

  async function extract(body: FormData | { demo: true }) {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const isForm = body instanceof FormData;
      const res = await fetch("/api/extract", {
        method: "POST",
        body: isForm ? body : JSON.stringify(body),
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as ExtractResponse | null;
      if (data && "quotation" in data) openForm(data.quotation, data.source);
      else if (data && "needsOwnerInput" in data) openForm(emptyQuotation(), "manual", data.reason);
      else if (data && "error" in data) setError(data.error);
      else setError(`Upload failed (${res.status}). Try a smaller photo, the demo quotation, or type it in.`);
    } catch {
      setError("Couldn't reach the AI in time. Try again, use the demo quotation, or type it in yourself.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf && !file.type.startsWith("image/")) {
      setError("Upload a photo (JPG, PNG) or a PDF of the quotation.");
      return;
    }
    const upload = isPdf ? file : await shrinkImage(file);
    if (upload.size > MAX_BYTES) {
      setError("File is larger than 10 MB. Try a smaller photo.");
      return;
    }
    setPreview({ url: isPdf ? null : URL.createObjectURL(upload), name: file.name, isPdf });
    const form = new FormData();
    const name = isPdf ? file.name : file.name.replace(/\.\w+$/, "") + (upload.type === "image/jpeg" ? ".jpg" : "");
    form.append("file", upload, name || "quotation");
    await extract(form);
  }

  function confirm(q: Quotation) {
    const clean: Quotation = {
      ...q,
      supplierName: q.supplierName.trim(),
      items: q.items.map((item) => ({ ...item, description: item.description.trim() })),
    };
    update({ quotation: clean, quotationConfirmed: true });
    upsertOffer(quotationToOffer(clean));
    setView("auto");
  }

  if (view === "confirm" && draft) {
    return (
      <ConfirmForm
        draft={draft}
        setDraft={setDraft}
        source={source}
        reason={reason}
        preview={preview}
        canCancel={state.quotationConfirmed && state.quotation !== null}
        onCancel={() => setView("auto")}
        onRestart={() => setView("upload")}
        onConfirm={confirm}
      />
    );
  }

  if (view === "auto" && state.quotationConfirmed && state.quotation) {
    return <SummaryCard quotation={state.quotation} onEdit={() => openForm(state.quotation!, "edit")} />;
  }

  return (
    <UploadPanel
      loading={loading}
      error={error}
      preview={preview}
      onFile={handleFile}
      onDemo={() => {
        setPreview(null);
        extract({ demo: true });
      }}
      onManual={() => openForm(emptyQuotation(), "manual")}
      onCancel={state.quotationConfirmed ? () => setView("auto") : undefined}
    />
  );
}

// Phone photos are often 5–12 MB (and HEIC on iPhone). Re-encode to a ~2000px JPEG so the upload
// stays under hosting body limits and the model gets a format it reads. Falls back to the original.
async function shrinkImage(file: File): Promise<Blob> {
  if (READABLE_IMAGES.includes(file.type) && file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/* ---------- Upload ---------- */

function UploadPanel(props: {
  loading: boolean;
  error: string | null;
  preview: Preview | null;
  onFile: (file: File) => void;
  onDemo: () => void;
  onManual: () => void;
  onCancel?: () => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function takeFile(files: FileList | null) {
    const file = files?.[0];
    if (file && !props.loading) props.onFile(file);
  }

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Supplier quotation</h2>
          <p className="card-sub">Upload a photo or PDF. AI reads it, you check every number.</p>
        </div>
        {props.onCancel && (
          <button type="button" className="btn-ghost" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div
        className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragging ? "border-brand bg-brand-soft" : "border-line bg-paper/60"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer.files);
        }}
      >
        {props.preview && (
          <PreviewThumb preview={props.preview} className={props.loading ? "opacity-50" : ""} />
        )}

        {props.loading ? (
          <div className="flex items-center gap-3 text-sm text-ink" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            AI is reading the quotation…
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">Drag a quotation here, or</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => pickerRef.current?.click()}>
                Choose photo or PDF
              </button>
              <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>
                Take photo
              </button>
              <button type="button" className="btn" onClick={props.onDemo}>
                Use demo quotation
              </button>
            </div>
          </>
        )}

        <input
          ref={pickerRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            takeFile(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            takeFile(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {props.error && (
        <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
          {props.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <button type="button" className="underline hover:text-ink" onClick={props.onManual} disabled={props.loading}>
          No photo? Type the quotation in yourself
        </button>
        <Link href="/demo/quotation" target="_blank" className="underline hover:text-ink">
          Printable demo quotation
        </Link>
      </div>
    </section>
  );
}

function PreviewThumb({ preview, className = "" }: { preview: Preview; className?: string }) {
  if (preview.isPdf || !preview.url) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm ${className}`}>
        <span className="badge-muted">PDF</span>
        <span className="max-w-[16rem] truncate">{preview.name}</span>
      </div>
    );
  }
  return (
    // Object URL of a local file; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preview.url}
      alt="Uploaded quotation"
      className={`max-h-72 w-auto rounded-lg border border-line bg-white object-contain shadow-sm ${className}`}
    />
  );
}

/* ---------- Confirm ---------- */

function ConfirmForm(props: {
  draft: Quotation;
  setDraft: (q: Quotation) => void;
  source: DraftSource | null;
  reason: string | null;
  preview: Preview | null;
  canCancel: boolean;
  onCancel: () => void;
  onRestart: () => void;
  onConfirm: (q: Quotation) => void;
}) {
  const { draft, setDraft } = props;
  const issues = useMemo(() => checkArithmetic(draft), [draft]);
  const first = draft.items[0];

  const missing: string[] = [];
  if (!draft.supplierName.trim()) missing.push("supplier name");
  if (!first || !first.description.trim()) missing.push("item description");
  if (!first || !(first.qty > 0)) missing.push("quantity");
  if (!first || !(first.unitPrice > 0)) missing.push("unit price");

  function patch(p: Partial<Quotation>) {
    setDraft({ ...draft, ...p });
  }
  function patchItem(i: number, p: Partial<QuotationItem>) {
    setDraft({ ...draft, items: draft.items.map((item, j) => (j === i ? { ...item, ...p } : item)) });
  }
  const issuesFor = (field: string) => issues.filter((x) => x.field === field);

  const showPreview = props.preview && props.source !== "manual" && props.source !== "demo";

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Check the quotation</h2>
          {props.source === "ai" && <p className="card-sub">AI read this — please check every field.</p>}
          {props.source === "demo" && <p className="card-sub">Demo quotation loaded — please check every field.</p>}
          {props.source === "manual" && <p className="card-sub">Type the details exactly as printed.</p>}
          {props.source === "edit" && <p className="card-sub">Edit any field, then confirm again.</p>}
        </div>
        <div className="flex items-center gap-2">
          {props.source === "ai" && <span className="badge-warn">AI read this</span>}
          {props.source === "demo" && <span className="badge-muted">Demo data</span>}
          {props.canCancel && (
            <button type="button" className="btn-ghost" onClick={props.onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={props.onRestart}>
            Upload a different quotation
          </button>
        </div>
      </div>

      {props.reason && (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
          {props.reason}
        </p>
      )}

      <div className={showPreview ? "grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr]" : ""}>
        {showPreview && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <PreviewThumb preview={props.preview!} />
          </div>
        )}

        <div className="space-y-6">
          <IssueSummary issues={issues} />

          {/* Supplier */}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-ink">Supplier</legend>
            <Field label="Supplier name" id="q-supplier" className="sm:col-span-2">
              <input
                id="q-supplier"
                className="input"
                value={draft.supplierName}
                onChange={(e) => patch({ supplierName: e.target.value })}
              />
            </Field>
            <Field label="Phone" id="q-phone">
              <input
                id="q-phone"
                className="input"
                value={draft.supplierPhone ?? ""}
                onChange={(e) => patch({ supplierPhone: e.target.value || null })}
              />
            </Field>
            <Field label="Email" id="q-email">
              <input
                id="q-email"
                type="email"
                className="input"
                value={draft.supplierEmail ?? ""}
                onChange={(e) => patch({ supplierEmail: e.target.value || null })}
              />
            </Field>
            <Field label="Quotation date" id="q-date">
              <input
                id="q-date"
                type="date"
                className="input"
                value={draft.quoteDate ?? ""}
                onChange={(e) => patch({ quoteDate: e.target.value || null })}
              />
            </Field>
            <Field label="Valid for (days)" id="q-validity">
              <NumInput
                id="q-validity"
                kind="int"
                value={draft.validityDays}
                onChange={(v) => patch({ validityDays: v })}
                suffix="days"
              />
            </Field>
          </fieldset>

          {/* Items */}
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold text-ink">Items</legend>
            {draft.items.map((item, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-6">
                  <Field label="Description" id={`q-desc-${i}`} className="sm:col-span-4">
                    <input
                      id={`q-desc-${i}`}
                      className="input"
                      value={item.description}
                      onChange={(e) => patchItem(i, { description: e.target.value })}
                    />
                  </Field>
                  <Field label="Model" id={`q-model-${i}`} className="sm:col-span-2">
                    <input
                      id={`q-model-${i}`}
                      className="input"
                      value={item.model ?? ""}
                      onChange={(e) => patchItem(i, { model: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Qty" id={`q-qty-${i}`} issues={issuesFor(`items.${i}.qty`)}>
                    <NumInput
                      id={`q-qty-${i}`}
                      kind="int"
                      required
                      value={item.qty}
                      onChange={(v) => patchItem(i, { qty: v ?? 0 })}
                    />
                  </Field>
                  <Field
                    label="Unit price"
                    id={`q-price-${i}`}
                    className="sm:col-span-2"
                    issues={issuesFor(`items.${i}.unitPrice`)}
                  >
                    <NumInput
                      id={`q-price-${i}`}
                      kind="money"
                      required
                      value={item.unitPrice}
                      onChange={(v) => patchItem(i, { unitPrice: v ?? 0 })}
                    />
                  </Field>
                  <Field
                    label="Line total (as printed)"
                    id={`q-line-${i}`}
                    className="sm:col-span-3"
                    issues={issuesFor(`items.${i}.lineTotal`)}
                  >
                    <NumInput
                      id={`q-line-${i}`}
                      kind="money"
                      value={item.lineTotal}
                      onChange={(v) => patchItem(i, { lineTotal: v })}
                      placeholder="Not printed"
                    />
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    Faisla computes:{" "}
                    <span className="num text-ink">
                      {item.qty} × {formatPKR(item.unitPrice)} = {formatPKR(lineAmount(item))}
                    </span>
                  </span>
                  {draft.items.length > 1 && (
                    <button
                      type="button"
                      className="underline hover:text-bad"
                      onClick={() => patch({ items: draft.items.filter((_, j) => j !== i) })}
                    >
                      Remove line
                    </button>
                  )}
                </div>
              </div>
            ))}
            <IssueList issues={issuesFor("items")} />
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              onClick={() =>
                patch({ items: [...draft.items, { description: "", model: null, qty: 1, unitPrice: 0, lineTotal: null }] })
              }
            >
              + Add line
            </button>
          </fieldset>

          {/* Totals and payment terms */}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-ink">Totals and payment terms</legend>
            <Field label="Total (as printed)" id="q-total" issues={issuesFor("printedTotal")}>
              <NumInput
                id="q-total"
                kind="money"
                value={draft.printedTotal}
                onChange={(v) => patch({ printedTotal: v })}
                placeholder="Not printed"
              />
              <p className="mt-1 text-xs text-muted">
                Lines add up to <span className="num text-ink">{formatPKR(quotationListTotal(draft))}</span>
              </p>
            </Field>
            <Field label="Cash discount" id="q-discount" issues={issuesFor("cashDiscountPct")}>
              <DecimalInput
                id="q-discount"
                value={draft.cashDiscountPct}
                onChange={(v) => patch({ cashDiscountPct: v })}
                suffix="%"
              />
              {draft.cashDiscountPct ? (
                <p className="mt-1 text-xs text-muted">
                  Cash price <span className="num text-ink">{formatPKR(quotationCashPrice(draft))}</span>
                </p>
              ) : null}
            </Field>
            <Field label="Installments (months)" id="q-months">
              <NumInput
                id="q-months"
                kind="int"
                value={draft.installmentMonths}
                onChange={(v) => patch({ installmentMonths: v })}
                suffix="months"
              />
            </Field>
            <Field label="Each installment" id="q-inst" issues={issuesFor("installmentAmount")}>
              <NumInput
                id="q-inst"
                kind="money"
                value={draft.installmentAmount}
                onChange={(v) => patch({ installmentAmount: v })}
              />
            </Field>
            <Field label='"Markup" claimed' id="q-markup">
              <DecimalInput
                id="q-markup"
                value={draft.markupClaimedPct}
                onChange={(v) => patch({ markupClaimedPct: v })}
                suffix="%"
              />
              <p className="mt-1 text-xs text-muted">What the supplier says, e.g. &quot;0% markup&quot;</p>
            </Field>
            <div>
              <span className="label">First installment due</span>
              <TriToggle
                value={draft.firstInstallmentOnDelivery}
                onChange={(v) => patch({ firstInstallmentOnDelivery: v })}
              />
              <p className="mt-1 text-xs text-muted">If due on delivery, the hidden rate is higher.</p>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {missing.length > 0 && <span className="text-xs text-muted">Still needed: {missing.join(", ")}</span>}
            <button
              type="button"
              className="btn-primary"
              disabled={missing.length > 0}
              onClick={() => props.onConfirm(draft)}
            >
              Confirm quotation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function IssueSummary({ issues }: { issues: ArithmeticIssue[] }) {
  if (issues.length === 0) return <span className="badge-good">Arithmetic checks pass</span>;
  return (
    <span className="badge-warn">
      {issues.length === 1 ? "1 thing to check" : `${issues.length} things to check`} — see highlighted fields
    </span>
  );
}

function IssueList({ issues }: { issues: ArithmeticIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {issues.map((issue, k) => (
        <p key={k} className="badge-warn whitespace-normal rounded-md py-1 leading-snug">
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function Field(props: {
  label: string;
  id: string;
  className?: string;
  issues?: ArithmeticIssue[];
  children: React.ReactNode;
}) {
  return (
    <div className={props.className}>
      <label className="label" htmlFor={props.id}>
        {props.label}
      </label>
      {props.children}
      <IssueList issues={props.issues ?? []} />
    </div>
  );
}

// Money shows lakh grouping (15,00,000); int is plain digits. Empty → null unless required (→ 0).
function NumInput(props: {
  id: string;
  kind: "money" | "int";
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  const { value, kind } = props;
  const empty = value === null || (props.required && value === 0);
  const display = empty ? "" : kind === "money" ? groupPKR(value!) : String(value);
  return (
    <div className="relative">
      {kind === "money" && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">Rs</span>
      )}
      <input
        id={props.id}
        className={`input num ${kind === "money" ? "pl-9" : ""} ${props.suffix ? "pr-16" : ""}`}
        inputMode="numeric"
        value={display}
        placeholder={props.placeholder ?? (props.required ? "0" : "—")}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          props.onChange(digits ? Number(digits) : props.required ? 0 : null);
        }}
      />
      {props.suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {props.suffix}
        </span>
      )}
    </div>
  );
}

// Percentages may have decimals ("8.5"), so keep the typed text locally while the parent holds the number.
function DecimalInput(props: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
}) {
  const [text, setText] = useState(props.value === null ? "" : String(props.value));
  const [lastValue, setLastValue] = useState(props.value);
  if (props.value !== lastValue) {
    setLastValue(props.value);
    setText(props.value === null ? "" : String(props.value));
  }
  return (
    <div className="relative">
      <input
        id={props.id}
        className="input num pr-10"
        inputMode="decimal"
        value={text}
        placeholder="—"
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          const n = t === "" ? null : Number.parseFloat(t);
          const v = n !== null && Number.isFinite(n) ? n : null;
          setText(t);
          setLastValue(v);
          props.onChange(v);
        }}
      />
      {props.suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {props.suffix}
        </span>
      )}
    </div>
  );
}

function TriToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const options: { label: string; v: boolean | null }[] = [
    { label: "1 month after delivery", v: false },
    { label: "On delivery", v: true },
    { label: "Not stated", v: null },
  ];
  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-xs" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`flex-1 px-2 py-2 font-medium transition ${
            value === o.v ? "bg-brand text-white" : "bg-white text-ink hover:bg-paper"
          }`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Summary ---------- */

function SummaryCard({ quotation: q, onEdit }: { quotation: Quotation; onEdit: () => void }) {
  const issues = useMemo(() => checkArithmetic(q), [q]);
  const first = q.items[0];
  const isDemo = JSON.stringify(q) === JSON.stringify(demoQuotation);

  const terms: string[] = [];
  if (q.cashDiscountPct) terms.push(`${q.cashDiscountPct}% cash discount → ${formatPKR(quotationCashPrice(q))} cash`);
  if (q.installmentMonths && q.installmentAmount) {
    terms.push(`${q.installmentMonths} × ${formatPKR(q.installmentAmount)} installments`);
  }
  if (q.markupClaimedPct !== null) terms.push(`"${q.markupClaimedPct}% markup" claimed`);
  if (q.firstInstallmentOnDelivery !== null) {
    terms.push(q.firstInstallmentOnDelivery ? "First installment on delivery" : "First installment 1 month after delivery");
  }
  if (q.validityDays) terms.push(`Valid ${q.validityDays} days`);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="card-title">{q.supplierName}</h2>
            <span className="badge-good">Quotation confirmed</span>
            {isDemo && <span className="badge-muted">Demo data</span>}
          </div>
          {first && (
            <p className="card-sub">
              {first.description}
              {first.model ? ` · ${first.model}` : ""}
              {q.quoteDate ? ` · ${q.quoteDate}` : ""}
            </p>
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={onEdit}>
          Edit
        </button>
      </div>

      {first && (
        <p className="num mt-3 text-xl font-semibold text-ink">
          {first.qty} × {formatPKR(first.unitPrice)} = {formatPKR(lineAmount(first))}
        </p>
      )}
      {q.items.length > 1 && (
        <p className="mt-1 text-xs text-muted">
          + {q.items.length - 1} more line{q.items.length > 2 ? "s" : ""} (all lines: {formatPKR(quotationListTotal(q))});
          the comparison uses the first line.
        </p>
      )}

      {terms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {terms.map((t) => (
            <span key={t} className="badge-muted">
              {t}
            </span>
          ))}
        </div>
      )}

      <IssueList issues={issues} />
    </section>
  );
}
