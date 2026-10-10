"use client";
// M4 + M5: find other suppliers, email them an RFQ, then watch the test inbox for replies.
// Replies (often Roman Urdu) are read by AI with a code fallback; each priced reply becomes an offer row.
// "Paste a reply" runs the same extraction on pasted text when the inbox is slow or not connected.
import { formatDateTime } from "@/lib/dateFormat";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ClipboardPaste,
  ExternalLink,
  Inbox,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_FRAUD_REPLY, DEMO_ITEM, DEMO_MODEL, DEMO_SUPPLIER_B_REPLY } from "@/lib/demoData";
import { RiskBadge, usePaymentRisks } from "@/components/PaymentRisk";
import { formatPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { EmailRecord, Offer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  // "Paste a reply" opens by itself when the inbox gives up or isn't connected; the owner can still toggle it.
  const autoOpenPaste = Boolean(inboxStatus && !polling);
  const [pasteOpen, setPasteOpen] = useState(autoOpenPaste);
  const [lastAutoOpen, setLastAutoOpen] = useState(autoOpenPaste);
  if (autoOpenPaste !== lastAutoOpen) {
    setLastAutoOpen(autoOpenPaste);
    if (autoOpenPaste) setPasteOpen(true);
  }

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
  const { risks } = usePaymentRisks();
  const riskFor = (emailId: string) => risks.find((r) => r.emailId === emailId);
  const firstRfqAt = rfqs.length ? rfqs.map((e) => e.sentAt).sort()[0] : null;
  const anySending = Object.values(sending).some(Boolean);

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
      toast.success(
        data.suppliers.length ? `Found ${data.suppliers.length} other suppliers` : "No other suppliers found",
      );
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
      if (data.error) {
        setError(`Email not delivered (${data.error}); logged as simulated.`);
        toast.warning(`RFQ to ${supplier.name} logged as simulated`);
      } else {
        toast.success(`RFQ sent to ${supplier.name}`, { description: "Watching the inbox for the reply." });
      }
      setPolling(true);
      setPollStartedAt((t) => t ?? Date.now());
    } catch (e) {
      const message = e instanceof Error ? e.message : "RFQ failed";
      setError(message);
      toast.error(message);
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
          toast.success(`New offer from ${r.offer.supplierName}`, {
            description: `${formatPKR(r.offer.unitPrice)} per unit × ${r.offer.qty} = ${formatPKR(r.offer.total)}`,
          });
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
        setLastChecked(formatDateTime(new Date().toISOString()));
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

  // Poll every 10 s after an RFQ is sent (first check almost at once, so an unconnected inbox shows
  // the paste fallback immediately); stop when a priced reply arrives or after 5 minutes.
  useEffect(() => {
    if (!polling) return;
    const tick = async () => {
      if (pollStartedAt && Date.now() - pollStartedAt > POLL_LIMIT_MS) {
        setPolling(false);
        setInboxStatus("Stopped waiting after 5 minutes. Use “Check inbox now” or paste the reply.");
        return;
      }
      const added = await checkInbox();
      if (added > 0) setPolling(false);
    };
    const first = setTimeout(() => void tick(), 1500);
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [polling, pollStartedAt, checkInbox]);

  // Runs a pasted (or demo) email through the same reading + fraud check as inbox replies.
  async function postReply(reply: { body: string; supplierName: string; from: string; subject: string }) {
    setPasting(true);
    setError(null);
    try {
      const res = await fetch("/api/rfq/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reply, qty, model, item, referenceUnitPrice, suppliers }),
      });
      if (!res.ok) throw new Error(`Could not read the reply (${res.status})`);
      const data = (await res.json()) as RepliesResponse;
      const added = absorb(data.replies ?? []);
      const flagged = (data.replies ?? []).some((r) => r.email.payment?.iban || r.email.payment?.urgency);
      if (flagged) toast.error("Payment-fraud check: this email asks for payment details to change", { description: "See the warning at the top." });
      else if (added === 0) toast.warning("Reply read, but no clear unit price", { description: "Check the reply below." });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not read the reply";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setPasting(false);
    }
  }

  async function readPasted() {
    if (!pasteText.trim()) return;
    const supplierName = pasteSupplier || suppliers[0]?.name || "";
    const ok = await postReply({
      body: pasteText,
      supplierName,
      from: suppliers.find((s) => s.name === supplierName)?.email ?? "",
      subject: `Re: RFQ for ${supplierName}`,
    });
    if (ok) setPasteText("");
  }

  // Demo: an email that looks like it is from the quoting supplier but asks to pay a new account.
  async function readDemoFraud() {
    await postReply({ ...DEMO_FRAUD_REPLY, supplierName: state.quotation?.supplierName ?? "" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>Other suppliers</CardTitle>
          <CardDescription>
            RFQ for{" "}
            <span className="font-mono text-foreground tabular-nums">
              {qty} × {model}
            </span>
            . Emails go only to team test inboxes.
          </CardDescription>
        </div>
        {suppliers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void findSuppliers()} disabled={finding}>
              {finding ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              {finding ? "Searching…" : "Search again"}
            </Button>
            <Button size="sm" onClick={() => void sendAll()} disabled={suppliers.every((s) => rfqFor(s)) || anySending}>
              <Send data-icon="inline-start" />
              Send RFQ to all
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {error && <WarningNote>{error}</WarningNote>}

        {suppliers.length === 0 &&
          (finding ? (
            <div className="flex flex-col gap-3" aria-label="Searching for suppliers">
              {[0, 1, 2].map((k) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <Empty className="border py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>Get competing quotes</EmptyTitle>
                <EmptyDescription>
                  Faisla finds 2–3 other suppliers for the same machine and emails each a request for quotation.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => void findSuppliers()}>
                  <Search data-icon="inline-start" />
                  Find other suppliers
                </Button>
              </EmptyContent>
            </Empty>
          ))}

        {suppliers.length > 0 && (
          <ul className="flex flex-col gap-3">
            {suppliers.map((s) => {
              const sent = rfqFor(s);
              return (
                <li key={s.name} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.name}
                        {s.city && <span className="ml-2 text-sm font-normal text-muted-foreground">{s.city}</span>}
                      </p>
                      <p className="text-xs break-all text-muted-foreground">
                        {[s.email, s.phone].filter(Boolean).join(" · ")}
                        {s.link && (
                          <>
                            {" · "}
                            <a
                              href={s.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                            >
                              website
                              <ExternalLink className="size-3" />
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    {sent ? (
                      sent.simulated ? (
                        <Badge variant="secondary">RFQ logged (simulated)</Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success">
                          <MailCheck />
                          RFQ sent
                        </Badge>
                      )
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void sendRfq(s)} disabled={sending[s.name]}>
                        {sending[s.name] ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                        {sending[s.name] ? "Writing & sending…" : "Send RFQ"}
                      </Button>
                    )}
                  </div>
                  {sent && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger className="group/rfq flex w-full items-center gap-1.5 rounded-md text-left text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                        <ChevronDown className="size-4 shrink-0 -rotate-90 transition-transform group-data-panel-open/rfq:rotate-0" />
                        <span className="min-w-0 truncate">{sent.subject}</span>
                        {sent.simulated && (
                          <Badge variant="outline" className="ml-1 text-muted-foreground">
                            simulated
                          </Badge>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-2 rounded-md border bg-muted/40 p-3 font-sans text-sm whitespace-pre-wrap">
                          {sent.body}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {rfqs.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {polling ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    Waiting for replies (checking every 10 s)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Inbox className="size-4 text-muted-foreground" />
                    Replies
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void checkInbox()} disabled={checking}>
                  {checking ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                  {checking ? "Checking…" : "Check inbox now"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void checkInbox({ earlier: true })} disabled={checking}>
                  Include last 24 h
                </Button>
              </div>
            </div>
            {(inboxStatus || lastChecked) && (
              <p className="text-xs text-muted-foreground">
                {inboxStatus}
                {lastChecked && ` Last checked ${lastChecked}.`}
              </p>
            )}
          </div>
        )}

        {replies.length > 0 && (
          <ul className="flex flex-col gap-3">
            {replies.map((e) => {
              const offer = e.offerId ? state.offers.find((o) => o.id === e.offerId) : null;
              const risk = riskFor(e.id);
              return (
                <li
                  key={e.id}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    risk && !risk.confirmed && risk.level === "high" && "border-destructive/50",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      {offer?.supplierName ?? risk?.supplierName ?? e.toFrom}
                      {risk && <RiskBadge risk={risk} />}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {e.subject} · {formatDateTime(e.sentAt)}
                    </span>
                  </div>
                  <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 whitespace-pre-wrap italic">{e.body}</blockquote>
                  {offer ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="bg-success/10 text-success">New offer added</Badge>
                      <span className="font-mono tabular-nums">
                        {formatPKR(offer.unitPrice)} per unit × {offer.qty} = {formatPKR(offer.total)}
                      </span>
                      {offer.deliveryDays != null && (
                        <Badge variant="outline" className="text-muted-foreground">
                          delivery {offer.deliveryDays} days
                        </Badge>
                      )}
                      {offer.warrantyMonths != null && (
                        <Badge variant="outline" className="text-muted-foreground">
                          warranty {offer.warrantyMonths} months
                        </Badge>
                      )}
                    </div>
                  ) : risk ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      From {e.toFrom}. No price in this email; it asks about payment. See the payment-fraud warning at the top.
                    </p>
                  ) : (
                    <WarningNote className="mt-3">
                      Price unclear, owner to confirm: {notes[e.id] ?? "no clear unit price in this reply."}
                    </WarningNote>
                  )}
                  {offer?.summary && (
                    <p className="mt-2 inline-flex items-start gap-1 text-xs text-muted-foreground">
                      <Sparkles className="mt-px size-3 shrink-0" />
                      AI read: {offer.summary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {(suppliers.length > 0 || rfqs.length > 0) && (
          <Collapsible open={pasteOpen} onOpenChange={setPasteOpen} className="rounded-lg border border-dashed p-3 text-sm">
            <CollapsibleTrigger className="group/paste flex w-full items-center gap-2 rounded-md text-left font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <ClipboardPaste className="size-4 text-muted-foreground" />
              Paste a reply
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-data-panel-open/paste:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={pasteSupplier || suppliers[0]?.name || null}
                    onValueChange={(v) => setPasteSupplier(typeof v === "string" ? v : "")}
                  >
                    <SelectTrigger className="min-w-48" aria-label="Supplier who replied">
                      <SelectValue placeholder="Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setPasteText(DEMO_SUPPLIER_B_REPLY)}>
                    <Sparkles data-icon="inline-start" />
                    Use demo reply
                  </Button>
                  {state.quotation?.iban && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive"
                      onClick={() => void readDemoFraud()}
                      disabled={pasting}
                    >
                      <ShieldAlert data-icon="inline-start" />
                      Demo fraud email
                    </Button>
                  )}
                </div>
                <Textarea
                  aria-label="Supplier reply"
                  className="min-h-20"
                  placeholder="e.g. Bhai, 4 machines 13.4 lakh per unit final, delivery 10 din, 1 saal warranty"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button className="w-fit" onClick={() => void readPasted()} disabled={pasting || !pasteText.trim()}>
                  {pasting && <Spinner data-icon="inline-start" />}
                  {pasting ? "Reading…" : "Read reply"}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function WarningNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 leading-snug">{children}</span>
    </div>
  );
}
