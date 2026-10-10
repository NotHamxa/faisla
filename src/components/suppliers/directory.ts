// Supplier directory: merges every supplier seen across a company's decisions (offers, quotations, RFQ
// lists, reputations, emails) by normalized name. Pure and serialisable, so the page builds it on the server.
import type { DecisionRecord, EmailRecord, OfferSource, ReputationResult } from "@/lib/types";

export type SupplierOfferRef = {
  decisionId: string;
  decisionTitle: string;
  offerId: string;
  item: string;
  model: string | null;
  qty: number;
  unitPrice: number;
  total: number;
  source: OfferSource;
  receivedAt: string;
  chosen: boolean; // the decision's recommended row uses this offer
};

export type SupplierEmailRef = { decisionId: string; decisionTitle: string; email: EmailRecord };

export type SupplierReputation = ReputationResult & { simulated?: boolean };

export type SupplierEntry = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  link: string | null;
  offers: SupplierOfferRef[]; // newest first
  bestOffer: SupplierOfferRef | null; // lowest unit price
  reputation: SupplierReputation | null;
  emails: SupplierEmailRef[]; // newest first
  decisions: { id: string; title: string }[];
  lastContact: string | null; // latest email or offer date (ISO)
};

export function supplierKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type Contact = { name: string; email?: string | null; phone?: string | null; city?: string | null; link?: string | null };

// Decisions arrive newest first (listDecisions sorts by updatedAt), so the first value seen for a field wins.
export function buildSupplierDirectory(decisions: DecisionRecord[]): SupplierEntry[] {
  const map = new Map<string, SupplierEntry>();

  function touch(c: Contact, decision: DecisionRecord): SupplierEntry | null {
    const key = supplierKey(c.name);
    if (!key) return null;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        name: c.name.trim(),
        email: null,
        phone: null,
        city: null,
        link: null,
        offers: [],
        bestOffer: null,
        reputation: null,
        emails: [],
        decisions: [],
        lastContact: null,
      };
      map.set(key, entry);
    }
    entry.email ??= c.email?.trim() || null;
    entry.phone ??= c.phone?.trim() || null;
    entry.city ??= c.city?.trim() || null;
    entry.link ??= c.link?.trim() || null;
    if (!entry.decisions.some((d) => d.id === decision.id)) entry.decisions.push({ id: decision.id, title: decision.title });
    return entry;
  }

  for (const d of decisions) {
    const chosenOfferId = d.decision?.rows.find((r) => r.recommended)?.offerId ?? null;

    if (d.quotation?.supplierName) {
      touch(
        { name: d.quotation.supplierName, email: d.quotation.supplierEmail, phone: d.quotation.supplierPhone },
        d,
      );
    }
    for (const s of d.suppliers) touch(s, d);
    for (const o of d.offers) {
      const entry = touch({ name: o.supplierName, email: o.supplierEmail }, d);
      entry?.offers.push({
        decisionId: d.id,
        decisionTitle: d.title,
        offerId: o.id,
        item: o.item,
        model: o.model,
        qty: o.qty,
        unitPrice: o.unitPrice,
        total: o.total,
        source: o.source,
        receivedAt: o.receivedAt,
        chosen: o.id === chosenOfferId,
      });
    }
    for (const rep of Object.values(d.reputations)) {
      // The machine model's reputation has no supplier name; it is not a supplier.
      if (!rep.supplierName) continue;
      const entry = touch({ name: rep.supplierName }, d);
      if (entry && !entry.reputation) entry.reputation = rep as SupplierReputation;
    }
  }

  // Emails: matched by the offer they produced, then by supplier name in the subject, then by address
  // (only when one supplier uses it; demo suppliers can share a test inbox).
  const entries = [...map.values()];
  const byEmail = new Map<string, SupplierEntry[]>();
  for (const e of entries) {
    if (!e.email) continue;
    const k = e.email.toLowerCase();
    byEmail.set(k, [...(byEmail.get(k) ?? []), e]);
  }
  for (const d of decisions) {
    for (const email of d.emails) {
      let entry: SupplierEntry | undefined;
      if (email.offerId) {
        const offer = d.offers.find((o) => o.id === email.offerId);
        if (offer) entry = map.get(supplierKey(offer.supplierName));
      }
      if (!entry) {
        const subject = supplierKey(email.subject);
        entry = entries.find((e) => e.key.length > 3 && subject.includes(e.key));
      }
      if (!entry) {
        const sameAddress = byEmail.get(email.toFrom.toLowerCase());
        if (sameAddress?.length === 1) entry = sameAddress[0];
      }
      if (!entry) continue;
      entry.emails.push({ decisionId: d.id, decisionTitle: d.title, email });
      if (!entry.decisions.some((x) => x.id === d.id)) entry.decisions.push({ id: d.id, title: d.title });
    }
  }

  for (const e of entries) {
    e.offers.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    e.emails.sort((a, b) => b.email.sentAt.localeCompare(a.email.sentAt));
    e.bestOffer = e.offers.reduce<SupplierOfferRef | null>(
      (best, o) => (o.unitPrice > 0 && (!best || o.unitPrice < best.unitPrice) ? o : best),
      null,
    );
    const dates = [...e.offers.map((o) => o.receivedAt), ...e.emails.map((m) => m.email.sentAt)].filter(Boolean);
    e.lastContact = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  }

  // Most recently contacted first; never-contacted suppliers last, by name.
  return entries.sort((a, b) => {
    if (a.lastContact && b.lastContact) return b.lastContact.localeCompare(a.lastContact);
    if (a.lastContact) return -1;
    if (b.lastContact) return 1;
    return a.name.localeCompare(b.name);
  });
}
