"use client";
// Two-pane inbox (list + reading pane) on desktop, one pane at a time on mobile.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeftIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  ExternalLinkIcon,
  InboxIcon,
  LandmarkIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import { formatDateTime, formatShortDate } from "@/lib/dateFormat";
import type { EmailRecord, Offer } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimulatedBadge } from "@/components/suppliers/reputation-badge";

export type InboxItem = {
  key: string;
  decisionId: string;
  decisionTitle: string;
  email: EmailRecord;
  offer: Offer | null;
};

type Filter = "all" | "sent" | "received" | "bank";

const isBank = (e: EmailRecord) => /term sheet/i.test(e.subject);

const FILTERS: { value: Filter; label: string; test: (e: EmailRecord) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "sent", label: "Sent", test: (e) => e.direction === "out" },
  { value: "received", label: "Received", test: (e) => e.direction === "in" },
  { value: "bank", label: "Bank", test: isBank },
];

function decisionHref(item: InboxItem): string {
  return `/decisions/${item.decisionId}?step=offers`;
}

export function InboxView({ items }: { items: InboxItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // null = list view on mobile

  const filtered = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)?.test ?? (() => true);
    return items.filter((i) => test(i.email));
  }, [items, filter]);

  // Desktop always shows something in the reading pane; mobile only once a message is opened.
  const selected = filtered.find((i) => i.key === selectedKey) ?? null;
  const reading = selected ?? filtered[0] ?? null;

  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No emails yet</EmptyTitle>
          <EmptyDescription>
            Send RFQs to suppliers from a decision&apos;s Offers step. Replies and term-sheet requests appear here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/decisions" />} nativeButton={false}>
            Go to decisions
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="px-3">
              {f.label}
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {items.filter((i) => f.test(i.email)).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid overflow-hidden rounded-xl border bg-card lg:h-[calc(100svh-15rem)] lg:min-h-[480px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* List */}
        <div className={cn("min-h-0 flex-col overflow-y-auto lg:flex lg:border-r", selected ? "hidden" : "flex")}>
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No emails in this view.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((item) => (
                <li key={item.key}>
                  <MessageRow
                    item={item}
                    active={reading?.key === item.key}
                    onSelect={() => setSelectedKey(item.key)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reading pane */}
        <div className={cn("min-h-0 overflow-y-auto lg:block", selected ? "block" : "hidden")}>
          {reading ? (
            <ReadingPane item={reading} onBack={() => setSelectedKey(null)} />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Select an email to read it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectionIcon({ email, className }: { email: EmailRecord; className?: string }) {
  if (isBank(email)) return <LandmarkIcon className={cn("text-muted-foreground", className)} aria-label="Bank" />;
  return email.direction === "out" ? (
    <ArrowUpRightIcon className={cn("text-muted-foreground", className)} aria-label="Sent" />
  ) : (
    <ArrowDownLeftIcon className={cn("text-primary", className)} aria-label="Received" />
  );
}

function MessageRow({ item, active, onSelect }: { item: InboxItem; active: boolean; onSelect: () => void }) {
  const { email } = item;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active || undefined}
      className={cn(
        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
        active && "lg:bg-accent lg:hover:bg-accent",
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <DirectionIcon email={email} className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {email.direction === "out" ? "To " : ""}
            {email.toFrom}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(email.sentAt)}</span>
        </span>
        <span className="block truncate text-sm">{email.subject}</span>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs text-muted-foreground">{item.decisionTitle}</span>
          {email.simulated && <SimulatedBadge className="h-4 px-1.5 text-[10px]" />}
        </span>
      </span>
    </button>
  );
}

function ReadingPane({ item, onBack }: { item: InboxItem; onBack: () => void }) {
  const { email, offer } = item;
  return (
    <article className="flex flex-col gap-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit lg:hidden" onClick={onBack}>
        <ArrowLeftIcon data-icon="inline-start" />
        Back to inbox
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <DirectionIcon email={email} />
            {isBank(email) ? "Bank" : email.direction === "out" ? "Sent" : "Received"}
          </Badge>
          {email.simulated && <SimulatedBadge />}
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{email.subject}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{email.direction === "out" ? "To" : "From"}</dt>
          <dd className="truncate">{email.toFrom}</dd>
          <dt className="text-muted-foreground">Date</dt>
          <dd>{formatDateTime(email.sentAt)}</dd>
          <dt className="text-muted-foreground">Decision</dt>
          <dd>
            <Link href={decisionHref(item)} className="text-primary underline-offset-2 hover:underline">
              {item.decisionTitle}
            </Link>
          </dd>
        </dl>
      </header>

      {email.direction === "in" && offer && <ExtractedOffer offer={offer} href={decisionHref(item)} />}

      <pre className="rounded-lg border bg-muted/30 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
        {email.body}
      </pre>
    </article>
  );
}

function ExtractedOffer({ offer, href }: { offer: Offer; href: string }) {
  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: "Unit price", value: formatPKR(offer.unitPrice), mono: true },
    { label: "Quantity", value: String(offer.qty), mono: true },
    { label: "Total", value: formatPKR(offer.total), mono: true },
  ];
  if (offer.deliveryDays != null) facts.push({ label: "Delivery", value: `${offer.deliveryDays} days` });
  if (offer.warrantyMonths != null) facts.push({ label: "Warranty", value: `${offer.warrantyMonths} months` });

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <SparklesIcon className="size-4" />
          Offer read from this reply
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
          Open in decision <ExternalLinkIcon className="size-3" />
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className={cn("text-sm font-medium", f.mono && "font-mono tabular-nums")}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {offer.summary && <p className="mt-3 text-sm text-muted-foreground">{offer.summary}</p>}
      <p className="mt-2 text-xs text-muted-foreground">AI read the reply into these fields; every calculation with them is done by code.</p>
    </div>
  );
}
