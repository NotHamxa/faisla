// Demo account and sample decisions, so the dashboard has history on first login.
// Market and reputation results come from the same cached pipelines the app uses; money from finance.ts.
import "server-only";
import { POST as marketPost } from "@/app/api/market/route";
import { POST as reviewsPost } from "@/app/api/reviews/route";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_MODEL, DEMO_SUPPLIER_B_REPLY, demoOfferA, demoOfferB, demoQuotation } from "@/lib/demoData";
import { decide } from "@/lib/finance";
import { allowedNumbers, memoFacts } from "@/lib/memoFacts";
import { memoTemplate } from "@/lib/memoTemplate";
import { checkMemoNumbers } from "@/lib/numberCheck";
import { resolveDemoSuppliers } from "@/lib/suppliers";
import type { CompanyRecord, EmailRecord, MarketResult, Offer, Quotation, ReputationResult } from "@/lib/types";
import { createDecision, createUserWithCompany, findUserByEmail, getCompany, listDecisions } from "./repo";

const DAY = 24 * 60 * 60 * 1000;

async function callJson<T>(handler: (r: Request) => Promise<Response>, body: unknown): Promise<T | null> {
  try {
    const res = await handler(
      new Request("http://localhost/seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    );
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// Ensures the demo login exists and has sample decisions. Idempotent.
export async function ensureDemoAccount(): Promise<void> {
  const existing = await findUserByEmail(DEMO_EMAIL);
  if (existing) return;
  const user = await createUserWithCompany({
    email: DEMO_EMAIL,
    name: "Hamza Ahmed",
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });
  await seedSampleDecisions(user.companyId.toHexString());
}

export async function seedSampleDecisions(companyId: string): Promise<void> {
  const company = await getCompany(companyId);
  if (!company) return;
  if ((await listDecisions(companyId)).length > 0) return;
  await seedDecidedJuki(company);
  await seedGeneratorInProgress(company);
  await createDecision(companyId, { title: "Fabric cutting machine (draft)" }, { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
}

async function seedDecidedJuki(company: CompanyRecord) {
  const decidedAt = new Date(Date.now() - 3 * DAY);
  const offerB: Offer = { ...demoOfferB, receivedAt: new Date(decidedAt.getTime() - 4 * 60 * 60 * 1000).toISOString() };
  const offers = [demoOfferA, offerB];
  const suppliers = resolveDemoSuppliers();

  const market = await callJson<MarketResult>(marketPost, { model: DEMO_MODEL, quotedUnitPrice: demoOfferA.unitPrice });
  const reputations: Record<string, ReputationResult> = {};
  for (const [supplierName, model] of [
    [demoOfferA.supplierName, DEMO_MODEL],
    [offerB.supplierName, DEMO_MODEL],
    ["", DEMO_MODEL],
  ] as const) {
    const rep = await callJson<ReputationResult>(reviewsPost, { supplierName, model });
    if (rep) reputations[supplierName || DEMO_MODEL] = rep;
  }

  const emails: EmailRecord[] = [
    {
      id: "seed-rfq-b",
      direction: "out",
      toFrom: suppliers[0]?.email ?? "supplier-b@example.com",
      subject: `RFQ for ${offerB.supplierName}: 4 x ${DEMO_MODEL} - ${company.name}`,
      body: `Dear ${offerB.supplierName},\n\n${company.name} (${company.city}) would like a quotation for 4 × ${DEMO_MODEL}. Please share your unit price, delivery time, warranty, and cash vs installment terms.\n\nRegards,\n${company.name}`,
      offerId: null,
      sentAt: new Date(decidedAt.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      simulated: true,
    },
    {
      id: "seed-reply-b",
      direction: "in",
      toFrom: suppliers[0]?.email ?? "supplier-b@example.com",
      subject: `Re: RFQ for ${offerB.supplierName}: 4 x ${DEMO_MODEL} - ${company.name}`,
      body: DEMO_SUPPLIER_B_REPLY,
      offerId: offerB.id,
      sentAt: offerB.receivedAt,
      simulated: true,
    },
  ];

  const decision = decide({ company, offers, financing: company.financing, kiborShift: 0 });
  const context = { offers, financing: company.financing };
  const memoText = memoTemplate(decision, reputations, context);
  const check = checkMemoNumbers(memoText, allowedNumbers(memoFacts(decision, reputations, context)));

  await createDecision(
    company.id,
    {
      title: `4 × ${DEMO_MODEL} pattern sewers`,
      quotation: demoQuotation,
      quotationConfirmed: true,
      offers,
      market,
      reputations,
      suppliers,
      emails,
      decision,
      memo: { memo: memoText, numberCheck: { ...check, attempts: 0 }, source: "template" },
    },
    { createdAt: new Date(decidedAt.getTime() - 1 * DAY), decidedAt },
  );
}

async function seedGeneratorInProgress(company: CompanyRecord) {
  const quotation: Quotation = {
    supplierName: "Faisal Power Systems",
    supplierPhone: "+92 41 8711 402",
    supplierEmail: "info@faisalpower.pk",
    quoteDate: new Date(Date.now() - DAY).toISOString().slice(0, 10),
    items: [{ description: "Diesel generator, soundproof canopy", model: "Cummins C110D5", qty: 1, unitPrice: 38_00_000, lineTotal: 38_00_000 }],
    printedTotal: 38_00_000,
    cashDiscountPct: 5,
    installmentMonths: 6,
    installmentAmount: 6_30_000,
    firstInstallmentOnDelivery: true,
    markupClaimedPct: 0,
    validityDays: 10,
  };
  const offer: Offer = {
    id: "offer-a",
    supplierName: quotation.supplierName,
    supplierEmail: quotation.supplierEmail,
    item: quotation.items[0].description,
    model: quotation.items[0].model,
    qty: 1,
    unitPrice: 38_00_000,
    total: 38_00_000,
    cashDiscountPct: 5,
    installmentMonths: 6,
    installmentAmount: 6_30_000,
    firstInstallmentOnDelivery: true,
    source: "quote",
    sourceLink: null,
    receivedAt: new Date(Date.now() - DAY).toISOString(),
  };
  await createDecision(
    company.id,
    { title: "100 kVA backup generator", quotation, quotationConfirmed: true, offers: [offer] },
    { createdAt: new Date(Date.now() - DAY) },
  );
}
