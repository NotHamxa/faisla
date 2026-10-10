"use client";
// Step 6: decision memo (AI prose, code numbers, checked) + term-sheet request to the bank.
import { usePaymentRisks } from "@/components/PaymentRisk";
import { Fragment, useState, type ReactNode } from "react";
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  PaperclipIcon,
  PrinterIcon,
  ShieldAlertIcon,
  PenLineIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/dateFormat";
import { effectiveRow, isFinancedMethod, isShariahRow, overrideRow } from "@/lib/finance";
import { useStore } from "@/lib/store";
import type { EmailRecord, MemoResult } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { Details, HelpTip } from "@/components/simple";

type BankEmailResponse = {
  email: EmailRecord;
  attachment: { filename: string; content: string } | null;
  error?: string;
};

// Prints only the memo (Download PDF = browser "Save as PDF"). Everything that neither contains the memo nor
// sits inside it is removed, the memo's ancestors (sidebar shell, tabs, cards) are flattened so it starts at
// the top of page 1 and flows across pages, and it is forced to black on white whatever the theme.
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body *:not(:has(.faisla-print-memo)):not(.faisla-print-memo):not(.faisla-print-memo *) { display: none !important; }
  body *:has(.faisla-print-memo) {
    display: block !important; position: static !important; margin: 0 !important; padding: 0 !important;
    border: 0 !important; box-shadow: none !important; background: transparent !important;
    width: auto !important; max-width: none !important; height: auto !important; min-height: 0 !important;
    max-height: none !important; overflow: visible !important; transform: none !important;
  }
  .faisla-print-memo {
    display: block !important; position: static !important; width: 100% !important; max-width: none !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; opacity: 1 !important;
  }
  .faisla-print-memo, .faisla-print-memo * { color: #000 !important; background: transparent !important; border-color: #ccc !important; }
}`;

export default function MemoPanel() {
  const { state, update, addEmail } = useStore();
  const { risks, blocking } = usePaymentRisks();
  const { decision, memo } = state;
  const [memoLoading, setMemoLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bankReply, setBankReply] = useState<BankEmailResponse | null>(null);

  // Survives a refresh via the stored email log (attachment preview only for this session).
  const bankEmail =
    bankReply?.email ??
    [...state.emails].reverse().find((e) => e.direction === "out" && e.subject.startsWith("Term sheet request"));

  if (!decision) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision memo</CardTitle>
          <CardDescription>Compare the ways to pay first.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function writeMemo() {
    setMemoLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reputations: state.reputations,
          offers: state.offers,
          financing: state.financing,
          chosenRowId: state.chosenRowId,
          paymentRisks: risks.map((r) => ({
            supplierName: r.supplierName,
            level: r.level,
            confirmed: r.confirmed,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Memo failed (${res.status})`);
      update({ memo: (await res.json()) as MemoResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Memo failed");
    } finally {
      setMemoLoading(false);
    }
  }

  // The term sheet is for bank financing, for the row the owner goes ahead with (their own pick, else the
  // recommendation). When that needs none (cash, or the supplier's own plan), the button says so, and the owner can
  // still ask about the best Shariah-compliant financing row on purpose.
  const recRow = effectiveRow(decision, state.chosenRowId);
  const ownChoice = !!overrideRow(decision, state.chosenRowId);
  const needsFinancing = !!recRow && isFinancedMethod(recRow.method);
  const altFinancing = needsFinancing
    ? null
    : (decision.rows.find((r) => isFinancedMethod(r.method) && isShariahRow(r)) ?? null);

  async function requestTermSheet(rowId?: string) {
    setEmailLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bank-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          company: state.company,
          offers: state.offers,
          financing: state.financing,
          rowId: rowId ?? recRow?.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Email failed (${res.status})`);
      const data = (await res.json()) as BankEmailResponse;
      setBankReply(data);
      addEmail(data.email);
      if (data.email.simulated) toast.info("Bank request saved (simulated, no email keys set)");
      else toast.success(`Request sent to ${data.email.toFrom}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Email failed");
    } finally {
      setEmailLoading(false);
    }
  }

  async function copyMemo() {
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(memo.memo);
      setCopied(true);
      toast.success("Memo copied as markdown");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  const blockedBy = blocking.map((r) => r.supplierName).join(", ");
  const termSheetTitle = blocking.length
    ? "Blocked: confirm the flagged bank account by phone first (see the warning at the top)"
    : !needsFinancing
      ? `Not needed: ${ownChoice ? "your choice" : "the recommended option"} uses no bank financing`
      : recRow
        ? `Asks the bank about ${recRow.label}`
        : undefined;

  return (
    <section className="space-y-4">
      <style>{PRINT_CSS}</style>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Decision memo</CardTitle>
          {memo && (
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={writeMemo}
                disabled={memoLoading}
              >
                {memoLoading ? <Spinner data-icon="inline-start" /> : <PenLineIcon data-icon="inline-start" />}
                {memoLoading ? "Writing…" : "Rewrite"}
              </Button>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {!memo && (
            <div className="flex flex-col items-start gap-2 rounded-[2px] border border-dashed border-foreground/30 p-5">
              <Button size="lg" className="h-11 px-5 text-base" onClick={writeMemo} disabled={memoLoading}>
                {memoLoading ? <Spinner data-icon="inline-start" /> : <PenLineIcon data-icon="inline-start" />}
                {memoLoading ? "Writing memo…" : "Write decision memo"}
              </Button>
              <p className="text-sm text-muted-foreground">A one-page recommendation to print or send to the bank.</p>
            </div>
          )}

          {memo && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => requestTermSheet()}
                  disabled={emailLoading || blocking.length > 0 || !needsFinancing}
                  data-testid="term-sheet-button"
                  title={termSheetTitle}
                >
                  {emailLoading ? <Spinner data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}
                  {emailLoading
                    ? "Sending…"
                    : !needsFinancing && recRow
                      ? `No bank needed for ${recRow.label}`
                      : "Ask the bank for an offer"}
                </Button>
                <Button variant="outline" onClick={() => window.print()} disabled={memoLoading}>
                  <PrinterIcon data-icon="inline-start" />
                  Download PDF
                </Button>
                <Button variant="ghost" onClick={copyMemo} disabled={memoLoading}>
                  {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <NumberCheck memo={memo} />
            </>
          )}

          {!needsFinancing && recRow && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
              data-testid="no-financing-note"
            >
              <span>
                {memo
                  ? `${ownChoice ? "Your choice" : "The recommended option"} uses no bank financing.`
                  : `No bank needed: ${recRow.label} uses no financing.`}
              </span>
              {altFinancing && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 whitespace-normal text-left"
                  onClick={() => requestTermSheet(altFinancing.id)}
                  disabled={emailLoading || blocking.length > 0}
                >
                  <MailIcon data-icon="inline-start" />
                  Ask the bank about {altFinancing.label} anyway
                </Button>
              )}
            </div>
          )}

          {blocking.length > 0 && (
            <p className="flex items-start gap-2 text-sm font-medium text-destructive" data-testid="term-sheet-blocked">
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
              Bank request blocked: confirm {blockedBy}&apos;s account by phone first.
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <ShieldAlertIcon />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {memo && (
        <article
          className={cn(
            "faisla-print-memo mx-auto w-full max-w-4xl rounded-[2px] border border-foreground/25 bg-card px-6 py-8 text-card-foreground transition-opacity sm:px-14 sm:py-12",
            memoLoading && "opacity-50",
          )}
        >
          <Markdown text={memo.memo} />
        </article>
      )}

      {bankEmail && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" />
                Request sent to the bank
              </CardTitle>
              {bankEmail.simulated ? <Badge variant="warning">Simulated</Badge> : <Badge variant="success">Sent</Badge>}
            </div>
            <CardDescription>
              To <span className="font-medium text-foreground">{bankEmail.toFrom}</span> ·{" "}
              {formatDateTime(bankEmail.sentAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{bankEmail.subject}</p>
            <Details title="See email" className="border-t-0">
              <pre className="max-h-80 overflow-auto rounded-[2px] border bg-muted/50 p-3 font-sans text-sm whitespace-pre-wrap">
                {bankEmail.body}
              </pre>
              {bankReply?.attachment && (
                <Collapsible className="mt-2">
                  <CollapsibleTrigger
                    render={<Button variant="ghost" size="sm" className="px-1.5 text-muted-foreground" />}
                  >
                    <PaperclipIcon data-icon="inline-start" />
                    Attachment: {bankReply.attachment.filename}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-[2px] border bg-muted/50 p-3 font-mono text-xs tabular-nums">
                      {bankReply.attachment.content}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </Details>
            {bankReply?.error && <p className="text-xs text-warning">Email not delivered: {bankReply.error}</p>}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

// One small line: did every number in the memo match the calculation?
function NumberCheck({ memo }: { memo: MemoResult }) {
  const { passed, unknownNumbers, attempts } = memo.numberCheck;
  const source =
    memo.source === "llm" ? `Written by AI${attempts > 1 ? ` (draft ${attempts})` : ""}` : "Template memo used";
  if (!passed) {
    return (
      <p className="flex items-start gap-2 text-sm text-destructive">
        <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">Unchecked numbers: {unknownNumbers.join(", ")}.</span> Do not rely on them. ·{" "}
          {source}
        </span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <ShieldCheckIcon className="size-4 shrink-0 text-success" />
      <span className="text-success">
        {memo.source === "template"
          ? "Numbers filled from the calculation"
          : "Every number checked against the calculation"}
      </span>
      <span className="text-muted-foreground">· {source}</span>
      {memo.source === "template" && (
        <HelpTip>The AI draft was unavailable or failed the number check, so a template was used.</HelpTip>
      )}
    </p>
  );
}

// ---------- tiny markdown renderer: headings, bullets, numbered lists, tables, bold/italic/code ----------

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tableLines.push(lines[i++]);
      const rows = tableLines.filter((l) => !/^\s*\|?\s*:?-{3,}/.test(l)).map(cells);
      blocks.push({
        kind: "table",
        header: rows[0] ?? [],
        rows: rows.slice(1),
      });
      continue;
    }
    const listKind = /^\s*[-*+]\s+/.test(line) ? "ul" : /^\s*\d+[.)]\s+/.test(line) ? "ol" : null;
    if (listKind) {
      const pattern = listKind === "ul" ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ""));
      blocks.push({ kind: "list", ordered: listKind === "ol", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s|^\s*\||^\s*[-*+]\s+|^\s*\d+[.)]\s+/.test(lines[i])) {
      para.push(lines[i++].trim());
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded-[2px] bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^([*_]).+\1$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3.5 font-serif text-[0.9375rem] leading-[1.7] text-foreground">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "h") {
          if (b.level === 1) {
            return (
              <h2 key={i} className="rule-double pb-3 font-sans text-[1.75rem] leading-tight font-bold">
                {inline(b.text)}
              </h2>
            );
          }
          if (b.level === 2) {
            return (
              <h3
                key={i}
                className="border-b pt-4 pb-1 font-sans text-[0.8125rem] font-bold tracking-[0.04em] text-primary"
              >
                {inline(b.text)}
              </h3>
            );
          }
          return (
            <h4 key={i} className="pt-1 font-sans font-semibold">
              {inline(b.text)}
            </h4>
          );
        }
        if (b.kind === "p") return <p key={i}>{inline(b.text)}</p>;
        if (b.kind === "list") {
          const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>);
          return b.ordered ? (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
              {items}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {items}
            </ul>
          );
        }
        return (
          <div key={i} className="overflow-x-auto border-y border-foreground/70 font-sans">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-foreground/30 text-muted-foreground">
                  {b.header.map((h, j) => (
                    <th key={j} className="px-2.5 py-2 font-semibold">
                      {inline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-b last:border-0">
                    {r.map((c, k) => (
                      <td
                        key={k}
                        className={cn(
                          "px-2.5 py-2",
                          /^(\*\*)?(Rs|\d)/.test(c) && "font-mono whitespace-nowrap tabular-nums",
                        )}
                      >
                        {inline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
