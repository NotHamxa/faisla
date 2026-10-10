// Demo data (all fictional, labelled "Demo data" in the UI). Numbers match TECHNICAL_SPEC.md §4.4.
import type { Company, FinancingOption, Offer, Quotation, Supplier } from "./types";

export const DEMO_MODEL = "JUKI AMS-221F";
export const DEMO_ITEM = "Computer-controlled pattern sewing machine";

export const demoCompany: Company = {
  name: "Hamza Garments",
  city: "Faisalabad",
  isExporter: true,
  cashBalance: 1_00_00_000,
  monthlyFixedCosts: 35_00_000,
  taxRate: 0.29,
  discountRate: 0.15,
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
      qty: 4,
      unitPrice: 15_00_000,
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
  qty: 4,
  unitPrice: 15_00_000,
  total: 60_00_000,
  cashDiscountPct: 8,
  installmentMonths: 12,
  installmentAmount: 5_00_000,
  firstInstallmentOnDelivery: false,
  source: "quote",
  sourceLink: null,
  receivedAt: "2026-10-08T10:00:00.000Z",
};

// Supplier B's reply, as read from the test inbox ("Bhai, 4 machines 13.4 lakh per unit final ...").
export const demoOfferB: Offer = {
  id: "offer-b",
  supplierName: "Madina Sewing Solutions",
  supplierEmail: null,
  item: DEMO_ITEM,
  model: DEMO_MODEL,
  qty: 4,
  unitPrice: 13_40_000,
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
  summary: "4 machines at Rs 13.4 lakh each, final price; delivery in 10 days; 1 year warranty.",
};

// Payment-fraud demo: looks like Supplier A, but from free webmail, new account, personal title, urgency.
export const DEMO_FRAUD_REPLY = {
  from: "alnoor.machines.fsd@gmail.com",
  subject: "Re: Quotation ANIM/Q/2026/0412 - Al-Noor Industrial Machines",
  body: [
    "Dear Sir,",
    "",
    "Thank you for your order confirmation. Due to our annual audit our bank account has changed. Kindly transfer the 30% advance today to our new account so we can book your machines:",
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
  "Bhai, 4 machines 13.4 lakh per unit final, delivery 10 din, 1 saal warranty";

export const POLICY_RATE = 0.115; // SBP policy rate since 14 Sept 2026
export const KIBOR = 0.118; // 1-year KIBOR (verify before demo)

export const demoFinancing: FinancingOption[] = [
  {
    id: "bank",
    name: "Bank term loan (KIBOR + 3%)",
    type: "bank",
    annualRate: 0.148,
    tenorMonths: 36,
    downPaymentPct: 0.1,
    feePct: 0,
    kiborLinked: true,
    requiresExporter: false,
    sourceLink: "https://www.sbp.org.pk/ecodata/kibor_index.asp",
    note: "KIBOR ≈ 11.8% + 3% bank spread",
  },
  {
    id: "ltff",
    name: "SBP LTFF (policy rate − 3%)",
    type: "ltff",
    annualRate: 0.085,
    tenorMonths: 36,
    downPaymentPct: 0.1,
    feePct: 0,
    kiborLinked: false,
    requiresExporter: true,
    sourceLink: "https://www.sbp.org.pk/smefd/circulars/",
    note: "Long-Term Financing Facility for exporters buying new machinery",
  },
];

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
