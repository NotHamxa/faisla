"use client";
// Workspace state for one decision (plus the company it belongs to), autosaved to MongoDB.
// Components keep using useStore(); the provider splits each change into company vs decision saves.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Company,
  CompanyRecord,
  DecideResult,
  DecisionOrigin,
  DecisionPatch,
  DecisionRecord,
  DecisionStatus,
  EmailRecord,
  FinancingOption,
  MarketResult,
  MemoResult,
  Offer,
  Quotation,
  ReputationResult,
  SourcingResult,
  Supplier,
} from "./types";

export type FaislaState = {
  company: Company;
  financing: FinancingOption[];
  title: string;
  origin: DecisionOrigin; // started from a quotation or from a described need
  quotation: Quotation | null; // confirmed quotation (for a need: built from the chosen listing)
  quotationConfirmed: boolean;
  sourcing: SourcingResult | null; // web listings found for a described need
  offers: Offer[];
  market: MarketResult | null;
  reputations: Record<string, ReputationResult>; // keyed by supplier name (or model for the product)
  suppliers: Supplier[];
  emails: EmailRecord[];
  decision: DecideResult | null;
  memo: MemoResult | null;
  paymentConfirmations: string[];
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DECISION_KEYS = [
  "title",
  "origin",
  "quotation",
  "quotationConfirmed",
  "sourcing",
  "offers",
  "market",
  "reputations",
  "suppliers",
  "emails",
  "decision",
  "memo",
  "paymentConfirmations",
] as const satisfies readonly (keyof FaislaState & keyof DecisionPatch)[];

const COMPANY_KEYS = [
  "name",
  "city",
  "isExporter",
  "cashBalance",
  "monthlyFixedCosts",
  "taxRate",
  "discountRate",
  "financingPreference",
] as const;

type Store = {
  state: FaislaState;
  decisionId: string | null; // null when used outside a decision (e.g. settings)
  status: DecisionStatus | null;
  saveStatus: SaveStatus;
  update: (patch: Partial<FaislaState> | ((s: FaislaState) => Partial<FaislaState>)) => void;
  upsertOffer: (offer: Offer) => void;
  addEmail: (email: EmailRecord) => void;
  reset: () => void; // clears the decision's workflow (keeps title and company)
};

const StoreContext = createContext<Store | null>(null);

function stateFrom(company: CompanyRecord, decision?: DecisionRecord | null): FaislaState {
  const { name, city, isExporter, cashBalance, monthlyFixedCosts, taxRate, discountRate, financingPreference, financing } = company;
  return {
    company: {
      name,
      city,
      isExporter,
      cashBalance,
      monthlyFixedCosts,
      taxRate,
      discountRate,
      financingPreference: financingPreference ?? "islamic",
    },
    financing,
    title: decision?.title ?? "",
    origin: decision?.origin ?? "quotation",
    quotation: decision?.quotation ?? null,
    quotationConfirmed: decision?.quotationConfirmed ?? false,
    sourcing: decision?.sourcing ?? null,
    offers: decision?.offers ?? [],
    market: decision?.market ?? null,
    reputations: decision?.reputations ?? {},
    suppliers: decision?.suppliers ?? [],
    emails: decision?.emails ?? [],
    decision: decision?.decision ?? null,
    memo: decision?.memo ?? null,
    paymentConfirmations: decision?.paymentConfirmations ?? [],
  };
}

const SAVE_DELAY_MS = 600;

export function StoreProvider({
  company,
  decision,
  children,
}: {
  company: CompanyRecord;
  decision?: DecisionRecord | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<FaislaState>(() => stateFrom(company, decision));
  const [status, setStatus] = useState<DecisionStatus | null>(decision?.status ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const decisionId = decision?.id ?? null;

  // Pending changes, flushed together after a short pause.
  const pendingDecision = useRef<DecisionPatch>({});
  const pendingCompany = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const decisionPatch = pendingDecision.current;
    const companyPatch = pendingCompany.current;
    pendingDecision.current = {};
    pendingCompany.current = {};
    const jobs: Promise<Response>[] = [];
    if (Object.keys(companyPatch).length) {
      jobs.push(fetch("/api/company", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(companyPatch) }));
    }
    if (decisionId && Object.keys(decisionPatch).length) {
      jobs.push(
        fetch(`/api/decisions/${decisionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(decisionPatch),
        }).then(async (res) => {
          if (res.ok) {
            const body = (await res.clone().json()) as { decision?: DecisionRecord };
            if (body.decision) setStatus(body.decision.status);
          }
          return res;
        }),
      );
    }
    if (!jobs.length) return;
    setSaveStatus("saving");
    try {
      const results = await Promise.all(jobs);
      setSaveStatus(results.every((r) => r.ok) ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }, [decisionId]);

  const schedule = useCallback(
    (prev: FaislaState, next: FaislaState) => {
      for (const key of DECISION_KEYS) {
        if (prev[key] !== next[key]) (pendingDecision.current as Record<string, unknown>)[key] = next[key];
      }
      if (prev.company !== next.company) {
        for (const key of COMPANY_KEYS) {
          if (prev.company[key] !== next.company[key]) pendingCompany.current[key] = next.company[key];
        }
      }
      if (prev.financing !== next.financing) pendingCompany.current.financing = next.financing;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Save anything pending when leaving the page.
  useEffect(() => {
    const onHide = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flush]);

  const update = useCallback<Store["update"]>(
    (patch) => {
      setState((s) => {
        const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
        // Recording changes inside the updater is idempotent, so a double-invoked updater is harmless.
        schedule(s, next);
        return next;
      });
    },
    [schedule],
  );

  const upsertOffer = useCallback(
    (offer: Offer) => {
      update((s) => {
        const exists = s.offers.some((o) => o.id === offer.id);
        const offers = exists ? s.offers.map((o) => (o.id === offer.id ? offer : o)) : [...s.offers, offer];
        return { offers, decision: null, memo: null };
      });
    },
    [update],
  );

  const addEmail = useCallback(
    (email: EmailRecord) => {
      update((s) => (s.emails.some((e) => e.id === email.id) ? {} : { emails: [...s.emails, email] }));
    },
    [update],
  );

  const reset = useCallback(() => {
    update({
      quotation: null,
      quotationConfirmed: false,
      sourcing: null,
      offers: [],
      market: null,
      reputations: {},
      suppliers: [],
      emails: [],
      decision: null,
      memo: null,
      paymentConfirmations: [],
    });
  }, [update]);

  const value = useMemo(
    () => ({ state, decisionId, status, saveStatus, update, upsertOffer, addEmail, reset }),
    [state, decisionId, status, saveStatus, update, upsertOffer, addEmail, reset],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
