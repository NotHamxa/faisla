"use client";
// Step 6: decision memo (AI prose, code numbers, checked) + term-sheet request to the bank.
import { Fragment, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { EmailRecord, MemoResult } from "@/lib/types";

type BankEmailResponse = {
  email: EmailRecord;
  attachment: { filename: string; content: string } | null;
  error?: string;
};

// Prints only the memo (Download PDF = browser "Save as PDF").
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  body * { visibility: hidden !important; }
  .faisla-print-memo, .faisla-print-memo * { visibility: visible !important; }
  .faisla-print-memo { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}`;

export default function MemoPanel() {
  const { state, update, addEmail } = useStore();
  const { decision, memo } = state;
  const [memoLoading, setMemoLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bankReply, setBankReply] = useState<BankEmailResponse | null>(null);

  // Survives a refresh via the stored email log (attachment preview only for this session).
  const bankEmail =
    bankReply?.email ?? [...state.emails].reverse().find((e) => e.direction === "out" && e.subject.startsWith("Term sheet request"));

  if (!decision) {
    return (
      <section className="card">
        <h2 className="card-title">Decision memo</h2>
        <p className="card-sub mt-1">Compare the ways to pay first. The memo is written from that calculation.</p>
      </section>
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

  async function requestTermSheet() {
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
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Email failed (${res.status})`);
      const data = (await res.json()) as BankEmailResponse;
      setBankReply(data);
      addEmail(data.email);
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  return (
    <section className="space-y-4">
      <style>{PRINT_CSS}</style>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title">Decision memo</h2>
            <p className="card-sub mt-1">AI writes the words; every number comes from the calculation and is checked by code.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={writeMemo} disabled={memoLoading}>
              {memoLoading ? "Writing memo…" : memo ? "Rewrite memo" : "Write decision memo"}
            </button>
            <button className="btn" onClick={requestTermSheet} disabled={emailLoading}>
              {emailLoading ? "Sending…" : "Request term sheet"}
            </button>
            <button className="btn" onClick={() => window.print()} disabled={!memo || memoLoading}>
              Download PDF
            </button>
            <button className="btn-ghost" onClick={copyMemo} disabled={!memo || memoLoading}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        {memo && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <NumberCheckBadge memo={memo} />
            <span className="badge-muted">{memo.source === "llm" ? "Written by AI (Claude)" : "Template"}</span>
            {memo.source === "llm" && memo.numberCheck.attempts > 1 && (
              <span className="badge-muted">passed on draft {memo.numberCheck.attempts}</span>
            )}
          </div>
        )}
      </div>

      {memo && (
        <article className={`card faisla-print-memo ${memoLoading ? "opacity-50" : ""}`}>
          <Markdown text={memo.memo} />
        </article>
      )}

      {bankEmail && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="card-title">Term-sheet request</h3>
            {bankEmail.simulated ? (
              <span className="badge-warn">Simulated (no email keys set)</span>
            ) : (
              <span className="badge-good">Sent</span>
            )}
          </div>
          <p className="card-sub mt-1">
            To <span className="font-medium text-ink">{bankEmail.toFrom}</span> ·{" "}
            {new Date(bankEmail.sentAt).toLocaleString()}
          </p>
          <p className="mt-3 text-sm font-medium">{bankEmail.subject}</p>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-3 font-sans text-sm">
            {bankEmail.body}
          </pre>
          {bankReply?.attachment && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">Attachment: {bankReply.attachment.filename}</summary>
              <pre className="num mt-2 max-h-80 overflow-auto rounded-lg bg-paper p-3 text-xs">{bankReply.attachment.content}</pre>
            </details>
          )}
          {bankReply?.error && <p className="mt-2 text-xs text-warn">Email not delivered: {bankReply.error}</p>}
        </div>
      )}
    </section>
  );
}

function NumberCheckBadge({ memo }: { memo: MemoResult }) {
  const { passed, unknownNumbers } = memo.numberCheck;
  if (!passed) return <span className="badge-bad">Unchecked numbers: {unknownNumbers.join(", ")}</span>;
  if (memo.source === "template") {
    return (
      <>
        <span className="badge-warn">Template memo used</span>
        <span className="badge-good">✓ Numbers filled from the calculation</span>
      </>
    );
  }
  return <span className="badge-good">✓ Every number checked against the calculation</span>;
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

  for (let i = 0; i < lines.length; ) {
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
      blocks.push({ kind: "table", header: rows[0] ?? [], rows: rows.slice(1) });
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
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s|^\s*\||^\s*[-*+]\s+|^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^([*_]).+\1$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "h") {
          if (b.level === 1) return <h2 key={i} className="text-xl font-semibold tracking-tight">{inline(b.text)}</h2>;
          if (b.level === 2) return <h3 key={i} className="pt-2 text-base font-semibold text-brand">{inline(b.text)}</h3>;
          return <h4 key={i} className="font-semibold">{inline(b.text)}</h4>;
        }
        if (b.kind === "p") return <p key={i}>{inline(b.text)}</p>;
        if (b.kind === "list") {
          const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>);
          return b.ordered ? (
            <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>
          );
        }
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  {b.header.map((h, j) => <th key={j} className="px-2 py-1.5 font-medium">{inline(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-b border-line/60">
                    {r.map((c, k) => <td key={k} className={`px-2 py-1.5 ${/^(\*\*)?(Rs|\d)/.test(c) ? "num" : ""}`}>{inline(c)}</td>)}
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
