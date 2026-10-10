"use client";
// M4 + M5: find other suppliers, email them an RFQ, then watch the test inbox for replies.
// Replies (often Roman Urdu) are read by AI with a code fallback; each priced reply becomes an offer row.
// "Paste a reply" runs the same extraction on pasted text when the inbox is slow or not connected.
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_ITEM, DEMO_MODEL, DEMO_SUPPLIER_B_REPLY } from "@/lib/demoData";
import { formatPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { EmailRecord, Offer, Supplier } from "@/lib/types";

type ReplyItem = { email: EmailRecord; offer: Offer | null; needsOwnerInput?: string };
type RepliesResponse = { replies: ReplyItem[]; simulated?: boolean; error?: string };

const POLL_MS = 10_000;
const POLL_LIMIT_MS = 5 * 60_000;

export default function SupplierPanel() {
  const { state, update, upsertOffer, addEmail } = useStore();
  const stateRef = useRef<FaislaState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [inboxStatus, setInboxStatus] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState("");
  const [pasteSupplier, setPasteSupplier] = useState("");
  const [pasting, setPasting] = useState(false);

  const line = state.quotation?.items[0];
  const item = line?.description || DEMO_ITEM;
  const model = line?.model || DEMO_MODEL;
  const qty = line?.qty || 4;
  const referenceUnitPrice = line?.unitPrice ?? null;
  const suppliers = state.suppliers;

  const rfqFor = (s: Supplier) =>
    state.emails.find((e) => e.direction === "out" && e.subject.startsWith("RFQ") && e.subject.includes(s.name));
  const rfqs = state.emails.filter((e) => e.direction === "out" && e.subject.startsWith("RFQ"));
  const replies = state.emails.filter((e) => e.direction === "in");
  const firstRfqAt = rfqs.length ? rfqs.map((e) => e.sentAt).sort()[0] : null;

  async function findSuppliers() {
    setFinding(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, model, city: state.company.city, excludeSupplier: state.quotation?.supplierName }),
      });
      if (!res.ok) throw new Error(`Supplier search failed (${res.status})`);
      const data = (await res.json()) as { suppliers: Supplier[] };
      update({ suppliers: data.suppliers });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supplier search failed");
    } finally {
      setFinding(false);
    }
  }

  async function sendRfq(supplier: Supplier) {
    setSending((s) => ({ ...s, [supplier.name]: true }));
    setError(null);
    try {
      const res = await fetch("/api/rfq/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, item, model, qty, company: state.company }),
      });
      if (!res.ok) throw new Error(`RFQ to ${supplier.name} failed (${res.status})`);
      const data = (await res.json()) as { email: EmailRecord; error?: string };
      addEmail(data.email);
      if (data.error) setError(`Email not delivered (${data.error}); logged as simulated.`);
      setPolling(true);
      setPollStartedAt((t) => t ?? Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "RFQ failed");
    } finally {
      setSending((s) => ({ ...s, [supplier.name]: false }));
    }
  }

  async function sendAll() {
    for (const s of suppliers) if (!rfqFor(s)) await sendRfq(s);
  }

  // Store new replies; returns how many new offers were added.
  const absorb = useCallback(
    (items: ReplyItem[]): number => {
      const known = new Set(stateRef.current.offers.map((o) => o.id));
      let added = 0;
      for (const r of items) {
        addEmail(r.email);
        if (r.offer && !known.has(r.offer.id)) {
          upsertOffer(r.offer);
          known.add(r.offer.id);
          added++;
        }
        const note = r.needsOwnerInput;
        if (note) setNotes((n) => ({ ...n, [r.email.id]: note }));
      }
      return added;
    },
    [addEmail, upsertOffer],
  );

  const checkInbox = useCallback(
    async (opts: { earlier?: boolean } = {}): Promise<number> => {
      const start = opts.earlier || !firstRfqAt ? Date.now() - 24 * 3600_000 : Date.parse(firstRfqAt) - 2 * 60_000;
      const params = new URLSearchParams({
        since: new Date(start).toISOString(),
        qty: String(qty),
        model,
        item,
        suppliers: JSON.stringify(stateRef.current.suppliers),
      });
      if (referenceUnitPrice) params.set("referenceUnitPrice", String(referenceUnitPrice));
      setChecking(true);
      try {
        const res = await fetch(`/api/rfq/replies?${params}`);
        const data = (await res.json()) as RepliesResponse;
        setLastChecked(new Date().toLocaleTimeString());
        if (data.simulated) {
          setInboxStatus("Inbox not connected (no Gmail credentials). Use “Paste a reply” below.");
          setPolling(false);
          return 0;
        }
        setInboxStatus(data.error ?? null);
        return absorb(data.replies ?? []);
      } catch {
        setInboxStatus("Could not reach the inbox. Will retry.");
        return 0;
      } finally {
        setChecking(false);
      }
    },
    [absorb, firstRfqAt, item, model, qty, referenceUnitPrice],
  );

  // Poll every 10 s after an RFQ is sent; stop when a priced reply arrives or after 5 minutes.
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(async () => {
      if (pollStartedAt && Date.now() - pollStartedAt > POLL_LIMIT_MS) {
        setPolling(false);
        setInboxStatus("Stopped waiting after 5 minutes. Use “Check inbox now” or paste the reply.");
        return;
      }
      const added = await checkInbox();
      if (added > 0) setPolling(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, pollStartedAt, checkInbox]);

  async function readPasted() {
    if (!pasteText.trim()) return;
    setPasting(true);
    setError(null);
    const supplierName = pasteSupplier || suppliers[0]?.name || "";
    try {
      const res = await fetch("/api/rfq/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: pasteText,
          supplierName,
          from: suppliers.find((s) => s.name === supplierName)?.email ?? "",
          subject: `Re: RFQ for ${supplierName}`,
          qty,
          model,
          item,
          referenceUnitPrice,
          suppliers,
        }),
      });
      if (!res.ok) throw new Error(`Could not read the reply (${res.status})`);
      const data = (await res.json()) as RepliesResponse;
      absorb(data.replies ?? []);
      setPasteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the reply");
    } finally {
      setPasting(false);
    }
  }

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="card-title">Other suppliers</h2>
          <p className="card-sub">
            RFQ for {qty} × {model}. Emails go only to team test inboxes.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={suppliers.length ? "btn-ghost" : "btn-primary"} onClick={() => void findSuppliers()} disabled={finding}>
            {finding ? "Searching…" : suppliers.length ? "Search again" : "Find other suppliers"}
          </button>
          {suppliers.length > 0 && (
            <button className="btn-primary" onClick={() => void sendAll()} disabled={suppliers.every((s) => rfqFor(s)) || Object.values(sending).some(Boolean)}>
              Send RFQ to all
            </button>
          )}
        </div>
      </div>

      {error && <p className="badge-warn whitespace-normal rounded-md py-1">{error}</p>}

      {suppliers.length > 0 && (
        <ul className="space-y-3">
          {suppliers.map((s) => {
            const sent = rfqFor(s);
            return (
              <li key={s.name} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {s.name}
                      {s.city && <span className="ml-2 text-sm font-normal text-muted">{s.city}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {[s.email, s.phone].filter(Boolean).join(" · ")}
                      {s.link && (
                        <>
                          {" · "}
                          <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                            website
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {sent ? (
                    <span className={sent.simulated ? "badge-muted" : "badge-good"}>{sent.simulated ? "RFQ logged (simulated)" : "RFQ sent"}</span>
                  ) : (
                    <button className="btn" onClick={() => void sendRfq(s)} disabled={sending[s.name]}>
                      {sending[s.name] ? "Writing & sending…" : "Send RFQ"}
                    </button>
                  )}
                </div>
                {sent && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">
                      {sent.subject}
                      {sent.simulated && <span className="badge-muted ml-2">simulated</span>}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-paper p-3 font-sans text-sm">{sent.body}</pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rfqs.length > 0 && (
        <div className="space-y-2 rounded-lg bg-paper p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {polling ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> Waiting for replies (checking every 10 s)
                </span>
              ) : (
                "Replies"
              )}
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => void checkInbox()} disabled={checking}>
                {checking ? "Checking…" : "Check inbox now"}
              </button>
              <button className="btn-ghost text-xs" onClick={() => void checkInbox({ earlier: true })} disabled={checking}>
                Include last 24 h
              </button>
            </div>
          </div>
          {(inboxStatus || lastChecked) && (
            <p className="text-xs text-muted">
              {inboxStatus}
              {lastChecked && ` Last checked ${lastChecked}.`}
            </p>
          )}
        </div>
      )}

      {replies.length > 0 && (
        <ul className="space-y-3">
          {replies.map((e) => {
            const offer = e.offerId ? state.offers.find((o) => o.id === e.offerId) : null;
            return (
              <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{offer?.supplierName ?? e.toFrom}</p>
                  <span className="text-xs text-muted">
                    {e.subject} · {new Date(e.sentAt).toLocaleTimeString()}
                  </span>
                </div>
                <blockquote className="mt-2 whitespace-pre-wrap border-l-4 border-line pl-3 italic text-ink">{e.body}</blockquote>
                {offer ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="badge-good">New offer added</span>
                    <span className="num">
                      {formatPKR(offer.unitPrice)} per unit × {offer.qty} = {formatPKR(offer.total)}
                    </span>
                    {offer.deliveryDays != null && <span className="badge-muted">delivery {offer.deliveryDays} days</span>}
                    {offer.warrantyMonths != null && <span className="badge-muted">warranty {offer.warrantyMonths} months</span>}
                  </div>
                ) : (
                  <p className="badge-warn mt-2 whitespace-normal rounded-md py-1">
                    Price unclear, owner to confirm: {notes[e.id] ?? "no clear unit price in this reply."}
                  </p>
                )}
                {offer?.summary && <p className="mt-1 text-xs text-muted">AI read: {offer.summary}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {(suppliers.length > 0 || rfqs.length > 0) && (
        <details className="rounded-lg border border-dashed border-line p-3 text-sm" open={Boolean(inboxStatus && !polling)}>
          <summary className="cursor-pointer font-medium">Paste a reply</summary>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <select className="input w-auto" value={pasteSupplier} onChange={(e) => setPasteSupplier(e.target.value)}>
                {suppliers.length === 0 && <option value="">Supplier</option>}
                {suppliers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="btn-ghost text-xs" onClick={() => setPasteText(DEMO_SUPPLIER_B_REPLY)}>
                Use demo reply
              </button>
            </div>
            <textarea
              className="input min-h-20"
              placeholder="e.g. Bhai, 4 machines 13.4 lakh per unit final, delivery 10 din, 1 saal warranty"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button className="btn-primary" onClick={() => void readPasted()} disabled={pasting || !pasteText.trim()}>
              {pasting ? "Reading…" : "Read reply"}
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
