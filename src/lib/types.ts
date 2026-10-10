// Shared contracts for Faisla. Every module (finance engine, API routes, UI) builds on these.
// Money is PKR (plain numbers, rounded only for display). Rates are decimals (0.148 = 14.8%).

// "islamic": only Shariah-compliant financing is compared (default).
// "both": conventional (interest-based) financing is shown too, labelled, for comparison only; never recommended.
export type FinancingPreference = "islamic" | "both";

export type Company = {
  name: string;
  city: string;
  isExporter: boolean;
  cashBalance: number;
  monthlyFixedCosts: number;
  taxRate: number; // 0.29
  discountRate: number; // 0.15, pre-tax yearly
  financingPreference: FinancingPreference;
};

export type QuotationItem = {
  description: string;
  model: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number | null; // as printed, null if not printed
};

// What the vision model extracts from a quotation (owner confirms every field).
export type Quotation = {
  supplierName: string;
  supplierPhone: string | null;
  supplierEmail: string | null;
  quoteDate: string | null; // YYYY-MM-DD
  items: QuotationItem[];
  printedTotal: number | null;
  cashDiscountPct: number | null; // 8 = 8%
  installmentMonths: number | null;
  installmentAmount: number | null;
  firstInstallmentOnDelivery: boolean | null;
  markupClaimedPct: number | null; // the "0%" claim
  validityDays: number | null;
  // Bank details printed on the quotation (for the payment-fraud check). Optional for older records.
  bankName?: string | null;
  accountTitle?: string | null;
  iban?: string | null;
};

export type ArithmeticIssue = { field: string; message: string };

export type OfferSource = "quote" | "email" | "web";

// One supplier's price for the purchase. Built from a confirmed quotation or an email reply.
export type Offer = {
  id: string;
  supplierName: string;
  supplierEmail: string | null;
  item: string;
  model: string | null;
  qty: number;
  unitPrice: number;
  total: number; // qty × unitPrice (list price, before cash discount)
  cashDiscountPct: number | null;
  installmentMonths: number | null;
  installmentAmount: number | null;
  firstInstallmentOnDelivery: boolean;
  source: OfferSource;
  sourceLink: string | null;
  receivedAt: string; // ISO
  deliveryDays?: number | null;
  warrantyMonths?: number | null;
  summary?: string | null;
};

// Islamic modes (docs/ISLAMIC_FINANCE.md):
// - diminishing_musharakah: bank and customer co-own the asset; monthly rent on the bank's share + purchase of its units.
// - murabaha: bank sells the asset at cost + profit; the deferred price is fixed at the contract, paid in installments.
// - ijarah: bank leases the asset; security deposit + monthly rentals; ownership transferred at the end by a separate sale.
// - iltf: SBP Islamic Long-Term Financing Facility for exporters' new machinery, through an Islamic bank.
export type IslamicFinancingType = "diminishing_musharakah" | "murabaha" | "ijarah" | "iltf";
// Conventional (interest-based) financing, shown only when the preference is "both".
export type ConventionalFinancingType = "bank" | "ltff";
export type FinancingType = IslamicFinancingType | ConventionalFinancingType;

export type FinancingOption = {
  id: string;
  name: string;
  type: FinancingType;
  shariahCompliant: boolean; // Islamic modes true, conventional false
  annualRate: number; // 0.148 (profit rate / rental benchmark for Islamic modes)
  tenorMonths: number;
  downPaymentPct: number; // 0.10 (customer's contribution; security deposit for Ijarah)
  feePct: number; // upfront processing fee on principal, default 0
  kiborLinked: boolean; // stress test shifts only these
  requiresExporter: boolean;
  sourceLink: string | null;
  note?: string;
};

// "installments" = the supplier's own deferred-price plan (bay' muajjal), not bank financing.
export type PaymentMethod = "cash" | "installments" | FinancingType;

export type CalculationStep = {
  label: string; // "Effective yearly cost"
  formula: string; // "(1 + r)^12 − 1"
  inputs: Record<string, number | string>;
  result: number | string;
};

export type ComparisonRow = {
  id: string; // e.g. "offer-a:installments", "offer-b:iltf"
  label: string; // 'A, deferred-price plan ("0%")'
  offerId: string;
  supplierName: string;
  method: PaymentMethod;
  financingId: string | null;
  cashPrice: number; // price paid if buying with cash (after discount)
  upfront: number; // paid at delivery (cash price, or down payment + fee)
  monthlyPayment: number; // 0 for cash
  months: number; // 0 for cash
  totalPaid: number;
  pvBeforeTax: number;
  pvAfterTax: number;
  runwayMonths: number;
  hiddenYearlyRate: number | null; // installments only: effective yearly cost of paying later
  hiddenSimpleRate: number | null; // r × 12, installments only
  shariahCompliant?: boolean; // optional: comparisons saved before Islamic modes lack it (see isShariahRow)
  verdict: string;
  recommended: boolean;
  calculation: CalculationStep[]; // "show calculation"
};

export type DecideInput = {
  company: Company;
  offers: Offer[];
  financing: FinancingOption[];
  kiborShift?: number; // 0.02 = +2%, for the stress slider
  preference?: FinancingPreference; // defaults to company.financingPreference, then "islamic"
};

export type DecideResult = {
  rows: ComparisonRow[]; // sorted by pvAfterTax ascending
  recommendedId: string;
  baselineId: string | null; // the original quotation's installment plan (or its cash row)
  savingsVsBaseline: { beforeTax: number; afterTax: number } | null;
  runwayToday: number;
  breakEvenDiscountRate: number | null; // recommended (financed) vs cheapest cash
  afterTaxDiscountRate: number;
  kiborShift: number;
  financingPreference?: FinancingPreference; // optional for comparisons saved before it existed
  assumptions: string[];
  company: Company;
};

export type MarketPrice = {
  seller: string;
  price: number;
  condition: "new" | "used" | "unknown";
  exactModel: boolean;
  url: string;
  title?: string;
};

export type MarketResult = {
  model: string;
  quotedUnitPrice: number | null;
  benchmarkMedian: number | null; // simulated benchmark table
  benchmarkCount: number;
  webPrices: MarketPrice[]; // after cleaning
  webMedian: number | null;
  pctAboveMarket: number | null; // 0.10 = 10% above
  enoughData: boolean;
  cached: boolean;
  note?: string;
};

export type ReputationFlag = "good" | "mixed" | "red" | "not_enough";

export type ReviewPoint = {
  about: "supplier" | "product";
  rating: number | null;
  complaintType: "delivery" | "warranty" | "quality" | "service" | "fraud" | "none";
  quote: string;
  url: string;
};

export type ReputationResult = {
  supplierName: string;
  model: string | null;
  flag: ReputationFlag;
  averageRating: number | null;
  reviews: ReviewPoint[];
  reasons: string[];
  cached: boolean;
};

export type Supplier = {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  link: string | null;
};

// Bank details and warning language read from an email (payment-fraud check).
export type PaymentDetails = {
  iban: string | null;
  accountTitle: string | null;
  bankName: string | null;
  urgency: boolean; // account-change or "pay today" language
  urgencyQuote: string | null;
};

export type EmailRecord = {
  id: string;
  direction: "out" | "in";
  toFrom: string;
  subject: string;
  body: string;
  offerId: string | null;
  sentAt: string;
  simulated: boolean;
  payment?: PaymentDetails | null; // incoming emails: bank details / warning language found in the body
};

export type MemoResult = {
  memo: string; // markdown
  numberCheck: { passed: boolean; unknownNumbers: string[]; attempts: number };
  source: "llm" | "template";
};

// Returned by any AI route when the model output fails validation or no key is set and no cache exists.
export type NeedsOwnerInput = { needsOwnerInput: true; reason: string };

// ---- "Describe what you need" sourcing (second way to start a decision) ----

// The owner's need in plain words, structured: what to search for and the limits that matter.
export type NeedRequest = {
  need: string; // the owner's own words
  item: string; // "Direct-drive lockstitch sewing machine"
  modelCandidates: string[]; // models that fit, most likely first (may be empty)
  qty: number;
  city: string | null;
  budgetPkr: number | null; // total budget, only when the owner wrote one
  searchQueries: string[]; // at most 3
};

// One web listing that survived the code filters. unitPrice is copied from the listing text, never estimated.
export type SourcedOption = {
  id: string; // "opt-1", in price order
  seller: string;
  item: string;
  model: string | null;
  title: string; // listing title as found
  unitPrice: number; // PKR per unit, as written in the listing
  condition: "new" | "unknown";
  exactModel: boolean;
  url: string;
  contactEmail: string | null;
  contactPhone: string | null;
  simulated: boolean; // demo listing written by the team (labelled in the UI)
};

export type SourcingResult = {
  request: NeedRequest;
  options: SourcedOption[]; // sorted by unit price, cheapest first
  medianUnitPrice: number | null; // null when fewer than 3 prices (not enough market data)
  minUnitPrice: number | null;
  enoughData: boolean;
  cached: boolean;
  simulated: boolean;
  note: string | null;
  searchedAt: string; // ISO
  selectedIds: string[]; // options the owner turned into offers (empty until chosen)
};

// ---- Management system records (MongoDB-backed, serialisable for the client) ----

export type DecisionStatus = "draft" | "collecting" | "comparing" | "decided";

// How the decision started: a supplier's quotation, or the owner describing what they need.
export type DecisionOrigin = "quotation" | "need";

// One purchase decision: the whole six-step workflow for one quotation.
export type DecisionRecord = {
  id: string;
  title: string; // "80 × Jack F5 lockstitch machines"
  status: DecisionStatus;
  origin: DecisionOrigin;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  quotation: Quotation | null;
  quotationConfirmed: boolean;
  sourcing: SourcingResult | null;
  offers: Offer[];
  market: MarketResult | null;
  reputations: Record<string, ReputationResult>;
  suppliers: Supplier[];
  emails: EmailRecord[];
  decision: DecideResult | null;
  memo: MemoResult | null;
  paymentConfirmations: string[]; // payment-risk ids the owner confirmed by phone on a known number
};

// Workflow fields of a decision the client may change (everything except identity and timestamps).
export type DecisionPatch = Partial<
  Pick<
    DecisionRecord,
    | "title"
    | "origin"
    | "quotation"
    | "quotationConfirmed"
    | "sourcing"
    | "offers"
    | "market"
    | "reputations"
    | "suppliers"
    | "emails"
    | "decision"
    | "memo"
    | "paymentConfirmations"
  >
>;

export type CompanyRecord = Company & {
  id: string;
  financing: FinancingOption[];
  updatedAt: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  companyId: string;
};
