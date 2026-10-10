"use client";
// M2: upload a quotation → AI extraction → owner checks every field → confirmed offer.
// Arithmetic checks run live in code on every edit; the AI never computes a total.
import { formatIban, isValidIban, normalizeIban } from "@/lib/fraud";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
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
import { DemoMenu, Details, HelpTip } from "@/components/simple";
import { Spinner } from "@/components/ui/spinner";
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
type ExtractOk = {
  quotation: Quotation;
  issues: ArithmeticIssue[];
  source: "ai" | "demo";
};
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
        if (data.source === "ai")
          toast.success("Quotation read", {
            description: "Check every field before confirming.",
          });
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
    setPreview({
      url: isPdf ? null : URL.createObjectURL(upload),
      name: file.name,
      isPdf,
    });
    const form = new FormData();
    const name = isPdf ? file.name : file.name.replace(/\.\w+$/, "") + (upload.type === "image/jpeg" ? ".jpg" : "");
    form.append("file", upload, name || "quotation");
    await extract(form);
  }

  function confirm(q: Quotation) {
    const clean: Quotation = {
      ...q,
      supplierName: q.supplierName.trim(),
      items: q.items.map((item) => ({
        ...item,
        description: item.description.trim(),
      })),
    };
    update({ quotation: clean, quotationConfirmed: true });
    upsertOffer(quotationToOffer(clean));
    setView("auto");
    toast.success("Quotation confirmed", {
      description: "Next: the price check.",
    });
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
        <CardTitle>Supplier&apos;s quotation</CardTitle>
        <CardAction className="flex items-center gap-1">
          {props.onCancel && (
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              Cancel
            </Button>
          )}
          <DemoMenu
            actions={[
              {
                label: "Use demo quotation",
                onClick: props.onDemo,
                disabled: props.loading,
                icon: <Sparkles />,
              },
              {
                label: "Printable demo quotation",
                onClick: () => window.open("/demo/quotation", "_blank", "noopener"),
                icon: <ExternalLink />,
              },
            ]}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-[2px] border border-dashed px-4 py-10 text-center transition-colors",
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
          {props.preview && <PreviewThumb preview={props.preview} className={props.loading ? "opacity-50" : ""} />}

          {props.loading ? (
            <div className="flex items-center gap-2 text-sm font-medium" role="status">
              <Spinner className="text-primary" />
              Reading the quotation…
            </div>
          ) : (
            <>
              <Button size="lg" className="h-11 px-5 text-base" onClick={() => pickerRef.current?.click()}>
                <Upload data-icon="inline-start" />
                Upload quotation photo
              </Button>
              <p className="text-sm text-muted-foreground">Photo or PDF. We read it, you check it.</p>
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

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => cameraRef.current?.click()}
            disabled={props.loading}
          >
            <Camera data-icon="inline-start" />
            Take a photo
          </Button>
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground"
            onClick={props.onManual}
            disabled={props.loading}
          >
            <Pencil data-icon="inline-start" />
            Type it in
          </Button>
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
  ai: "Our AI read this. Check the numbers against the paper.",
  demo: "Demo quotation. Check the numbers, then confirm.",
  manual: "Type the details as printed.",
  edit: "Change anything, then confirm again.",
};

// Problems in fields kept under "More details" open it by themselves.
const isHiddenField = (field: string) => field === "printedTotal" || /^items\.\d+\.lineTotal$/.test(field);

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
  const hiddenIssue = issues.some((x) => isHiddenField(x.field));
  const [moreOpen, setMoreOpen] = useState(false);

  const missing: string[] = [];
  if (!draft.supplierName.trim()) missing.push("supplier name");
  if (!first || !first.description.trim()) missing.push("item");
  if (!first || !(first.qty > 0)) missing.push("quantity");
  if (!first || !(first.unitPrice > 0)) missing.push("price");

  function patch(p: Partial<Quotation>) {
    setDraft({ ...draft, ...p });
  }
  function patchItem(i: number, p: Partial<QuotationItem>) {
    setDraft({
      ...draft,
      items: draft.items.map((item, j) => (j === i ? { ...item, ...p } : item)),
    });
  }
  const issuesFor = (field: string) => issues.filter((x) => x.field === field);

  const showPreview = props.preview && props.source !== "manual" && props.source !== "demo";
  const ibanOk = draft.iban ? isValidIban(draft.iban) : null;

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
          </div>
          {props.source && <CardDescription>{SOURCE_HINT[props.source]}</CardDescription>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {props.canCancel && (
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={props.onRestart}>
            <Upload data-icon="inline-start" />
            Upload a different one
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

            <FormField label="Supplier name" id="q-supplier">
              <Input
                id="q-supplier"
                value={draft.supplierName}
                onChange={(e) => patch({ supplierName: e.target.value })}
              />
            </FormField>

            {/* Items */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label" className="ledger-label">
                What you are buying
              </FieldLegend>
              {draft.items.map((item, i) => (
                <div
                  key={i}
                  className={cn("flex flex-col gap-3", draft.items.length > 1 && "rounded-[2px] border p-3")}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <FormField label="Item" id={`q-desc-${i}`} className="col-span-2 sm:col-span-4">
                      <Input
                        id={`q-desc-${i}`}
                        value={item.description}
                        onChange={(e) => patchItem(i, { description: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Model" id={`q-model-${i}`} className="col-span-2 sm:col-span-2">
                      <Input
                        id={`q-model-${i}`}
                        value={item.model ?? ""}
                        onChange={(e) => patchItem(i, { model: e.target.value || null })}
                      />
                    </FormField>
                    <FormField
                      label="Quantity"
                      id={`q-qty-${i}`}
                      className="col-span-1 sm:col-span-2"
                      issues={issuesFor(`items.${i}.qty`)}
                    >
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
                      label="Price each"
                      id={`q-price-${i}`}
                      className="col-span-1 sm:col-span-2"
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
                    <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-sm font-medium">Total</span>
                      <span className="flex h-8 items-center font-mono text-base font-semibold tabular-nums">
                        {formatPKR(lineAmount(item))}
                      </span>
                    </div>
                  </div>
                  {draft.items.length > 1 && (
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto w-fit px-0 text-muted-foreground hover:text-destructive"
                      onClick={() => patch({ items: draft.items.filter((_, j) => j !== i) })}
                    >
                      Remove line
                    </Button>
                  )}
                </div>
              ))}
              <IssueList issues={issuesFor("items")} />
              <Button
                variant="link"
                size="xs"
                className="h-auto w-fit px-0 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  patch({
                    items: [
                      ...draft.items,
                      {
                        description: "",
                        model: null,
                        qty: 1,
                        unitPrice: 0,
                        lineTotal: null,
                      },
                    ],
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Add another item
              </Button>
            </FieldSet>

            {/* Payment plan */}
            <FieldSet className="gap-3">
              <FieldLegend variant="label" className="ledger-label">
                Payment plan
              </FieldLegend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <FormField
                  label="Cash discount"
                  id="q-discount"
                  className="col-span-2 sm:col-span-1"
                  issues={issuesFor("cashDiscountPct")}
                >
                  <DecimalInput
                    id="q-discount"
                    value={draft.cashDiscountPct}
                    onChange={(v) => patch({ cashDiscountPct: v })}
                    suffix="%"
                  />
                  {draft.cashDiscountPct ? (
                    <FieldDescription className="text-xs">
                      Cash price{" "}
                      <span className="font-mono text-foreground tabular-nums">
                        {formatPKR(quotationCashPrice(draft))}
                      </span>
                    </FieldDescription>
                  ) : null}
                </FormField>
                <FormField label="Installments" id="q-months">
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
                <Field className="col-span-2 gap-1.5 sm:col-span-3">
                  <FieldTitle className="flex items-center gap-1">
                    First installment due
                    <HelpTip>If it is due on delivery, paying later costs more.</HelpTip>
                  </FieldTitle>
                  <TriToggle
                    value={draft.firstInstallmentOnDelivery}
                    onChange={(v) => patch({ firstInstallmentOnDelivery: v })}
                  />
                </Field>
              </div>
            </FieldSet>

            <Details
              title="More details"
              testId="quotation-more"
              hint={
                hiddenIssue ? (
                  <span className="text-warning">Something to check</span>
                ) : draft.iban ? (
                  ibanOk ? (
                    "Bank account saved"
                  ) : (
                    <span className="text-destructive">Check the IBAN</span>
                  )
                ) : (
                  "Dates, totals, bank account"
                )
              }
              open={moreOpen || hiddenIssue}
              onOpenChange={setMoreOpen}
              className="-mb-2"
            >
              <div className="flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <FormField label="Valid for" id="q-validity">
                    <NumInput
                      id="q-validity"
                      kind="int"
                      value={draft.validityDays}
                      onChange={(v) => patch({ validityDays: v })}
                      suffix="days"
                    />
                  </FormField>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {draft.items.map((item, i) => (
                    <FormField
                      key={i}
                      label={draft.items.length > 1 ? `Line ${i + 1} total (as printed)` : "Line total (as printed)"}
                      id={`q-line-${i}`}
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
                  ))}
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
                      <span className="font-mono text-foreground tabular-nums">
                        {formatPKR(quotationListTotal(draft))}
                      </span>
                    </FieldDescription>
                  </FormField>
                  <FormField label='"Markup" claimed' id="q-markup">
                    <DecimalInput
                      id="q-markup"
                      value={draft.markupClaimedPct}
                      onChange={(v) => patch({ markupClaimedPct: v })}
                      suffix="%"
                    />
                    <FieldDescription className="text-xs">
                      As the supplier wrote it, e.g. &quot;0% markup&quot;
                    </FieldDescription>
                  </FormField>
                </div>

                <FieldSet className="gap-3">
                  <FieldLegend variant="label" className="ledger-label flex items-center gap-1">
                    Bank account for payment
                    <HelpTip>Saved so we can warn you if an email later asks you to pay a different account.</HelpTip>
                  </FieldLegend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label="Bank" id="q-bank">
                      <Input
                        id="q-bank"
                        value={draft.bankName ?? ""}
                        onChange={(e) => patch({ bankName: e.target.value || null })}
                      />
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
                        onChange={(e) =>
                          patch({
                            iban: e.target.value.trim() ? normalizeIban(e.target.value) : null,
                          })
                        }
                        placeholder="PK00 BANK 0000 0000 0000 0000"
                      />
                    </FormField>
                  </div>
                  {draft.iban && (
                    <p className={cn("text-xs", ibanOk ? "text-success" : "text-destructive")}>
                      {ibanOk ? "IBAN checksum OK." : "This IBAN looks wrong. Check it against the paper."}
                    </p>
                  )}
                </FieldSet>
              </div>
            </Details>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              {missing.length > 0 && (
                <span className="text-xs text-muted-foreground">Still needed: {missing.join(", ")}</span>
              )}
              <Button size="lg" disabled={missing.length > 0} onClick={() => props.onConfirm(draft)}>
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
        The sums add up
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <TriangleAlert />
      {issues.length === 1 ? "1 thing to check" : `${issues.length} things to check`}
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

  const terms: string[] = [];
  if (q.installmentMonths && q.installmentAmount)
    terms.push(`${q.installmentMonths} × ${formatPKR(q.installmentAmount)} a month`);
  if (q.cashDiscountPct) terms.push(`or ${formatPKR(quotationCashPrice(q))} cash (${q.cashDiscountPct}% off)`);
  if (q.markupClaimedPct !== null) terms.push(`"${q.markupClaimedPct}% markup"`);
  if (q.firstInstallmentOnDelivery) terms.push("first installment on delivery");
  if (q.validityDays) terms.push(`valid ${q.validityDays} days`);

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle className="truncate">{q.supplierName}</CardTitle>
          <Badge variant="success">
            <CircleCheck />
            Confirmed
          </Badge>
        </div>
        {first && (
          <CardDescription>
            {first.description}
            {first.model ? ` · ${first.model}` : ""}
          </CardDescription>
        )}
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {first && (
          <p className="font-mono text-xl font-medium tabular-nums sm:text-2xl">
            {first.qty} × {formatPKR(first.unitPrice)} = {formatPKR(lineAmount(first))}
          </p>
        )}
        {q.items.length > 1 && (
          <p className="text-xs text-muted-foreground">
            + {q.items.length - 1} more line{q.items.length > 2 ? "s" : ""} · all lines{" "}
            {formatPKR(quotationListTotal(q))}
          </p>
        )}
        {terms.length > 0 && <p className="text-sm text-muted-foreground">{terms.join(" · ")}</p>}
        <IssueList issues={issues} />
      </CardContent>
    </Card>
  );
}
