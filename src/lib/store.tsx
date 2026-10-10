"use client";
// Client-side app state, persisted to localStorage so a refresh mid-demo loses nothing.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoCompany, demoFinancing } from "./demoData";
import type {
  Company,
  DecideResult,
  EmailRecord,
  FinancingOption,
  MarketResult,
  MemoResult,
  Offer,
  Quotation,
  ReputationResult,
  Supplier,
} from "./types";

export type FaislaState = {
  company: Company;
  quotation: Quotation | null; // confirmed quotation
  quotationConfirmed: boolean;
  offers: Offer[];
  financing: FinancingOption[];
  market: MarketResult | null;
  reputations: Record<string, ReputationResult>; // keyed by supplier name
  suppliers: Supplier[];
  emails: EmailRecord[];
  decision: DecideResult | null;
  memo: MemoResult | null;
};

const initialState: FaislaState = {
  company: demoCompany,
  quotation: null,
  quotationConfirmed: false,
  offers: [],
  financing: demoFinancing,
  market: null,
  reputations: {},
  suppliers: [],
  emails: [],
  decision: null,
  memo: null,
};

const STORAGE_KEY = "faisla-state-v1";

type Store = {
  state: FaislaState;
  update: (patch: Partial<FaislaState> | ((s: FaislaState) => Partial<FaislaState>)) => void;
  upsertOffer: (offer: Offer) => void;
  addEmail: (email: EmailRecord) => void;
  reset: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FaislaState>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...JSON.parse(raw) });
    } catch {
      // corrupted storage: start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const update = useCallback<Store["update"]>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const upsertOffer = useCallback((offer: Offer) => {
    setState((s) => {
      const exists = s.offers.some((o) => o.id === offer.id);
      const offers = exists ? s.offers.map((o) => (o.id === offer.id ? offer : o)) : [...s.offers, offer];
      return { ...s, offers, decision: null, memo: null };
    });
  }, []);

  const addEmail = useCallback((email: EmailRecord) => {
    setState((s) => (s.emails.some((e) => e.id === email.id) ? s : { ...s, emails: [...s.emails, email] }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const value = useMemo(() => ({ state, update, upsertOffer, addEmail, reset }), [state, update, upsertOffer, addEmail, reset]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
