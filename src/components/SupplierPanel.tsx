"use client";
// M4 + M5: find other suppliers and email them a price request in one action, then watch the test inbox.
// Replies (often Roman Urdu) are read by AI with a code fallback; each priced reply becomes an offer row.
// "Paste a reply" runs the same extraction on pasted text; "Add an offer from a link" reads one web listing.
import { formatDateTime } from "@/lib/dateFormat";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardPaste,
  ExternalLink,
  Link2,
  MailCheck,
  Send,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DemoMenu, Details } from "@/components/simple";
import { DEMO_FRAUD_REPLY, DEMO_ITEM, DEMO_MODEL, DEMO_SUPPLIER_B_REPLY } from "@/lib/demoData";
import { RiskBadge, usePaymentRisks } from "@/components/PaymentRisk";
import { formatPKR } from "@/lib/format";
import { type FaislaState, useStore } from "@/lib/store";
import type { EmailRecord, Offer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReplyItem = {
  email: EmailRecord;
  offer: Offer | null;
  needsOwnerInput?: string;
};
type RepliesResponse = {
  replies: ReplyItem[];
  simulated?: boolean;
  error?: string;
};
type LinkResponse = {
  option?: unknown;
  offer?: Offer | null;
  note?: string | null;
  error?: string;
};

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
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);

  // "Paste a reply" opens by itself when the inbox gives up or isn't connected; the owner can still toggle it.
  const autoOpenPaste = Boolean(inboxStatus && !polling);
  const [pasteOpen, setPasteOpen] = useState(autoOpenPaste);
  const [lastAutoOpen, setLastAutoOpen] = useState(autoOpenPaste);
  if (autoOpenPaste !== lastAutoOpen) {
    setLastAutoOpen(autoOpenPaste);
    if (autoOpenPaste) setPasteOpen(true);
  }

  const line = state.quotation?.items[0];
  const firstOffer = state.offers[0];
  const item = line?.description || firstOffer?.item || DEMO_ITEM;
  const model = line?.model || firstOffer?.model || (line || firstOffer ? "" : DEMO_MODEL);
  const qty = line?.qty || firstOffer?.qty || 1;
  const referenceUnitPrice = line?.unitPrice ?? null;
  const suppliers = state.suppliers;

  const rfqFor = (s: Supplier) =>
    state.emails.find((e) => e.direction === "out" && e.subject.startsWith("RFQ") && e.subject.includes(s.name));
  const rfqs = state.emails.filter((e) => e.direction === "out" && e.subject.startsWith("RFQ"));
  const replies = state.emails.filter((e) => e.direction === "in");
  const linkOffers = state.offers.filter((o) => o.source === "web");
  const { risks } = usePaymentRisks();
  const riskFor = (emailId: string) => risks.find((r) => r.emailId === emailId);
  const firstRfqAt = rfqs.length ? rfqs.map((e) => e.sentAt).sort()[0] : null;
  const anySending = Object.values(sending).some(Boolean);
  const unsent = suppliers.filter((s) => !rfqFor(s));
  const busy = finding || anySending;

  async function findSuppliers(): Promise<Supplier[] | null> {
    setFinding(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // live: the server searches the web for dealers only when this is not the (cached) demo machine.
        body: JSON.stringify({
          item,
          model,
          city: state.company.city,
          excludeSupplier: state.quotation?.supplierName,
          live: true,
        }),
      });
      if (!res.ok) throw new Error(`Supplier search failed (${res.status})`);
      const data = (await res.json()) as { suppliers: Supplier[] };
      update({ suppliers: data.suppliers });
      if (!data.suppliers.length) toast.warning("No suppliers found on the web. Paste a reply or add a link instead.");
      return data.suppliers;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supplier search failed");
      return null;
    } finally {
      setFinding(false);
    }
  }

  async function sendRfq(supplier: Supplier, quiet = false) {
    setSending((s) => ({ ...s, [supplier.name]: true }));
    setError(null);
    try {
      const res = await fetch("/api/rfq/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          item,
          model,
          qty,
          company: state.company,
        }),
      });
      if (!res.ok) throw new Error(`Price request to ${supplier.name} failed (${res.status})`);
      const data = (await res.json()) as { email: EmailRecord; error?: string };
      addEmail(data.email);
      if (data.error) {
        setError(`Email not delivered (${data.error}); logged as simulated.`);
        if (!quiet) toast.warning(`Price request to ${supplier.name} logged as simulated`);
      } else if (!quiet) {
        toast.success(`Price request sent to ${supplier.name}`);
      }
      setPolling(true);
      setPollStartedAt((t) => t ?? Date.now());
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Price request failed";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSending((s) => ({ ...s, [supplier.name]: false }));
    }
  }

  // One action: find suppliers (if not found yet), then email each one a price request.
  async function askSuppliers() {
    const list = suppliers.length ? unsent : ((await findSuppliers()) ?? []);
    let sent = 0;
    for (const s of list) if (await sendRfq(s, true)) sent++;
    if (sent)
      toast.success(`Price request sent to ${sent} supplier${sent === 1 ? "" : "s"}`, {
        description: "Watching the inbox for replies.",
      });
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
            description: `${formatPKR(r.offer.unitPrice)} each × ${r.offer.qty} = ${formatPKR(r.offer.total)}`,
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
          setInboxStatus("Inbox not connected. Paste the reply below.");
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

  // Poll every 10 s after a request is sent (first check almost at once, so an unconnected inbox shows
  // the paste fallback immediately); stop when a priced reply arrives or after 5 minutes.
  useEffect(() => {
    if (!polling) return;
    const tick = async () => {
      if (pollStartedAt && Date.now() - pollStartedAt > POLL_LIMIT_MS) {
        setPolling(false);
        setInboxStatus("Stopped waiting after 5 minutes. Check again or paste the reply.");
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
        body: JSON.stringify({
          ...reply,
          qty,
          model,
          item,
          referenceUnitPrice,
          suppliers,
        }),
      });
      if (!res.ok) throw new Error(`Could not read the reply (${res.status})`);
      const data = (await res.json()) as RepliesResponse;
      const added = absorb(data.replies ?? []);
      const flagged = (data.replies ?? []).some((r) => r.email.payment?.iban || r.email.payment?.urgency);
      if (flagged)
        toast.error("This email asks you to pay a different account", {
          description: "See the warning at the top.",
        });
      else if (added === 0)
        toast.warning("Reply read, but no clear price", {
          description: "Check the reply below.",
        });
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
    await postReply({
      ...DEMO_FRAUD_REPLY,
      supplierName: state.quotation?.supplierName ?? "",
    });
  }

  // Reads one web listing the owner pasted. The route answers { option, offer, note }; a missing offer shows the note.
  async function addFromLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setLinkLoading(true);
    setLinkNote(null);
    try {
      const res = await fetch("/api/listing/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, qty }),
      });
      const data = (await res.json().catch(() => null)) as LinkResponse | null;
      if (data?.offer) {
        upsertOffer(data.offer);
        setLinkUrl("");
        toast.success(`Offer added: ${formatPKR(data.offer.unitPrice)} each`, {
          description: data.offer.supplierName,
        });
        if (data.note) setLinkNote(data.note);
      } else {
        setLinkNote(data?.note ?? data?.error ?? `Couldn't read a price from that link (${res.status}).`);
      }
    } catch {
      setLinkNote("Couldn't open that link. Check it and try again.");
    } finally {
      setLinkLoading(false);
    }
  }

  const pasteAvailable = suppliers.length > 0 || rfqs.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Other suppliers</CardTitle>
        <CardDescription>
          For{" "}
          <span className="font-mono text-foreground tabular-nums">
            {qty} × {model || item}
          </span>
        </CardDescription>
        <CardAction>
          <DemoMenu
            actions={[
              ...(pasteAvailable
                ? [
                    {
                      label: "Use demo reply",
                      icon: <Sparkles />,
                      onClick: () => {
                        setPasteText(DEMO_SUPPLIER_B_REPLY);
                        setPasteOpen(true);
                      },
                    },
                  ]
                : []),
              ...(state.quotation?.iban && pasteAvailable
                ? [
                    {
                      label: "Demo fraud email",
                      icon: <ShieldAlert />,
                      danger: true,
                      disabled: pasting,
                      onClick: () => void readDemoFraud(),
                    },
                  ]
                : []),
            ]}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {error && <WarningNote>{error}</WarningNote>}

        {/* The one primary action: find + ask in one go (or ask the ones not asked yet). */}
        {(suppliers.length === 0 || unsent.length > 0) && (
          <div className="flex flex-col items-start gap-2 rounded-[2px] border border-dashed border-foreground/30 p-5">
            <Button size="lg" className="h-11 px-5 text-base" onClick={() => void askSuppliers()} disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              {finding ? "Finding suppliers…" : anySending ? "Sending…" : "Ask suppliers for prices"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {suppliers.length === 0
                ? "We find 2–3 suppliers and email each a price request."
                : `${unsent.length} supplier${unsent.length === 1 ? "" : "s"} not asked yet.`}
            </p>
          </div>
        )}

        {suppliers.length === 0 && finding && (
          <div className="flex flex-col gap-2" aria-label="Searching for suppliers">
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} className="h-10" />
            ))}
          </div>
        )}

        {suppliers.length > 0 && (
          <div className="flex flex-col gap-2">
            <ul className="divide-y rounded-[2px] border">
              {suppliers.map((s) => {
                const sent = rfqFor(s);
                return (
                  <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <p className="min-w-0 font-medium">
                      {s.name}
                      {s.city && <span className="ml-2 text-sm font-normal text-muted-foreground">{s.city}</span>}
                    </p>
                    {sent ? (
                      <Badge variant={sent.simulated ? "secondary" : "success"}>
                        {!sent.simulated && <MailCheck />}
                        {sent.simulated ? "Asked (simulated)" : "Asked"}
                      </Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void sendRfq(s)} disabled={sending[s.name]}>
                        {sending[s.name] ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                        {sending[s.name] ? "Sending…" : "Ask"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>

            {rfqs.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {polling ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex size-2 animate-pulse bg-primary" />
                    Waiting for replies…
                  </span>
                ) : (
                  <span>
                    {inboxStatus ??
                      (replies.length
                        ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`
                        : "No replies yet")}
                  </span>
                )}
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto px-0"
                  onClick={() => void checkInbox()}
                  disabled={checking}
                >
                  {checking ? "Checking…" : "Check now"}
                </Button>
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-muted-foreground"
                  onClick={() => void checkInbox({ earlier: true })}
                  disabled={checking}
                >
                  Include last 24 h
                </Button>
                {lastChecked && <span className="text-xs">Checked {lastChecked}</span>}
              </div>
            )}
          </div>
        )}

        {(replies.length > 0 || linkOffers.length > 0) && (
          <ul className="flex flex-col gap-3">
            {replies.map((e) => {
              const offer = e.offerId ? state.offers.find((o) => o.id === e.offerId) : null;
              const risk = riskFor(e.id);
              return (
                <li
                  key={e.id}
                  className={cn(
                    "rounded-[2px] border p-4 text-sm",
                    offer && "border-l-[3px] border-l-success",
                    risk && !risk.confirmed && risk.level === "high" && "border-destructive/50 border-l-destructive",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      {offer?.supplierName ?? risk?.supplierName ?? e.toFrom}
                      {risk && <RiskBadge risk={risk} />}
                    </p>
                    <span className="text-xs text-muted-foreground">{formatDateTime(e.sentAt)}</span>
                  </div>
                  {offer ? (
                    <OfferLine offer={offer} />
                  ) : risk ? (
                    <p className="mt-2 text-sm text-destructive">
                      Asks you to pay a different account. See the warning at the top.
                    </p>
                  ) : (
                    <WarningNote className="mt-2">
                      Price unclear: {notes[e.id] ?? "no clear price in this reply."}
                    </WarningNote>
                  )}
                  <Details title="See email" className="mt-2 -mb-3 border-t-0">
                    <p className="text-xs text-muted-foreground">
                      {e.toFrom} · {e.subject}
                    </p>
                    <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 whitespace-pre-wrap italic">
                      {e.body}
                    </blockquote>
                    {offer?.summary && (
                      <p className="mt-2 inline-flex items-start gap-1 text-xs text-muted-foreground">
                        <Sparkles className="mt-px size-3 shrink-0" />
                        AI read: {offer.summary}
                      </p>
                    )}
                  </Details>
                </li>
              );
            })}
            {linkOffers.map((o) => (
              <li key={o.id} className="rounded-[2px] border border-l-[3px] border-l-success p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{o.supplierName}</p>
                  {o.sourceLink && (
                    <a
                      href={o.sourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      From a link
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <OfferLine offer={o} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col">
          {pasteAvailable && (
            <Details
              title={
                <span className="inline-flex items-center gap-2">
                  <ClipboardPaste className="size-4" />
                  Paste a reply
                </span>
              }
              open={pasteOpen}
              onOpenChange={setPasteOpen}
            >
              <div className="flex flex-col gap-2">
                {suppliers.length > 0 && (
                  <Select
                    value={pasteSupplier || suppliers[0]?.name || null}
                    onValueChange={(v) => setPasteSupplier(typeof v === "string" ? v : "")}
                  >
                    <SelectTrigger className="w-fit min-w-48" aria-label="Supplier who replied">
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
                )}
                <Textarea
                  aria-label="Supplier reply"
                  className="min-h-20"
                  placeholder="e.g. Bhai, 80 machines 67 hazar per unit final, delivery 10 din"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button className="w-fit" onClick={() => void readPasted()} disabled={pasting || !pasteText.trim()}>
                  {pasting && <Spinner data-icon="inline-start" />}
                  {pasting ? "Reading…" : "Read reply"}
                </Button>
              </div>
            </Details>
          )}

          <Details
            title={
              <span className="inline-flex items-center gap-2">
                <Link2 className="size-4" />
                Add an offer from a link
              </span>
            }
          >
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addFromLink();
              }}
            >
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Listing link"
                  type="url"
                  inputMode="url"
                  className="min-w-0 flex-1 basis-60"
                  placeholder="https://… (a listing with a price)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={linkLoading || !linkUrl.trim()}>
                  {linkLoading && <Spinner data-icon="inline-start" />}
                  {linkLoading ? "Reading…" : "Add offer"}
                </Button>
              </div>
              {linkNote && (
                <p className="text-xs text-muted-foreground" role="status" data-testid="link-note">
                  {linkNote}
                </p>
              )}
            </form>
          </Details>

          {suppliers.length > 0 && (
            <Details title="See the price requests we sent" hint={`${rfqs.length} sent`}>
              <div className="flex flex-col gap-3">
                {suppliers.map((s) => {
                  const sent = rfqFor(s);
                  return (
                    <div key={s.name} className="rounded-[2px] border p-3 text-sm">
                      <p className="font-medium">{s.name}</p>
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
                      {sent ? (
                        <>
                          <p className="mt-2 text-xs font-medium">
                            {sent.subject}
                            {sent.simulated && (
                              <span className="ml-1 font-normal text-muted-foreground">(simulated)</span>
                            )}
                          </p>
                          <pre className="mt-1 rounded-[2px] border bg-muted/40 p-3 font-sans text-sm whitespace-pre-wrap">
                            {sent.body}
                          </pre>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Not asked yet.</p>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto w-fit px-0 text-muted-foreground"
                  onClick={() => void findSuppliers()}
                  disabled={busy}
                >
                  {finding ? "Searching…" : "Search for different suppliers"}
                </Button>
              </div>
            </Details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OfferLine({ offer }: { offer: Offer }) {
  const extras = [
    `${offer.qty} units · ${formatPKR(offer.total)} total`,
    offer.deliveryDays != null ? `delivery ${offer.deliveryDays} days` : null,
    offer.warrantyMonths != null ? `warranty ${offer.warrantyMonths} months` : null,
  ].filter(Boolean);
  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      <p className="text-base">
        New offer: <span className="font-mono font-semibold tabular-nums">{formatPKR(offer.unitPrice)}</span> each
      </p>
      <p className="text-xs text-muted-foreground">{extras.join(" · ")}</p>
    </div>
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
