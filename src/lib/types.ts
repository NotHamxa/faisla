// Shared contracts for Faisla. Every module (finance engine, API routes, UI) builds on these.
// Money is PKR (plain numbers, rounded only for display). Rates are decimals (0.148 = 14.8%).

export type Company = {
  name: string;
  city: string;
  isExporter: boolean;
  cashBalance: number;
  monthlyFixedCosts: number;
  taxRate: number; // 0.29
  discountRate: number; // 0.15, pre-tax yearly
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

export type FinancingType = "bank" | "ltff";

export type FinancingOption = {
  id: string;
  name: string;
  type: FinancingType;
  annualRate: number; // 0.148
  tenorMonths: number;
  downPaymentPct: number; // 0.10
  feePct: number; // upfront processing fee on principal, default 0
  kiborLinked: boolean; // stress test shifts only these
  requiresExporter: boolean;
  sourceLink: string | null;
  note?: string;
};

export type PaymentMethod = "cash" | "installments" | "bank" | "ltff";

export type CalculationStep = {
  label: string; // "Hidden yearly rate"
  formula: string; // "(1 + r)^12 − 1"
  inputs: Record<string, number | string>;
  result: number | string;
};

export type ComparisonRow = {
  id: string; // e.g. "offer-a:installments", "offer-b:ltff"
  label: string; // 'A, "0%" installments'
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
  hiddenYearlyRate: number | null; // installments only
  hiddenSimpleRate: number | null; // r × 12, installments only
  verdict: string;
  recommended: boolean;
  calculation: CalculationStep[]; // "show calculation"
};

export type DecideInput = {
  company: Company;
  offers: Offer[];
  financing: FinancingOption[];
  kiborShift?: number; // 0.02 = +2%, for the stress slider
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

export type EmailRecord = {
  id: string;
  direction: "out" | "in";
  toFrom: string;
  subject: string;
  body: string;
  offerId: string | null;
  sentAt: string;
  simulated: boolean;
};

export type MemoResult = {
  memo: string; // markdown
  numberCheck: { passed: boolean; unknownNumbers: string[]; attempts: number };
  source: "llm" | "template";
};

// Returned by any AI route when the model output fails validation or no key is set and no cache exists.
export type NeedsOwnerInput = { needsOwnerInput: true; reason: string };

// ---- Management system records (MongoDB-backed, serialisable for the client) ----

export type DecisionStatus = "draft" | "collecting" | "comparing" | "decided";

// One purchase decision: the whole six-step workflow for one quotation.
export type DecisionRecord = {
  id: string;
  title: string; // "4 × JUKI AMS-221F pattern sewers"
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  quotation: Quotation | null;
  quotationConfirmed: boolean;
  offers: Offer[];
  market: MarketResult | null;
  reputations: Record<string, ReputationResult>;
  suppliers: Supplier[];
  emails: EmailRecord[];
  decision: DecideResult | null;
  memo: MemoResult | null;
};

// Workflow fields of a decision the client may change (everything except identity and timestamps).
export type DecisionPatch = Partial<
  Pick<
    DecisionRecord,
    | "title"
    | "quotation"
    | "quotationConfirmed"
    | "offers"
    | "market"
    | "reputations"
    | "suppliers"
    | "emails"
    | "decision"
    | "memo"
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
