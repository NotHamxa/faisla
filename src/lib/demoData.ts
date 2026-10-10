// Demo data, labelled "Demo data" in the UI. Numbers match TECHNICAL_SPEC.md §4.4.
// Company, suppliers and quotes are fictional. The machine is real: new Jack F5 units are listed in Pakistan
// at Rs 63,000–79,000 (real listings cached in src/data/cache/search.json, median Rs 70,000).
import type { Company, FinancingOption, Offer, Quotation, Supplier } from "./types";

export const DEMO_MODEL = "Jack F5";
export const DEMO_ITEM = "Direct-drive single-needle lockstitch machine";

export const demoCompany: Company = {
  name: "Hamza Garments",
  city: "Faisalabad",
  isExporter: true,
  cashBalance: 1_00_00_000,
  monthlyFixedCosts: 35_00_000,
  taxRate: 0.29,
  discountRate: 0.15,
  financingPreference: "islamic",
  payInFullWhenAffordable: false,
};

// What extraction should return for the printed Supplier A quotation.
export const demoQuotation: Quotation = {
  supplierName: "Al-Noor Industrial Machines",
  supplierPhone: "+92 41 2645 118",
  supplierEmail: "sales@alnoor-machines.pk",
  quoteDate: "2026-10-08",
  items: [
    {
      description: DEMO_ITEM,
      model: DEMO_MODEL,
      qty: 80,
      unitPrice: 75_000,
      lineTotal: 60_00_000,
    },
  ],
  printedTotal: 60_00_000,
  cashDiscountPct: 8,
  installmentMonths: 12,
  installmentAmount: 5_00_000,
  firstInstallmentOnDelivery: false,
  markupClaimedPct: 0,
  validityDays: 15,
  bankName: "Meezan Bank Ltd",
  accountTitle: "Al-Noor Industrial Machines",
  iban: "PK76MEZN0002310104567890",
};

export const demoOfferA: Offer = {
  id: "offer-a",
  supplierName: demoQuotation.supplierName,
  supplierEmail: demoQuotation.supplierEmail,
  item: DEMO_ITEM,
  model: DEMO_MODEL,
  qty: 80,
  unitPrice: 75_000,
  total: 60_00_000,
  cashDiscountPct: 8,
  installmentMonths: 12,
  installmentAmount: 5_00_000,
  firstInstallmentOnDelivery: false,
  source: "quote",
  sourceLink: null,
  receivedAt: "2026-10-08T10:00:00.000Z",
};

// Supplier B's reply, as read from the test inbox ("Bhai, 80 machines 67 hazar per unit final ...").
export const demoOfferB: Offer = {
  id: "offer-b",
  supplierName: "Madina Sewing Solutions",
  supplierEmail: null,
  item: DEMO_ITEM,
  model: DEMO_MODEL,
  qty: 80,
  unitPrice: 67_000,
  total: 53_60_000,
  cashDiscountPct: null,
  installmentMonths: null,
  installmentAmount: null,
  firstInstallmentOnDelivery: false,
  source: "email",
  sourceLink: null,
  receivedAt: "2026-10-11T06:25:00.000Z",
  deliveryDays: 10,
  warrantyMonths: 12,
  summary: "80 machines at Rs 67,000 each, final price; delivery in 10 days; 1 year warranty.",
};

// Payment-fraud demo: looks like Supplier A, but from free webmail, new account, personal title, urgency.
export const DEMO_FRAUD_REPLY = {
  from: "alnoor.machines.fsd@gmail.com",
  subject: "Re: Quotation ANIM/Q/2026/0412 - Al-Noor Industrial Machines",
  body: [
    "Dear Sir,",
    "",
    "Thank you for your order confirmation. Due to our annual audit our bank account has changed. Kindly transfer the 30% advance today to our new account so we can book your 80 Jack F5 machines from the next shipment:",
    "",
    "Bank Alfalah, Gulberg Branch",
    "Title: Imran Qureshi",
    "IBAN: PK59 ALFH 0047 1200 9876 1234",
    "",
    "Please treat this as urgent; the old Meezan account is not in use.",
    "",
    "Regards,",
    "M. Imran Qureshi",
    "Sales Manager, Al-Noor Industrial Machines",
  ].join("\n"),
};

export const DEMO_SUPPLIER_B_REPLY =
  "Bhai, 80 machines 67 hazar per unit final, delivery 10 din, 1 saal warranty";

export const POLICY_RATE = 0.115; // SBP policy rate: set at 11.5% on 28 Apr 2026, held on 27 Jul and 14 Sep 2026
export const KIBOR = 0.118; // Illustrative KIBOR (6M offer was 11.86% on 4 Sep 2026, 12.41% on 9 Oct 2026); the stress slider covers the gap

// Islamic-first financing set (docs/ISLAMIC_FINANCE.md). Diminishing Musharakah, Islamic LTFF and Murabaha use the same
// cash-flow maths as a term facility (10% customer contribution, 36 equal monthly installments, profit on the outstanding
// amount at rate ÷ 12), so the demo numbers match TECHNICAL_SPEC §4.5. Ijarah: 10% security deposit, rentals at the same
// benchmark, deposit adjusted against the purchase price when ownership transfers at the end.
export const diminishingMusharakah: FinancingOption = {
  id: "dm",
  name: "Islamic bank Diminishing Musharakah (KIBOR + 3%)",
  type: "diminishing_musharakah",
  shariahCompliant: true,
  annualRate: 0.148,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: true,
  requiresExporter: false,
  sourceLink: "https://www.meezanbank.com/commercial-banking/",
  note: "Co-ownership: monthly rent on the bank's share + purchase of its units. Profit rate = KIBOR (illustrative 11.8%) + 3%",
};

export const ijarah: FinancingOption = {
  id: "ijarah",
  name: "Islamic bank Ijarah (KIBOR + 3%)",
  type: "ijarah",
  shariahCompliant: true,
  annualRate: 0.148,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: true,
  requiresExporter: false,
  sourceLink: "https://www.meezanbank.com/commercial-banking/",
  note: "Lease: 10% security deposit, monthly rentals; ownership transferred at the end by a separate sale",
};

export const islamicLtff: FinancingOption = {
  id: "iltf",
  name: "SBP Islamic LTFF (ILTFF) via Diminishing Musharakah",
  type: "iltf",
  shariahCompliant: true,
  annualRate: 0.085,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: false,
  requiresExporter: true,
  sourceLink: "https://www.abl.com/business-banking/trade-services/export-finances/",
  note: "SBP Islamic Long-Term Financing Facility for exporters buying new machinery; end-user rate = policy rate − 3%",
};

export const murabaha: FinancingOption = {
  id: "murabaha",
  name: "Islamic bank Murabaha (fixed price)",
  type: "murabaha",
  shariahCompliant: true,
  annualRate: 0.148,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: false,
  requiresExporter: false,
  sourceLink: "https://www.meezanbank.com/commercial-banking/",
  note: "Cost-plus sale: the bank buys the machines and sells them to you at a deferred price fixed at the contract",
};

export const conventionalBankLoan: FinancingOption = {
  id: "bank",
  name: "Conventional bank term loan (KIBOR + 3%)",
  type: "bank",
  shariahCompliant: false,
  annualRate: 0.148,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: true,
  requiresExporter: false,
  sourceLink: "https://www.sbp.org.pk/ecodata/kibor_index.asp",
  note: "Interest-based; shown only when the preference includes conventional financing",
};

export const conventionalLtff: FinancingOption = {
  id: "ltff",
  name: "SBP LTFF, conventional (policy rate − 3%)",
  type: "ltff",
  shariahCompliant: false,
  annualRate: 0.085,
  tenorMonths: 36,
  downPaymentPct: 0.1,
  feePct: 0,
  kiborLinked: false,
  requiresExporter: true,
  sourceLink: "https://www.sbp.org.pk/smefd/circulars/",
  note: "Interest-based Long-Term Financing Facility for exporters buying new machinery",
};

// Default set for every company: Islamic modes first, conventional kept for the "both" preference.
export const demoFinancing: FinancingOption[] = [
  diminishingMusharakah,
  ijarah,
  islamicLtff,
  conventionalBankLoan,
  conventionalLtff,
];

// Presets offered on the Financing page ("Add option").
export const financingPresets: FinancingOption[] = [diminishingMusharakah, ijarah, murabaha, islamicLtff, conventionalBankLoan, conventionalLtff];

// Fictional suppliers; emails must point at team test inboxes (set in env, see lib/email.ts).
export const demoSuppliers: Supplier[] = [
  {
    name: "Madina Sewing Solutions",
    email: "supplier-b@example.com",
    phone: "+92 42 3577 2210",
    city: "Lahore",
    link: null,
  },
  {
    name: "Karachi Garment Tech",
    email: "supplier-c@example.com",
    phone: "+92 21 3241 9087",
    city: "Karachi",
    link: null,
  },
];
