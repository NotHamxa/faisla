"use client";
// M2: upload a quotation → AI extraction → owner checks every field → confirmed offer.
// Arithmetic checks run live in code on every edit; the AI never computes a total.
import { formatIban, isValidIban, normalizeIban } from "@/lib/fraud";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
  FileUp,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import { cn } from "@/lib/utils";

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
      if (data && "quotation" in data) {
        openForm(data.quotation, data.source);
        if (data.source === "ai") toast.success("Quotation read", { description: "Check every field before confirming." });
      } else if (data && "needsOwnerInput" in data) openForm(emptyQuotation(), "manual", data.reason);
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
    toast.success("Quotation confirmed", { description: "Faisla is checking the market price next." });
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
    <Card>
      <CardHeader>
        <CardTitle>Supplier quotation</CardTitle>
        <CardDescription>Upload a photo or PDF. AI reads it, you check every number.</CardDescription>
        {props.onCancel && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              Cancel
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-[2px] border border-dashed px-4 py-9 text-center transition-colors",
            dragging ? "border-primary bg-muted" : "border-foreground/30 bg-background",
          )}
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
          {props.preview ? (
            <PreviewThumb preview={props.preview} className={props.loading ? "opacity-50" : ""} />
          ) : (
            !props.loading && (
              <div className="flex size-11 items-center justify-center rounded-[2px] border border-foreground/20 bg-card text-primary">
                <Upload className="size-5" />
              </div>
            )
          )}

          {props.loading ? (
            <div className="flex items-center gap-2 text-sm font-medium" role="status">
              <Spinner className="text-primary" />
              AI is reading the quotation…
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Drag a quotation here, or</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => pickerRef.current?.click()}>
                  <FileUp data-icon="inline-start" />
                  Choose photo or PDF
                </Button>
                <Button variant="outline" onClick={() => cameraRef.current?.click()}>
                  <Camera data-icon="inline-start" />
                  Take photo
                </Button>
                <Button variant="outline" onClick={props.onDemo}>
                  <Sparkles data-icon="inline-start" />
                  Use demo quotation
                </Button>
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
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription className="text-destructive">{props.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <Button variant="link" size="xs" className="h-auto px-0 text-muted-foreground hover:text-foreground" onClick={props.onManual} disabled={props.loading}>
            No photo? Type the quotation in yourself
          </Button>
          <Link
            href="/demo/quotation"
            target="_blank"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Printable demo quotation
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewThumb({ preview, className = "" }: { preview: Preview; className?: string }) {
  if (preview.isPdf || !preview.url) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm", className)}>
        <FileText className="size-4 text-muted-foreground" />
        <Badge variant="secondary">PDF</Badge>
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
      className={cn("max-h-72 w-auto rounded-[2px] border bg-card object-contain", className)}
    />
  );
}

/* ---------- Confirm ---------- */

const SOURCE_HINT: Record<DraftSource, string> = {
  ai: "AI read this — please check every field.",
  demo: "Demo quotation loaded — please check every field.",
  manual: "Type the details exactly as printed.",
  edit: "Edit any field, then confirm again.",
};

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
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Check the quotation</CardTitle>
            {props.source === "ai" && (
              <Badge variant="warning">
                <Sparkles />
                AI read this
              </Badge>
            )}
            {props.source === "demo" && <Badge variant="secondary">Demo data</Badge>}
          </div>
          {props.source && <CardDescription>{SOURCE_HINT[props.source]}</CardDescription>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.canCancel && (
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={props.onRestart}>
            <Upload data-icon="inline-start" />
            Upload a different quotation
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {props.reason && <WarningNote>{props.reason}</WarningNote>}

        <div className={showPreview ? "grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr]" : ""}>
          {showPreview && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <PreviewThumb preview={props.preview!} />
            </div>
          )}

          <div className="flex flex-col gap-6">
            <IssueSummary issues={issues} />

            {/* Supplier */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Supplier</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Supplier name" id="q-supplier" className="sm:col-span-2">
                  <Input
                    id="q-supplier"
                    value={draft.supplierName}
                    onChange={(e) => patch({ supplierName: e.target.value })}
                  />
                </FormField>
                <FormField label="Phone" id="q-phone">
                  <Input
                    id="q-phone"
                    value={draft.supplierPhone ?? ""}
                    onChange={(e) => patch({ supplierPhone: e.target.value || null })}
                  />
                </FormField>
                <FormField label="Email" id="q-email">
                  <Input
                    id="q-email"
                    type="email"
                    value={draft.supplierEmail ?? ""}
                    onChange={(e) => patch({ supplierEmail: e.target.value || null })}
                  />
                </FormField>
                <FormField label="Quotation date" id="q-date">
                  <Input
                    id="q-date"
                    type="date"
                    value={draft.quoteDate ?? ""}
                    onChange={(e) => patch({ quoteDate: e.target.value || null })}
                  />
                </FormField>
                <FormField label="Valid for (days)" id="q-validity">
                  <NumInput
                    id="q-validity"
                    kind="int"
                    value={draft.validityDays}
                    onChange={(v) => patch({ validityDays: v })}
                    suffix="days"
                  />
                </FormField>
              </div>
            </FieldSet>

            {/* Bank details: kept on file for the payment-fraud check */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Bank details (for payment)</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Bank" id="q-bank">
                  <Input id="q-bank" value={draft.bankName ?? ""} onChange={(e) => patch({ bankName: e.target.value || null })} />
                </FormField>
                <FormField label="Account title" id="q-title">
                  <Input
                    id="q-title"
                    value={draft.accountTitle ?? ""}
                    onChange={(e) => patch({ accountTitle: e.target.value || null })}
                  />
                </FormField>
                <FormField label="IBAN" id="q-iban">
                  <Input
                    id="q-iban"
                    className="font-mono"
                    value={draft.iban ? formatIban(draft.iban) : ""}
                    onChange={(e) => patch({ iban: e.target.value.trim() ? normalizeIban(e.target.value) : null })}
                    placeholder="PK00 BANK 0000 0000 0000 0000"
                  />
                </FormField>
              </div>
              {draft.iban && (
                <p className={cn("text-xs", isValidIban(draft.iban) ? "text-success" : "text-destructive")}>
                  {isValidIban(draft.iban)
                    ? "IBAN checksum OK. Faisla will warn you if a later email asks you to pay a different account."
                    : "This IBAN fails the checksum: check it against the paper quotation before paying."}
                </p>
              )}
            </FieldSet>

            {/* Items */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Items</FieldLegend>
              {draft.items.map((item, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-6">
                    <FormField label="Description" id={`q-desc-${i}`} className="sm:col-span-4">
                      <Input
                        id={`q-desc-${i}`}
                        value={item.description}
                        onChange={(e) => patchItem(i, { description: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Model" id={`q-model-${i}`} className="sm:col-span-2">
                      <Input
                        id={`q-model-${i}`}
                        value={item.model ?? ""}
                        onChange={(e) => patchItem(i, { model: e.target.value || null })}
                      />
                    </FormField>
                    <FormField label="Qty" id={`q-qty-${i}`} issues={issuesFor(`items.${i}.qty`)}>
                      <NumInput
                        id={`q-qty-${i}`}
                        kind="int"
                        required
                        warn={issuesFor(`items.${i}.qty`).length > 0}
                        value={item.qty}
                        onChange={(v) => patchItem(i, { qty: v ?? 0 })}
                      />
                    </FormField>
                    <FormField
                      label="Unit price"
                      id={`q-price-${i}`}
                      className="sm:col-span-2"
                      issues={issuesFor(`items.${i}.unitPrice`)}
                    >
                      <NumInput
                        id={`q-price-${i}`}
                        kind="money"
                        required
                        warn={issuesFor(`items.${i}.unitPrice`).length > 0}
                        value={item.unitPrice}
                        onChange={(v) => patchItem(i, { unitPrice: v ?? 0 })}
                      />
                    </FormField>
                    <FormField
                      label="Line total (as printed)"
                      id={`q-line-${i}`}
                      className="sm:col-span-3"
                      issues={issuesFor(`items.${i}.lineTotal`)}
                    >
                      <NumInput
                        id={`q-line-${i}`}
                        kind="money"
                        warn={issuesFor(`items.${i}.lineTotal`).length > 0}
                        value={item.lineTotal}
                        onChange={(v) => patchItem(i, { lineTotal: v })}
                        placeholder="Not printed"
                      />
                    </FormField>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Faisla computes:{" "}
                      <span className="font-mono text-foreground tabular-nums">
                        {item.qty} × {formatPKR(item.unitPrice)} = {formatPKR(lineAmount(item))}
                      </span>
                    </span>
                    {draft.items.length > 1 && (
                      <Button
                        variant="link"
                        size="xs"
                        className="h-auto px-0 text-muted-foreground hover:text-destructive"
                        onClick={() => patch({ items: draft.items.filter((_, j) => j !== i) })}
                      >
                        Remove line
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <IssueList issues={issuesFor("items")} />
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  patch({ items: [...draft.items, { description: "", model: null, qty: 1, unitPrice: 0, lineTotal: null }] })
                }
              >
                <Plus data-icon="inline-start" />
                Add line
              </Button>
            </FieldSet>

            {/* Totals and payment terms */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Totals and payment terms</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Total (as printed)" id="q-total" issues={issuesFor("printedTotal")}>
                  <NumInput
                    id="q-total"
                    kind="money"
                    warn={issuesFor("printedTotal").length > 0}
                    value={draft.printedTotal}
                    onChange={(v) => patch({ printedTotal: v })}
                    placeholder="Not printed"
                  />
                  <FieldDescription className="text-xs">
                    Lines add up to{" "}
                    <span className="font-mono text-foreground tabular-nums">{formatPKR(quotationListTotal(draft))}</span>
                  </FieldDescription>
                </FormField>
                <FormField label="Cash discount" id="q-discount" issues={issuesFor("cashDiscountPct")}>
                  <DecimalInput
                    id="q-discount"
                    value={draft.cashDiscountPct}
                    onChange={(v) => patch({ cashDiscountPct: v })}
                    suffix="%"
                  />
                  {draft.cashDiscountPct ? (
                    <FieldDescription className="text-xs">
                      Cash price{" "}
                      <span className="font-mono text-foreground tabular-nums">{formatPKR(quotationCashPrice(draft))}</span>
                    </FieldDescription>
                  ) : null}
                </FormField>
                <FormField label="Installments (months)" id="q-months">
                  <NumInput
                    id="q-months"
                    kind="int"
                    value={draft.installmentMonths}
                    onChange={(v) => patch({ installmentMonths: v })}
                    suffix="months"
                  />
                </FormField>
                <FormField label="Each installment" id="q-inst" issues={issuesFor("installmentAmount")}>
                  <NumInput
                    id="q-inst"
                    kind="money"
                    warn={issuesFor("installmentAmount").length > 0}
                    value={draft.installmentAmount}
                    onChange={(v) => patch({ installmentAmount: v })}
                  />
                </FormField>
                <FormField label='"Markup" claimed' id="q-markup">
                  <DecimalInput
                    id="q-markup"
                    value={draft.markupClaimedPct}
                    onChange={(v) => patch({ markupClaimedPct: v })}
                    suffix="%"
                  />
                  <FieldDescription className="text-xs">The supplier&apos;s own wording, e.g. &quot;0% markup&quot;</FieldDescription>
                </FormField>
                <Field className="gap-1.5">
                  <FieldTitle>First installment due</FieldTitle>
                  <TriToggle
                    value={draft.firstInstallmentOnDelivery}
                    onChange={(v) => patch({ firstInstallmentOnDelivery: v })}
                  />
                  <FieldDescription className="text-xs">If due on delivery, paying later costs more.</FieldDescription>
                </Field>
              </div>
            </FieldSet>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              {missing.length > 0 && (
                <span className="text-xs text-muted-foreground">Still needed: {missing.join(", ")}</span>
              )}
              <Button disabled={missing.length > 0} onClick={() => props.onConfirm(draft)}>
                <Check data-icon="inline-start" />
                Confirm quotation
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WarningNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[2px] border border-l-[3px] border-warning/50 border-l-warning bg-card px-3 py-2 text-sm text-warning",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 leading-snug">{children}</span>
    </div>
  );
}

function IssueSummary({ issues }: { issues: ArithmeticIssue[] }) {
  if (issues.length === 0) {
    return (
      <Badge variant="success">
        <CircleCheck />
        Arithmetic checks pass
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <TriangleAlert />
      {issues.length === 1 ? "1 thing to check" : `${issues.length} things to check`} — see highlighted fields
    </Badge>
  );
}

function IssueList({ issues }: { issues: ArithmeticIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {issues.map((issue, k) => (
        <WarningNote key={k} className="px-2 py-1 text-xs">
          {issue.message}
        </WarningNote>
      ))}
    </div>
  );
}

function FormField(props: {
  label: string;
  id: string;
  className?: string;
  issues?: ArithmeticIssue[];
  children: React.ReactNode;
}) {
  return (
    <Field className={cn("gap-1.5", props.className)}>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      {props.children}
      <IssueList issues={props.issues ?? []} />
    </Field>
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
  warn?: boolean;
}) {
  const { value, kind } = props;
  const empty = value === null || (props.required && value === 0);
  const display = empty ? "" : kind === "money" ? groupPKR(value!) : String(value);
  return (
    <div className="relative">
      {kind === "money" && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          Rs
        </span>
      )}
      <Input
        id={props.id}
        className={cn(
          "font-mono tabular-nums",
          kind === "money" && "pl-8",
          props.suffix && "pr-16",
          props.warn && "border-warning focus-visible:border-warning focus-visible:ring-warning/30",
        )}
        inputMode="numeric"
        value={display}
        placeholder={props.placeholder ?? (props.required ? "0" : "—")}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          props.onChange(digits ? Number(digits) : props.required ? 0 : null);
        }}
      />
      {props.suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
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
      <Input
        id={props.id}
        className="pr-10 font-mono tabular-nums"
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
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
          {props.suffix}
        </span>
      )}
    </div>
  );
}

// Three-way segmented control; "Not stated" keeps the field null.
function TriToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const options: { label: string; v: boolean | null }[] = [
    { label: "1 month after delivery", v: false },
    { label: "On delivery", v: true },
    { label: "Not stated", v: null },
  ];
  return (
    <div className="flex gap-px overflow-hidden rounded-[2px] border bg-border text-xs" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={cn(
            "flex-1 px-2 py-1.5 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
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
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle className="truncate">{q.supplierName}</CardTitle>
          <Badge variant="success">
            <CircleCheck />
            Quotation confirmed
          </Badge>
          {isDemo && <Badge variant="secondary">Demo data</Badge>}
        </div>
        {first && (
          <CardDescription>
            {first.description}
            {first.model ? ` · ${first.model}` : ""}
            {q.quoteDate ? ` · ${q.quoteDate}` : ""}
          </CardDescription>
        )}
        <CardAction>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {first && (
          <p className="font-mono text-xl font-medium tabular-nums sm:text-2xl">
            {first.qty} × {formatPKR(first.unitPrice)} = {formatPKR(lineAmount(first))}
          </p>
        )}
        {q.items.length > 1 && (
          <p className="text-xs text-muted-foreground">
            + {q.items.length - 1} more line{q.items.length > 2 ? "s" : ""} (all lines: {formatPKR(quotationListTotal(q))});
            the comparison uses the first line.
          </p>
        )}

        {terms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <Badge key={t} variant="outline" className="h-auto py-1 whitespace-normal text-muted-foreground">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <IssueList issues={issues} />
      </CardContent>
    </Card>
  );
}
