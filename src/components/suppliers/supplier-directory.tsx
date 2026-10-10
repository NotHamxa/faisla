"use client";
// Supplier directory table with search; a row opens a sheet with contact, offers, reputation and emails.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
  StarIcon,
  TruckIcon,
} from "lucide-react";
import { formatPKR, groupPKR } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SupplierEntry } from "./directory";
import { ReputationBadge, SimulatedBadge } from "./reputation-badge";

const SOURCE_LABEL = { quote: "Quotation", email: "Email reply", web: "Web" } as const;

function matches(s: SupplierEntry, q: string): boolean {
  if (!q) return true;
  return [s.name, s.city, s.email, s.phone, ...s.decisions.map((d) => d.title)]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

export function SupplierDirectory({ suppliers }: { suppliers: SupplierEntry[] }) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => suppliers.filter((s) => matches(s, q)), [suppliers, q]);
  const selected = suppliers.find((s) => s.key === selectedKey) ?? null;

  if (suppliers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TruckIcon />
          </EmptyMedia>
          <EmptyTitle>No suppliers yet</EmptyTitle>
          <EmptyDescription>
            Suppliers appear here as soon as a decision has a quotation, an RFQ list or an email reply.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/decisions?new=1" />} nativeButton={false}>
            Start a decision
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers, cities, emails…"
            className="pl-8"
            aria-label="Search suppliers"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[2px] border bg-card">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Supplier</TableHead>
              <TableHead>City / contact</TableHead>
              <TableHead>Offers</TableHead>
              <TableHead>Reputation</TableHead>
              <TableHead className="pr-4 text-right">Last contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No supplier matches &ldquo;{query}&rdquo;.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow
                key={s.key}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => setSelectedKey(s.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedKey(s.key);
                  }
                }}
              >
                <TableCell className="py-3 pl-4">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.decisions.length} decision{s.decisions.length === 1 ? "" : "s"}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div>{s.city ?? <span className="text-muted-foreground">—</span>}</div>
                  <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {[s.email, s.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {s.bestOffer ? (
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-mono font-medium tabular-nums">{formatPKR(s.bestOffer.unitPrice)}</span>
                        <span className="text-xs text-muted-foreground"> / unit best</span>
                      </div>
                      <Link
                        href={`/decisions/${s.bestOffer.decisionId}?step=offers`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {s.offers.length} offer{s.offers.length === 1 ? "" : "s"} · {s.bestOffer.decisionTitle}
                      </Link>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No offers yet</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {s.reputation ? (
                    <div className="flex items-center gap-2">
                      <ReputationBadge flag={s.reputation.flag} />
                      {s.reputation.averageRating !== null && (
                        <span className="flex items-center gap-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                          <StarIcon className="size-3 fill-current" />
                          {s.reputation.averageRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not checked</span>
                  )}
                </TableCell>
                <TableCell className="py-3 pr-4 text-right text-muted-foreground">{formatDate(s.lastContact)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <SupplierDetails supplier={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 px-4">
      <h3 className="ledger-label">{title}</h3>
      {children}
    </section>
  );
}

function SupplierDetails({ supplier: s }: { supplier: SupplierEntry }) {
  const rep = s.reputation;
  return (
    <div className="flex flex-col gap-5 pb-6">
      <SheetHeader className="pr-12">
        <SheetTitle className="text-lg">{s.name}</SheetTitle>
        <SheetDescription>
          Seen in {s.decisions.length} decision{s.decisions.length === 1 ? "" : "s"} · last contact {formatDate(s.lastContact)}
        </SheetDescription>
      </SheetHeader>

      <Section title="Contact">
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <MailIcon className="size-4 text-muted-foreground" />
            {s.email ? (
              <a href={`mailto:${s.email}`} className="text-primary underline-offset-2 hover:underline">
                {s.email}
              </a>
            ) : (
              <span className="text-muted-foreground">No email</span>
            )}
          </li>
          <li className="flex items-center gap-2">
            <PhoneIcon className="size-4 text-muted-foreground" />
            {s.phone ? (
              <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className="font-mono tabular-nums">
                {s.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">No phone</span>
            )}
          </li>
          <li className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-muted-foreground" />
            {s.city ?? <span className="text-muted-foreground">City unknown</span>}
          </li>
          {s.link && (
            <li className="flex items-center gap-2">
              <GlobeIcon className="size-4 text-muted-foreground" />
              <a
                href={s.link}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary underline-offset-2 hover:underline"
              >
                {s.link}
              </a>
            </li>
          )}
        </ul>
      </Section>

      <Separator />

      <Section title={`Offers (${s.offers.length})`}>
        {s.offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offers from this supplier yet.</p>
        ) : (
          <ul className="space-y-2">
            {s.offers.map((o) => (
              <li key={`${o.decisionId}:${o.offerId}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/decisions/${o.decisionId}?step=offers`}
                    className="text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {o.decisionTitle}
                  </Link>
                  <div className="flex gap-1.5">
                    {o.chosen && <Badge>Recommended</Badge>}
                    <Badge variant="outline">{SOURCE_LABEL[o.source]}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {o.qty} × {o.model ?? o.item} · {formatDate(o.receivedAt)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    Unit <span className="font-mono font-medium tabular-nums">{formatPKR(o.unitPrice)}</span>
                  </span>
                  <span>
                    Total <span className="font-mono tabular-nums">{formatPKR(o.total)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Separator />

      <Section title="Reputation">
        {!rep ? (
          <p className="text-sm text-muted-foreground">Reviews have not been checked for this supplier yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ReputationBadge flag={rep.flag} />
              {rep.averageRating !== null && (
                <span className="flex items-center gap-1 text-sm">
                  <StarIcon className="size-3.5 fill-current text-warning" />
                  <span className="font-mono tabular-nums">{rep.averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/ 5</span>
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {rep.reviews.length} review{rep.reviews.length === 1 ? "" : "s"}
              </span>
              {rep.simulated && <SimulatedBadge />}
            </div>
            {rep.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {rep.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {rep.reviews.length > 0 && (
              <ul className="space-y-2">
                {rep.reviews.map((r, i) => (
                  <li key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p>&ldquo;{r.quote}&rdquo;</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.rating !== null && (
                        <span className="flex items-center gap-0.5 font-mono tabular-nums">
                          <StarIcon className="size-3 fill-current" />
                          {r.rating}
                        </span>
                      )}
                      {r.complaintType !== "none" && (
                        <Badge variant="outline" className="font-normal">
                          {r.complaintType}
                        </Badge>
                      )}
                      {rep.simulated && <SimulatedBadge />}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        >
                          Source <ExternalLinkIcon className="size-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Separator />

      <Section title={`Emails (${s.emails.length})`}>
        {s.emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails exchanged yet.</p>
        ) : (
          <ul className="space-y-2">
            {s.emails.map(({ email, decisionId, decisionTitle }) => (
              <li key={`${decisionId}:${email.id}`} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  {email.direction === "out" ? (
                    <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Sent" />
                  ) : (
                    <ArrowDownLeftIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Received" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{email.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {email.direction === "out" ? "Sent" : "Received"} · {formatDateTime(email.sentAt)} ·{" "}
                      <Link href={`/decisions/${decisionId}?step=offers`} className="underline-offset-2 hover:underline">
                        {decisionTitle}
                      </Link>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{email.body}</p>
                  </div>
                  {email.simulated && <SimulatedBadge />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {s.emails.length > 0 && (
          <Button variant="outline" size="sm" render={<Link href="/inbox" />} nativeButton={false}>
            Open inbox
          </Button>
        )}
      </Section>

      {s.bestOffer && (
        <p className="px-4 text-xs text-muted-foreground">
          Best unit price so far: <span className="font-mono tabular-nums">{groupPKR(s.bestOffer.unitPrice)}</span> in{" "}
          {s.bestOffer.decisionTitle}.
        </p>
      )}
    </div>
  );
}
